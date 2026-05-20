import * as p from "@clack/prompts"
import { request } from "@/api/client"
import { apiKeySchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderSuccess } from "@/ui/panel"
import { theme, symbols, modeBadge } from "@/ui/theme"

interface CreateFlags extends GlobalFlags {
  name?: string
}

export async function apiKeysCreateCommand(flags: CreateFlags): Promise<void> {
  await withCommand(flags, { mutating: true }, async (ctx) => {
    // Creating a key stamps the owning user onto it, so the server needs a
    // real user session. API-key auth has no user -> it would 401. Catch it
    // here with an actionable message instead of a raw error.
    if (ctx.cfg.api_key) {
      throw new Error(
        "Creating API keys requires a browser session. Run `ching login` (without --with-key) first.",
      )
    }

    const isTty = !!process.stdin.isTTY && !ctx.json

    let name = flags.name?.trim()
    if (!name && isTty) {
      const answer = await p.text({
        message: "Key name (optional)",
        placeholder: "Press enter to skip",
      })
      if (p.isCancel(answer)) process.exit(1)
      name = String(answer).trim() || undefined
    }

    const livemode = ctx.effectiveMode === "live"

    const body: Record<string, unknown> = { livemode }
    if (name) body.name = name

    const created = await request({
      method: "POST",
      path: "/projects/current/keys",
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
      body,
    }).then((d) => apiKeySchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(created, null, 2) + "\n")
      return
    }

    const out = renderSuccess({
      title: "API key created",
      id: String(created.id),
      rows: [
        { label: "Name", value: created.name ?? null },
        { label: "Mode", value: created.livemode ? "live" : "test" },
        { label: "Key", value: created.key },
      ],
    })
    process.stdout.write(out + "\n")
    process.stdout.write(
      `\n${theme.warning(symbols.bullet)} ${theme.bold("Copy this key now.")} ` +
        `It is shown only once and cannot be retrieved later - if you lose it you must delete and create a new one.\n`,
    )
    if (created.livemode) {
      process.stdout.write(
        `${theme.muted(symbols.bullet)} This is a ${modeBadge("live")} key - it moves real money.\n`,
      )
    }
  })
}
