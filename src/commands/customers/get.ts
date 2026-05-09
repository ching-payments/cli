import { request } from "@/api/client"
import { customerSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderDetail } from "@/ui/panel"
import { formatRelative } from "@/ui/format"

export async function customersGetCommand(id: string, flags: GlobalFlags): Promise<void> {
  await withCommand(flags, { mutating: false }, async (ctx) => {
    const data = await request({
      path: `/customers/${encodeURIComponent(id)}`,
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
    }).then((d) => customerSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + "\n")
      return
    }

    const out = renderDetail({
      title: "CUSTOMER",
      id: data.id,
      rows: [
        { label: "Name", value: data.name },
        { label: "Email", value: data.email ?? null },
        { label: "Phone", value: data.phone ?? null },
        { label: "Created", value: formatRelative(data.created) },
      ],
    })
    process.stdout.write(out + "\n")
  })
}
