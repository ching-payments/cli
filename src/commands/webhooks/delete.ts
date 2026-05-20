import { request } from "@/api/client"
import { withCommand, type GlobalFlags } from "../_runner"
import { parseNumericId } from "../_args"
import { theme, symbols } from "@/ui/theme"

export async function webhooksDeleteCommand(id: string, flags: GlobalFlags): Promise<void> {
  await withCommand(flags, { mutating: true }, async (ctx) => {
    const numericId = parseNumericId(id, "webhook id")

    await request({
      method: "DELETE",
      path: `/webhooks/${numericId}`,
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
      // DELETE /webhooks/:id returns `{ success: true }` with no data.
      expectData: false,
    })

    if (ctx.json) {
      process.stdout.write(JSON.stringify({ id: numericId, deleted: true }, null, 2) + "\n")
      return
    }

    process.stdout.write(
      `${theme.success(symbols.ok)} Deleted webhook ${theme.muted(String(numericId))}. CHING will stop sending events to it immediately.\n`,
    )
  })
}
