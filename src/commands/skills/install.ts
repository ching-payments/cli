import * as p from "@clack/prompts"
import { downloadSkill } from "@/skills/download"
import { INSTALLERS, installerById } from "@/skills/installers"
import type { InstallScope, Installer } from "@/skills/installers"
import { theme, symbols, brandMark } from "@/ui/theme"
import { exitWithError } from "@/ui/error"
import { readConfig } from "@/config/store"

interface InstallFlags {
  json?: boolean
  // Comma-separated list of installer ids (e.g. "claude,cursor"). When set,
  // the interactive multi-select is skipped.
  target?: string
  // Mutually exclusive scope selectors. When neither is set, we prompt.
  global?: boolean
  project?: boolean
  // Overwrite an existing install instead of erroring.
  force?: boolean
}

function pickTargets(flags: InstallFlags): Installer[] | null {
  if (!flags.target) return null
  const ids = flags.target
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const out: Installer[] = []
  for (const id of ids) {
    const found = installerById(id)
    if (!found) {
      throw new Error(
        `Unknown target "${id}". Valid targets: ${INSTALLERS.map((i) => i.id).join(", ")}`,
      )
    }
    out.push(found)
  }
  return out
}

async function pickScope(flags: InstallFlags, isTty: boolean): Promise<InstallScope> {
  if (flags.global && flags.project) {
    throw new Error("Pass at most one of --global or --project")
  }
  if (flags.global) return "global"
  if (flags.project) return "project"

  if (!isTty) {
    // Non-interactive default: install globally. CI scripts that want
    // per-project installs should pass --project explicitly.
    return "global"
  }

  const ans = await p.select({
    message: "Where do you want to install the CHING skill?",
    options: [
      {
        value: "global",
        label: "Globally (~/.claude/skills, ~/.cursor/rules)",
        hint: "Available in every project on this machine",
      },
      {
        value: "project",
        label: `Current project only (${shortCwd()})`,
        hint: "Lives in this folder; ships to teammates via git",
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

async function pickInstallers(
  flags: InstallFlags,
  scope: InstallScope,
  cwd: string,
  isTty: boolean,
): Promise<Installer[]> {
  const explicit = pickTargets(flags)
  if (explicit) return explicit

  if (!isTty) {
    // Non-interactive default: install for any agent we can detect, fall
    // back to the full list if none are detected (the user explicitly ran
    // the command, so they probably want at least one to land).
    const detected = INSTALLERS.filter((i) => i.detect({ scope, cwd }))
    return detected.length ? detected : [...INSTALLERS]
  }

  const detectedIds = new Set(
    INSTALLERS.filter((i) => i.detect({ scope, cwd })).map((i) => i.id),
  )

  const ans = await p.multiselect({
    message: "Install for which AI tools?",
    options: INSTALLERS.map((i) => ({
      value: i.id,
      label: i.label,
      hint: detectedIds.has(i.id) ? "detected on this machine" : undefined,
    })),
    initialValues: INSTALLERS.filter((i) => detectedIds.has(i.id)).map((i) => i.id),
    required: true,
  })
  if (p.isCancel(ans)) process.exit(1)

  return (ans as string[]).map((id) => installerById(id)!).filter(Boolean)
}

export async function skillsInstallCommand(flags: InstallFlags): Promise<void> {
  const json = !!flags.json
  const isTty = !!process.stdin.isTTY && !json

  if (!json) {
    process.stderr.write(`${brandMark()} ${theme.muted("· install AI skill")}\n\n`)
  }

  try {
    const scope = await pickScope(flags, isTty)
    const cwd = process.cwd()
    const installers = await pickInstallers(flags, scope, cwd, isTty)
    if (installers.length === 0) {
      throw new Error("No targets selected")
    }

    const spinner = isTty ? p.spinner() : null
    spinner?.start(`Downloading skill from github.com/ching-payments/skill`)

    const extracted = await downloadSkill().catch((err) => {
      spinner?.stop("Download failed", 1)
      throw err
    })
    spinner?.stop("Skill downloaded")

    const results: Array<{
      installer: Installer
      ok: boolean
      installedPath?: string
      overwrote?: boolean
      error?: string
    }> = []

    try {
      for (const installer of installers) {
        try {
          const r = await installer.install({
            sourceDir: extracted.dir,
            scope,
            cwd,
            force: !!flags.force,
          })
          results.push({
            installer,
            ok: true,
            installedPath: r.installedPath,
            overwrote: r.overwrote,
          })
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
              overwrote: r.overwrote ?? false,
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
        const verb = r.overwrote ? "Updated" : "Installed"
        process.stderr.write(
          `${theme.success(symbols.ok)} ${theme.bold(r.installer.label)}: ${verb} at ${theme.muted(r.installedPath ?? "")}\n`,
        )
      } else {
        process.stderr.write(
          `${theme.danger(symbols.fail)} ${theme.bold(r.installer.label)}: ${r.error}\n`,
        )
      }
    }

    const anyOk = results.some((r) => r.ok)
    if (anyOk) {
      process.stderr.write(
        `\n${theme.muted(symbols.arrow)} Restart your AI tool (or open a new chat) to load the skill.\n`,
      )
    }
    if (results.some((r) => !r.ok)) {
      process.exit(1)
    }
  } catch (err) {
    exitWithError(err, { cfg: readConfig(), json })
  }
}
