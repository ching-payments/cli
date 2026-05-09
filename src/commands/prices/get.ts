import { request } from "@/api/client"
import { priceSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderDetail } from "@/ui/panel"
import { formatAgorot, formatRelative } from "@/ui/format"

export async function pricesGetCommand(id: string, flags: GlobalFlags): Promise<void> {
  await withCommand(flags, { mutating: false }, async (ctx) => {
    const data = await request({
      path: `/prices/${encodeURIComponent(id)}`,
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
    }).then((d) => priceSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + "\n")
      return
    }

    const out = renderDetail({
      title: "PRICE",
      id: data.id,
      rows: [
        { label: "Product", value: data.product },
        { label: "Amount", value: formatAgorot(data.unit_amount, data.currency ?? "ils") },
        { label: "Type", value: data.type ?? "-" },
        { label: "Tax mode", value: data.tax_mode ?? "-" },
        {
          label: "Recurring",
          value: data.recurring
            ? `every ${data.recurring.interval_count ?? 1} ${data.recurring.interval}${
                data.recurring.trial_period_days
                  ? ` (${data.recurring.trial_period_days}d trial)`
                  : ""
              }`
            : "one-time",
        },
        { label: "Created", value: formatRelative(data.created) },
      ],
    })
    process.stdout.write(out + "\n")
  })
}
