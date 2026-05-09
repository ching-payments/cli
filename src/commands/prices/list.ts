import { request } from "@/api/client"
import { priceListSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderTable } from "@/ui/table"
import { theme, symbols } from "@/ui/theme"
import { formatAgorot, formatRelative } from "@/ui/format"

interface ListFlags extends GlobalFlags {
  product?: string
  limit?: string
}

export async function pricesListCommand(flags: ListFlags): Promise<void> {
  await withCommand(flags, { mutating: false }, async (ctx) => {
    const limit = flags.limit ? Number(flags.limit) : undefined
    if (limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
      throw new Error("--limit must be a positive integer")
    }

    const data = await request({
      path: "/prices",
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
      query: { product: flags.product, limit },
    }).then((d) => priceListSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + "\n")
      return
    }

    if (data.length === 0) {
      process.stdout.write(
        `${theme.muted(symbols.bullet)} No prices ${flags.product ? `for ${flags.product}` : ""}. Create one with ${theme.bold("ching prices create --product=<id> --amount=4990")}.\n`,
      )
      return
    }

    const table = renderTable(data, [
      { header: "ID", render: (r) => theme.muted(r.id) },
      { header: "Product", render: (r) => r.product, hide: !!flags.product },
      {
        header: "Amount",
        render: (r) => formatAgorot(r.unit_amount, r.currency ?? "ils"),
        align: "right",
      },
      {
        header: "Type",
        render: (r) => r.type ?? "-",
      },
      {
        header: "Recurring",
        render: (r) =>
          r.recurring
            ? `${r.recurring.interval_count ?? 1} ${r.recurring.interval}`
            : theme.muted("one-time"),
      },
      {
        header: "Created",
        render: (r) => theme.muted(formatRelative(r.created)),
      },
    ])

    process.stdout.write(table + "\n")
    process.stdout.write(
      `\n${theme.muted(`${data.length} price${data.length === 1 ? "" : "s"} · use --json for raw output`)}\n`,
    )
  })
}
