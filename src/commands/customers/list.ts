import { request } from "@/api/client"
import { customerListSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderTable } from "@/ui/table"
import { theme, symbols } from "@/ui/theme"
import { formatRelative } from "@/ui/format"

interface ListFlags extends GlobalFlags {
  limit?: string
}

export async function customersListCommand(flags: ListFlags): Promise<void> {
  await withCommand(flags, { mutating: false }, async (ctx) => {
    const limit = flags.limit ? Number(flags.limit) : undefined
    if (limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
      throw new Error("--limit must be a positive integer")
    }

    const data = await request({
      path: "/customers",
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
      query: { limit },
    }).then((d) => customerListSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + "\n")
      return
    }

    if (data.length === 0) {
      process.stdout.write(
        `${theme.muted(symbols.bullet)} No customers yet. Create one with ${theme.bold("ching customers create --email='you@example.com'")}.\n`,
      )
      return
    }

    const table = renderTable(data, [
      { header: "ID", render: (r) => theme.muted(r.id) },
      { header: "Name", render: (r) => theme.bold(r.name) },
      { header: "Email", render: (r) => r.email ?? "-" },
      { header: "Phone", render: (r) => r.phone ?? "-" },
      { header: "Created", render: (r) => theme.muted(formatRelative(r.created)) },
    ])

    process.stdout.write(table + "\n")
    process.stdout.write(
      `\n${theme.muted(`${data.length} customer${data.length === 1 ? "" : "s"} · use --json for raw output`)}\n`,
    )
  })
}
