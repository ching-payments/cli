import * as p from "@clack/prompts"
import { INSTALLERS, installerById } from "@/skills/installers"
import type { InstallScope, Installer } from "@/skills/installers"
import { theme, symbols, brandMark } from "@/ui/theme"
import { exitWithError } from "@/ui/error"
import { readConfig } from "@/config/store"

interface UninstallFlags {
  json?: boolean
  target?: string
  global?: boolean
  project?: boolean
}

async function pickScope(flags: UninstallFlags, isTty: boolean): Promise<InstallScope> {
  if (flags.global && flags.project) {
    throw new Error("Pass at most one of --global or --project")
  }
  if (flags.global) return "global"
  if (flags.project) return "project"
  if (!isTty) return "global"

  const ans = await p.select({
    message: "Remove the skill from where?",
    options: [
      { value: "global", label: "Global install" },
      { value: "project", label: "Current project install" },
    ],
  })
  if (p.isCancel(ans)) process.exit(1)
  return ans as InstallScope
}

function pickTargets(flags: UninstallFlags): Installer[] {
  if (!flags.target) return [...INSTALLERS]
  return flags.target
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => {
      const found = installerById(id)
      if (!found) {
        throw new Error(
          `Unknown target "${id}". Valid targets: ${INSTALLERS.map((i) => i.id).join(", ")}`,
        )
      }
      return found
    })
}

export async function skillsUninstallCommand(flags: UninstallFlags): Promise<void> {
  const json = !!flags.json
  const isTty = !!process.stdin.isTTY && !json

  if (!json) {
    process.stderr.write(`${brandMark()} ${theme.muted("· uninstall AI skill")}\n\n`)
  }

  try {
    const scope = await pickScope(flags, isTty)
    const installers = pickTargets(flags)
    const cwd = process.cwd()

    const results: Array<{ installer: Installer; removed: boolean; error?: string }> = []
    for (const installer of installers) {
      try {
        const removed = await installer.uninstall({ scope, cwd })
        results.push({ installer, removed })
      } catch (err) {
        results.push({
          installer,
          removed: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    if (json) {
      process.stdout.write(
        JSON.stringify(
          {
            ok: results.every((r) => !r.error),
            scope,
            results: results.map((r) => ({
              target: r.installer.id,
              removed: r.removed,
              error: r.error ?? null,
            })),
          },
          null,
          2,
        ) + "\n",
      )
      return
    }

    for (const r of results) {
      if (r.error) {
        process.stderr.write(
          `${theme.danger(symbols.fail)} ${theme.bold(r.installer.label)}: ${r.error}\n`,
        )
      } else if (r.removed) {
        process.stderr.write(
          `${theme.success(symbols.ok)} ${theme.bold(r.installer.label)}: removed\n`,
        )
      } else {
        process.stderr.write(
          `${theme.muted(symbols.bullet)} ${theme.bold(r.installer.label)}: nothing to remove\n`,
        )
      }
    }
  } catch (err) {
    exitWithError(err, { cfg: readConfig(), json })
  }
}
