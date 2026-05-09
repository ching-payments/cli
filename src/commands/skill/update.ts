import fs from "node:fs"
import * as p from "@clack/prompts"
import { downloadSkill } from "@/skill/download"
import { INSTALLERS, installerById } from "@/skill/installers"
import type { InstallScope, Installer } from "@/skill/installers"
import { theme, symbols, brandMark } from "@/ui/theme"
import { exitWithError } from "@/ui/error"
import { readConfig } from "@/config/store"

interface UpdateFlags {
  json?: boolean
  // Comma-separated subset of installer ids. When omitted, every detected
  // existing install at the chosen scope is updated.
  target?: string
  global?: boolean
  project?: boolean
}

async function pickScope(flags: UpdateFlags, isTty: boolean): Promise<InstallScope> {
  if (flags.global && flags.project) {
    throw new Error("Pass at most one of --global or --project")
  }
  if (flags.global) return "global"
  if (flags.project) return "project"

  if (!isTty) {
    // Non-interactive default mirrors `install`.
    return "global"
  }

  const ans = await p.select({
    message: "Which install do you want to update?",
    options: [
      {
        value: "global",
        label: "Global (~/.claude/skills, ~/.cursor/rules)",
      },
      {
        value: "project",
        label: `Current project only (${shortCwd()})`,
      },
    ],
  })
  if (p.isCancel(ans)) process.exit(1)
  return ans as InstallScope
}

function shortCwd(): string {
  const cwd = process.cwd()
  const home = process.env.HOME
  if (home && cwd.startsWith(home)) return "~" + cwd.slice(home.length)
  return cwd
}

// The whole point of `update` is to refresh what's already on disk - never
// to silently add new targets the user didn't ask for. We resolve each
// installer's target path and check the filesystem.
function detectInstalled(scope: InstallScope, cwd: string): Installer[] {
  return INSTALLERS.filter((i) => fs.existsSync(i.resolveTarget({ scope, cwd })))
}

function narrowByTarget(installers: Installer[], target: string | undefined): Installer[] {
  if (!target) return installers
  const ids = target
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  for (const id of ids) {
    if (!installerById(id)) {
      throw new Error(
        `Unknown target "${id}". Valid targets: ${INSTALLERS.map((i) => i.id).join(", ")}`,
      )
    }
  }
  return installers.filter((i) => ids.includes(i.id))
}

export async function skillUpdateCommand(flags: UpdateFlags): Promise<void> {
  const json = !!flags.json
  const isTty = !!process.stdin.isTTY && !json

  if (!json) {
    process.stderr.write(`${brandMark()} ${theme.muted("· update AI skill")}\n\n`)
  }

  try {
    const scope = await pickScope(flags, isTty)
    const cwd = process.cwd()

    const installed = detectInstalled(scope, cwd)
    const targeted = narrowByTarget(installed, flags.target)

    if (targeted.length === 0) {
      const where = scope === "global" ? "globally" : "in the current project"
      const hint =
        installed.length === 0
          ? `Nothing is installed ${where}. Run \`ching skill install\` first.`
          : `No matching installs ${where}. Currently installed: ${installed.map((i) => i.id).join(", ")}.`

      if (json) {
        process.stdout.write(
          JSON.stringify({ ok: false, scope, results: [], message: hint }, null, 2) + "\n",
        )
        process.exit(1)
      }
      process.stderr.write(`${theme.muted(symbols.bullet)} ${hint}\n`)
      process.exit(1)
    }

    const spinner = isTty ? p.spinner() : null
    spinner?.start("Downloading latest skill from github.com/ching-payments/skill")

    const extracted = await downloadSkill().catch((err) => {
      spinner?.stop("Download failed", 1)
      throw err
    })
    spinner?.stop("Skill downloaded")

    const results: Array<{
      installer: Installer
      ok: boolean
      installedPath?: string
      error?: string
    }> = []

    try {
      for (const installer of targeted) {
        try {
          const r = await installer.install({
            sourceDir: extracted.dir,
            scope,
            cwd,
            // Update is exactly an overwriting install of what's already
            // there. force=true is the contract.
            force: true,
          })
          results.push({ installer, ok: true, installedPath: r.installedPath })
        } catch (err) {
          results.push({
            installer,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    } finally {
      extracted.cleanup()
    }

    if (json) {
      process.stdout.write(
        JSON.stringify(
          {
            ok: results.every((r) => r.ok),
            scope,
            results: results.map((r) => ({
              target: r.installer.id,
              ok: r.ok,
              path: r.installedPath ?? null,
              error: r.error ?? null,
            })),
          },
          null,
          2,
        ) + "\n",
      )
      if (results.some((r) => !r.ok)) process.exit(1)
      return
    }

    process.stderr.write("\n")
    for (const r of results) {
      if (r.ok) {
        process.stderr.write(
          `${theme.success(symbols.ok)} ${theme.bold(r.installer.label)}: updated at ${theme.muted(r.installedPath ?? "")}\n`,
        )
      } else {
        process.stderr.write(
          `${theme.danger(symbols.fail)} ${theme.bold(r.installer.label)}: ${r.error}\n`,
        )
      }
    }

    if (results.some((r) => r.ok)) {
      process.stderr.write(
        `\n${theme.muted(symbols.arrow)} Restart your AI tool (or open a new chat) to load the updated skill.\n`,
      )
    }
    if (results.some((r) => !r.ok)) {
      process.exit(1)
    }
  } catch (err) {
    exitWithError(err, { cfg: readConfig(), json })
  }
}
