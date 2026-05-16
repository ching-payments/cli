import { request } from "@/api/client"
import { chargeListSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderTable } from "@/ui/table"
import { theme, symbols } from "@/ui/theme"
import { formatAgorot, formatRelative } from "@/ui/format"

interface ListFlags extends GlobalFlags {
  customer?: string
  requiresCapture?: boolean
}

export async function chargesListCommand(flags: ListFlags): Promise<void> {
  await withCommand(flags, { mutating: false }, async (ctx) => {
    const data = await request({
      path: "/charges",
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
      query: { customer: flags.customer },
    }).then((d) => chargeListSchema.parse(d))

    const filtered = flags.requiresCapture
      ? data.filter((c) => c.status === "requires_capture")
      : data

    if (ctx.json) {
      process.stdout.write(JSON.stringify(filtered, null, 2) + "\n")
      return
    }

    if (filtered.length === 0) {
      const hint = flags.requiresCapture
        ? "No charges currently awaiting capture."
        : "No charges yet."
      process.stdout.write(`${theme.muted(symbols.bullet)} ${hint}\n`)
      return
    }

    const table = renderTable(filtered, [
      { header: "ID", render: (r) => theme.muted(r.id) },
      {
        header: "Customer",
        render: (r) => r.customer_name ?? r.customer ?? "-",
      },
      {
        header: "Amount",
        render: (r) => theme.bold(formatAgorot(r.amount, r.currency ?? "ils")),
        align: "right",
      },
      {
        header: "Status",
        render: (r) =>
          r.status === "requires_capture"
            ? theme.warning("authorized")
            : r.status === "succeeded"
              ? theme.success(r.status)
              : r.status === "failed" || r.status === "canceled"
                ? theme.muted(r.status)
                : r.status,
      },
      {
        header: "Capture",
        render: (r) => (r.capture_method === "manual" ? "manual" : theme.muted("auto")),
      },
      {
        header: "Created",
        render: (r) => theme.muted(formatRelative(r.created ?? null)),
      },
    ])

    process.stdout.write(table + "\n")
    process.stdout.write(
      `\n${theme.muted(`${filtered.length} charge${filtered.length === 1 ? "" : "s"} · use --requires-capture to filter to held charges · --json for raw output`)}\n`,
    )
  })
}
