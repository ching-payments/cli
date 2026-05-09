import { request } from "@/api/client"
import { productSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderDetail } from "@/ui/panel"
import { formatRelative } from "@/ui/format"
import { theme, symbols } from "@/ui/theme"

export async function productsGetCommand(id: string, flags: GlobalFlags): Promise<void> {
  await withCommand(flags, { mutating: false }, async (ctx) => {
    const data = await request({
      path: `/products/${encodeURIComponent(id)}`,
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
    }).then((d) => productSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + "\n")
      return
    }

    const out = renderDetail({
      title: "PRODUCT",
      id: data.id,
      rows: [
        { label: "Name", value: data.name },
        { label: "Description", value: data.description ?? null },
        {
          label: "Features",
          value: data.features?.length
            ? data.features.map((f) => `• ${f.title}${f.subtitle ? ` - ${f.subtitle}` : ""}`).join("\n            ")
            : null,
        },
        { label: "Unlisted", value: data.unlisted ? "yes" : "no" },
        { label: "Created", value: formatRelative(data.created) },
      ],
    })
    process.stdout.write(out + "\n\n")
    process.stdout.write(
      `${theme.muted(symbols.arrow)} Add a price: ${theme.bold(`ching prices create --product=${data.id} --amount=...`)}\n`,
    )
  })
}
