import { request } from "@/api/client"
import { chargeSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { theme, symbols } from "@/ui/theme"

interface CancelFlags extends GlobalFlags {
  reason?: string
}

const ALLOWED_REASONS = ["requested_by_customer", "fraudulent", "abandoned"] as const

/**
 * Cancel (void) a manual-capture (J4J5) hold. CHING-side release is
 * immediate; the customer's bank may take up to 10 days to remove the
 * hold from their available balance (Grow's auto-release window).
 */
export async function chargesCancelCommand(
  id: string,
  flags: CancelFlags,
): Promise<void> {
  await withCommand(flags, { mutating: true }, async (ctx) => {
    const body: { cancellation_reason?: string } = {}
    if (flags.reason !== undefined) {
      if (!(ALLOWED_REASONS as readonly string[]).includes(flags.reason)) {
        throw new Error(
          `--reason must be one of: ${ALLOWED_REASONS.join(", ")}`,
        )
      }
      body.cancellation_reason = flags.reason
    }

    const data = await request({
      method: "POST",
      path: `/charges/${encodeURIComponent(id)}/cancel`,
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
      body,
    }).then((d) => chargeSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + "\n")
      return
    }

    process.stdout.write(
      `${theme.success(symbols.ok)} Canceled ${theme.muted(data.id)} (reason: ${data.cancellation_reason ?? "requested_by_customer"}).\n`,
    )
    process.stdout.write(
      `${theme.muted(symbols.bullet)} The customer's bank may take up to 10 days to release the hold from their available balance.\n`,
    )
  })
}
