import * as p from "@clack/prompts"
import { request } from "@/api/client"
import { webhookSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderSuccess } from "@/ui/panel"
import { theme, symbols } from "@/ui/theme"
import { parseEvents } from "./events"

interface CreateFlags extends GlobalFlags {
  url?: string
  events?: string[]
}

interface ResolvedInput {
  url: string
  events: string[]
}

function validateUrl(v: string): string | undefined {
  if (!v.trim()) return "Required"
  try {
    const u = new URL(v.trim())
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return "URL must start with https:// (or http:// for local testing)"
    }
    return undefined
  } catch {
    return "Invalid URL"
  }
}

async function resolveInput(flags: CreateFlags, isTty: boolean): Promise<ResolvedInput> {
  const flagEvents = parseEvents(flags.events)

  if (flags.url) {
    const urlError = validateUrl(flags.url)
    if (urlError) throw new Error(`--url: ${urlError}`)
    if (flagEvents.length === 0) {
      throw new Error("--events requires at least one event (e.g. --events charge.succeeded)")
    }
    return { url: flags.url.trim(), events: flagEvents }
  }

  if (!isTty) throw new Error("--url and --events are required (no TTY for prompts)")

  const url = await p.text({
    message: "Endpoint URL",
    placeholder: "https://example.com/webhooks/ching",
    validate: validateUrl,
  })
  if (p.isCancel(url)) process.exit(1)

  const eventsRaw = await p.text({
    message: "Events to subscribe to (comma-separated)",
    placeholder: "charge.succeeded, charge.failed",
    validate: (v) => (parseEvents(v).length > 0 ? undefined : "At least one event is required"),
  })
  if (p.isCancel(eventsRaw)) process.exit(1)

  return { url: String(url).trim(), events: parseEvents(String(eventsRaw)) }
}

export async function webhooksCreateCommand(flags: CreateFlags): Promise<void> {
  await withCommand(flags, { mutating: true }, async (ctx) => {
    const isTty = !!process.stdin.isTTY && !ctx.json
    const input = await resolveInput(flags, isTty)

    const created = await request({
      method: "POST",
      path: "/webhooks",
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
      body: { url: input.url, events: input.events },
    }).then((d) => webhookSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(created, null, 2) + "\n")
      return
    }

    const out = renderSuccess({
      title: "Webhook created",
      rows: [
        { label: "URL", value: created.url },
        { label: "Events", value: created.events.join(", ") },
        { label: "Signing secret", value: created.secret },
      ],
    })
    process.stdout.write(out + "\n")
    process.stdout.write(
      `\n${theme.warning(symbols.bullet)} ${theme.bold("Copy the signing secret now.")} ` +
        `It is shown only once and cannot be retrieved later - if you lose it you must delete and recreate the webhook.\n`,
    )
  })
}
