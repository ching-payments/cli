import { request } from "@/api/client"
import { currentProjectSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderTable } from "@/ui/table"
import { theme, symbols } from "@/ui/theme"
import { formatRelative } from "@/ui/format"

export async function apiKeysListCommand(flags: GlobalFlags): Promise<void> {
  await withCommand(flags, { mutating: false }, async (ctx) => {
    // Keys live on the current-project payload, and it returns BOTH test
    // and live keys regardless of the active mode - so unlike other list
    // commands this one is not mode-scoped. We surface a Mode column.
    const data = await request({
      path: "/projects/current",
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
    }).then((d) => currentProjectSchema.parse(d))

    const keys = data.apiKeys

    if (ctx.json) {
      process.stdout.write(JSON.stringify(keys, null, 2) + "\n")
      return
    }

    if (keys.length === 0) {
      process.stdout.write(
        `${theme.muted(symbols.bullet)} No API keys yet. Create one with ${theme.bold("ching api-keys create")}.\n`,
      )
      return
    }

    const table = renderTable(keys, [
      { header: "ID", render: (r) => theme.muted(String(r.id)) },
      { header: "Name", render: (r) => theme.bold(r.name ?? "-") },
      { header: "Key", render: (r) => theme.muted(r.key ?? "-") },
      { header: "Mode", render: (r) => (r.livemode ? theme.danger("live") : "test") },
      { header: "Active", render: (r) => (r.active === false ? theme.danger("no") : theme.success("yes")) },
      { header: "Last used", render: (r) => theme.muted(formatRelative(r.lastUsed)) },
    ])

    process.stdout.write(table + "\n")
    process.stdout.write(
      `\n${theme.muted(`${keys.length} key${keys.length === 1 ? "" : "s"} (test + live) · only the masked preview is shown · use --json for raw output`)}\n`,
    )
  })
}
