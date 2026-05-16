import { request } from "@/api/client"
import { chargeSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { parseAgorot, formatAgorot } from "@/ui/format"
import { theme, symbols } from "@/ui/theme"

interface CaptureFlags extends GlobalFlags {
  amount?: string
}

/**
 * Capture a manual-capture (J4J5) hold. Designed to be called from a
 * fulfilment script - e.g. when the warehouse marks an order as packed,
 * call `ching charges capture ch_... --amount=<real_total_agorot>`.
 *
 * `--amount` is optional; when omitted, captures the full authorized amount.
 * Partial captures release the unused balance to the customer's card.
 */
export async function chargesCaptureCommand(
  id: string,
  flags: CaptureFlags,
): Promise<void> {
  await withCommand(flags, { mutating: true }, async (ctx) => {
    const body: { amount?: number } = {}
    if (flags.amount !== undefined) {
      body.amount = parseAgorot(flags.amount)
    }

    const data = await request({
      method: "POST",
      path: `/charges/${encodeURIComponent(id)}/capture`,
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
      body,
    }).then((d) => chargeSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + "\n")
      return
    }

    const captured = data.amount_captured ?? data.amount
    const currency = data.currency ?? "ils"
    process.stdout.write(
      `${theme.success(symbols.ok)} Captured ${theme.bold(formatAgorot(captured, currency))} on ${theme.muted(data.id)}\n`,
    )
    if (data.amount_captured !== null && data.amount_captured !== undefined && data.amount_captured < data.amount) {
      const released = data.amount - data.amount_captured
      process.stdout.write(
        `${theme.muted(symbols.bullet)} Released ${formatAgorot(released, currency)} back to the customer (partial capture).\n`,
      )
    }
  })
}
