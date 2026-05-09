import { request } from "@/api/client"
import { productSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderSuccess } from "@/ui/panel"
import { parseFeature } from "@/ui/format"

interface UpdateFlags extends GlobalFlags {
  name?: string
  description?: string
  addFeature?: string[]
  clearFeatures?: boolean
  unlisted?: boolean
}

export async function productsUpdateCommand(id: string, flags: UpdateFlags): Promise<void> {
  await withCommand(flags, { mutating: true }, async (ctx) => {
    const body: Record<string, unknown> = {}
    if (flags.name !== undefined) body.name = flags.name
    if (flags.description !== undefined) body.description = flags.description
    if (flags.unlisted !== undefined) body.unlisted = flags.unlisted

    if (flags.clearFeatures) {
      body.features = []
    } else if (flags.addFeature && flags.addFeature.length) {
      // The current API replaces features wholesale on update. Fetch the
      // existing list first and append. Re-fetching is one extra hop but
      // keeps the contract honest - users expect --add-feature to add.
      const current = await request({
        path: `/products/${encodeURIComponent(id)}`,
        cfg: ctx.cfg,
        projectIdOverride: ctx.projectIdOverride,
        modeOverride: ctx.modeOverride,
      }).then((d) => productSchema.parse(d))
      const existing = current.features ?? []
      body.features = [
        ...existing.map((f) => ({ title: f.title, subtitle: f.subtitle ?? undefined })),
        ...flags.addFeature.map(parseFeature),
      ]
    }

    if (Object.keys(body).length === 0) {
      throw new Error(
        "Pass at least one of --name, --description, --add-feature, --clear-features, --unlisted",
      )
    }

    const updated = await request({
      method: "POST",
      path: `/products/${encodeURIComponent(id)}`,
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
      body,
    }).then((d) => productSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(updated, null, 2) + "\n")
      return
    }

    const out = renderSuccess({
      title: "Product updated",
      id: updated.id,
      rows: [
        { label: "Name", value: updated.name },
        { label: "Features", value: updated.features?.length ? String(updated.features.length) : null },
      ],
    })
    process.stdout.write(out + "\n")
  })
}
