import { request } from "@/api/client"
import { apiKeyMutationSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { parseNumericId } from "../_args"
import { theme, symbols } from "@/ui/theme"

export async function apiKeysDeleteCommand(id: string, flags: GlobalFlags): Promise<void> {
  await withCommand(flags, { mutating: true }, async (ctx) => {
    const numericId = parseNumericId(id, "key id")

    const deleted = await request({
      method: "DELETE",
      path: `/projects/current/keys/${numericId}`,
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
    }).then((d) => apiKeyMutationSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify({ ...deleted, deleted: true }, null, 2) + "\n")
      return
    }

    process.stdout.write(
      `${theme.success(symbols.ok)} Deleted key ${theme.muted(String(deleted.id))}. Any service still using it stops working immediately.\n`,
    )
  })
}
