import { request } from "@/api/client"
import { chargeSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderDetail } from "@/ui/panel"
import { formatAgorot, formatRelative } from "@/ui/format"

export async function chargesGetCommand(id: string, flags: GlobalFlags): Promise<void> {
  await withCommand(flags, { mutating: false }, async (ctx) => {
    const data = await request({
      path: `/charges/${encodeURIComponent(id)}`,
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
    }).then((d) => chargeSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + "\n")
      return
    }

    const currency = data.currency ?? "ils"
    const rows: { label: string; value: string | null }[] = [
      { label: "Status", value: data.status },
      { label: "Amount", value: formatAgorot(data.amount, currency) },
    ]
    if (data.amount_captured !== null && data.amount_captured !== undefined) {
      rows.push({
        label: "Captured",
        value: formatAgorot(data.amount_captured, currency),
      })
    }
    rows.push({ label: "Capture", value: data.capture_method ?? "automatic" })
    if (data.capture_method === "manual") {
      rows.push({
        label: "Authorized",
        value: data.authorized_at ? formatRelative(data.authorized_at) : null,
      })
      rows.push({
        label: "Expires",
        value: data.capturable_until
          ? `${formatRelative(data.capturable_until)} (${data.capturable_until})`
          : null,
      })
    }
    if (data.cancellation_reason) {
      rows.push({ label: "Canceled reason", value: data.cancellation_reason })
    }
    if (data.failure_message) {
      rows.push({ label: "Failure", value: data.failure_message })
    }
    rows.push({ label: "Customer", value: data.customer ?? null })
    rows.push({ label: "Description", value: data.description ?? null })
    rows.push({ label: "Created", value: formatRelative(data.created ?? null) })

    const out = renderDetail({
      title: "CHARGE",
      id: data.id,
      rows,
    })
    process.stdout.write(out + "\n")
  })
}
