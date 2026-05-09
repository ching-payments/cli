import fs from "node:fs"
import { INSTALLERS } from "@/skills/installers"
import { renderTable } from "@/ui/table"
import { theme, symbols, brandMark } from "@/ui/theme"
import { exitWithError } from "@/ui/error"
import { readConfig } from "@/config/store"

interface ListFlags {
  json?: boolean
}

export async function skillsListCommand(flags: ListFlags): Promise<void> {
  const json = !!flags.json
  try {
    const cwd = process.cwd()

    const rows = INSTALLERS.flatMap((installer) =>
      (["global", "project"] as const).map((scope) => {
        const target = installer.resolveTarget({ scope, cwd })
        const installed = fs.existsSync(target)
        return { installer, scope, target, installed }
      }),
    )

    if (json) {
      process.stdout.write(
        JSON.stringify(
          rows.map((r) => ({
            target: r.installer.id,
            scope: r.scope,
            installed: r.installed,
            path: r.target,
          })),
          null,
          2,
        ) + "\n",
      )
      return
    }

    process.stderr.write(`${brandMark()} ${theme.muted("· installed skills")}\n\n`)

    const table = renderTable(rows, [
      { header: "Tool", render: (r) => theme.bold(r.installer.label) },
      { header: "Scope", render: (r) => r.scope },
      {
        header: "Installed",
        render: (r) => (r.installed ? theme.success(symbols.ok) : theme.muted(symbols.bullet)),
        align: "center",
      },
      { header: "Path", render: (r) => theme.muted(r.target) },
    ])
    process.stdout.write(table + "\n")
  } catch (err) {
    exitWithError(err, { cfg: readConfig(), json })
  }
}
