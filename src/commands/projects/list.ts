import { request } from "@/api/client"
import { projectListSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderTable } from "@/ui/table"
import { theme, symbols } from "@/ui/theme"
import { formatRelative } from "@/ui/format"

export async function projectsListCommand(flags: GlobalFlags): Promise<void> {
  await withCommand(flags, { mutating: false }, async (ctx) => {
    const data = await request({
      path: "/projects",
      cfg: ctx.cfg,
      // /projects is account-scoped, not project-scoped, so we deliberately
      // skip the X-Project-Id override and the X-Livemode header here. The
      // CLI reads them off the config to mark which row is active, but the
      // request itself returns every project the user has a role on.
      projectIdOverride: null,
    }).then((d) => projectListSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + "\n")
      return
    }

    if (data.length === 0) {
      process.stdout.write(
        `${theme.muted(symbols.bullet)} You don't have any projects yet. Create one with ${theme.bold("ching projects create --name='...'")}.\n`,
      )
      return
    }

    const activeId = ctx.cfg.active_project?.id ?? null

    const table = renderTable(data, [
      {
        header: "",
        render: (r) => (r.id === activeId ? theme.success(symbols.ok) : " "),
      },
      { header: "ID", render: (r) => theme.muted(r.visibleId) },
      { header: "Name", render: (r) => theme.bold(r.name) },
      {
        header: "Business identity",
        render: (r) => (r.businessIdentityId ? String(r.businessIdentityId) : theme.muted("-")),
      },
      {
        header: "Created",
        render: (r) => theme.muted(formatRelative(r.createdAt)),
      },
    ])

    process.stdout.write(table + "\n")
    process.stdout.write(
      `\n${theme.muted(`${data.length} project${data.length === 1 ? "" : "s"} · switch with `)}${theme.bold("ching use <id>")}\n`,
    )
  })
}
