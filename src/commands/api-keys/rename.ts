import * as p from "@clack/prompts"
import { request } from "@/api/client"
import { apiKeyMutationSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { parseNumericId } from "../_args"
import { theme, symbols } from "@/ui/theme"

interface RenameFlags extends GlobalFlags {
  name?: string
}

export async function apiKeysRenameCommand(id: string, flags: RenameFlags): Promise<void> {
  await withCommand(flags, { mutating: true }, async (ctx) => {
    const numericId = parseNumericId(id, "key id")
    const isTty = !!process.stdin.isTTY && !ctx.json

    let name = flags.name?.trim()
    if (!name) {
      if (!isTty) throw new Error("--name is required (no TTY for prompts)")
      const answer = await p.text({
        message: "New key name",
        validate: (v) => (v.trim() ? undefined : "Required"),
      })
      if (p.isCancel(answer)) process.exit(1)
      name = String(answer).trim()
    }

    const updated = await request({
      method: "PATCH",
      path: `/projects/current/keys/${numericId}`,
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
      body: { name },
    }).then((d) => apiKeyMutationSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(updated, null, 2) + "\n")
      return
    }

    process.stdout.write(
      `${theme.success(symbols.ok)} Renamed key ${theme.muted(String(updated.id))} to ${theme.bold(updated.name ?? name)}.\n`,
    )
  })
}
