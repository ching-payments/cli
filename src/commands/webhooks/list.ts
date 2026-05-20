import { request } from "@/api/client"
import { webhookListSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderTable } from "@/ui/table"
import { theme, symbols } from "@/ui/theme"
import { formatRelative } from "@/ui/format"

export async function webhooksListCommand(flags: GlobalFlags): Promise<void> {
  await withCommand(flags, { mutating: false }, async (ctx) => {
    const data = await request({
      path: "/webhooks",
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
    }).then((d) => webhookListSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + "\n")
      return
    }

    if (data.length === 0) {
      process.stdout.write(
        `${theme.muted(symbols.bullet)} No webhooks in ${ctx.effectiveMode} mode. Create one with ${theme.bold("ching webhooks create --url='https://...' --events charge.succeeded")}.\n`,
      )
      return
    }

    const table = renderTable(data, [
      { header: "ID", render: (r) => theme.muted(String(r.id)) },
      { header: "URL", render: (r) => theme.bold(r.url) },
      { header: "Events", render: (r) => r.events.join(", ") },
      { header: "Active", render: (r) => (r.active === false ? theme.danger("no") : theme.success("yes")) },
      { header: "Created", render: (r) => theme.muted(formatRelative(r.created)) },
    ])

    process.stdout.write(table + "\n")
    process.stdout.write(
      `\n${theme.muted(`${data.length} webhook${data.length === 1 ? "" : "s"} in ${ctx.effectiveMode} mode · use --json for raw output`)}\n`,
    )
  })
}
