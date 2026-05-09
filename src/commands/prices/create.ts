import * as p from "@clack/prompts"
import { request } from "@/api/client"
import { priceSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderSuccess } from "@/ui/panel"
import { parseAgorot, formatAgorot } from "@/ui/format"
import { theme } from "@/ui/theme"

interface CreateFlags extends GlobalFlags {
  product?: string
  amount?: string
  currency?: string
  type?: string
  interval?: string
  intervalCount?: string
  trialDays?: string
  taxMode?: string
}

interface ResolvedInput {
  product: string
  unit_amount: number
  currency: string
  type: string
  recurring?: {
    interval: string
    interval_count: number
    trial_period_days?: number
  }
  tax_mode?: string
}

const VALID_INTERVALS = ["day", "week", "month", "year"]
const VALID_TAX_MODES = ["inclusive", "exclusive"]

async function resolveInput(flags: CreateFlags, isTty: boolean): Promise<ResolvedInput> {
  const product = flags.product ?? (await promptText(isTty, "Product ID (prod_...)", true))
  const amountStr = flags.amount ?? (await promptText(isTty, "Amount in agorot (e.g. 4990 = ₪49.90)", true))
  const unit_amount = parseAgorot(amountStr)
  const currency = (flags.currency ?? "ils").toLowerCase()

  let type = flags.type
  if (!type) {
    if (!isTty) throw new Error("--type is required (one_time | recurring)")
    const t = await p.select({
      message: "Price type",
      options: [
        { value: "one_time", label: "One-time" },
        { value: "recurring", label: "Recurring (subscription)" },
      ],
    })
    if (p.isCancel(t)) process.exit(1)
    type = String(t)
  }

  let recurring: ResolvedInput["recurring"] | undefined
  if (type === "recurring") {
    let interval = flags.interval
    if (!interval) {
      if (!isTty) throw new Error("--interval is required for recurring prices")
      const r = await p.select({
        message: "Billing interval",
        options: VALID_INTERVALS.map((v) => ({ value: v, label: v })),
      })
      if (p.isCancel(r)) process.exit(1)
      interval = String(r)
    }
    if (!VALID_INTERVALS.includes(interval)) {
      throw new Error(`--interval must be one of: ${VALID_INTERVALS.join(", ")}`)
    }
    const intervalCount = flags.intervalCount ? Number(flags.intervalCount) : 1
    if (!Number.isInteger(intervalCount) || intervalCount < 1) {
      throw new Error("--interval-count must be a positive integer")
    }
    const trialDays = flags.trialDays ? Number(flags.trialDays) : undefined
    if (trialDays !== undefined && (!Number.isInteger(trialDays) || trialDays < 0)) {
      throw new Error("--trial-days must be a non-negative integer")
    }
    recurring = {
      interval,
      interval_count: intervalCount,
      ...(trialDays !== undefined ? { trial_period_days: trialDays } : {}),
    }
  }

  if (flags.taxMode && !VALID_TAX_MODES.includes(flags.taxMode)) {
    throw new Error(`--tax-mode must be one of: ${VALID_TAX_MODES.join(", ")}`)
  }

  return {
    product,
    unit_amount,
    currency,
    type,
    ...(recurring ? { recurring } : {}),
    ...(flags.taxMode ? { tax_mode: flags.taxMode } : {}),
  }
}

async function promptText(isTty: boolean, message: string, required: boolean): Promise<string> {
  if (!isTty) throw new Error(`Missing required flag (no TTY for prompt): ${message}`)
  const v = await p.text({
    message,
    validate: required ? (s) => (s.trim() ? undefined : "Required") : undefined,
  })
  if (p.isCancel(v)) process.exit(1)
  return String(v).trim()
}

export async function pricesCreateCommand(flags: CreateFlags): Promise<void> {
  await withCommand(flags, { mutating: true }, async (ctx) => {
    const isTty = !!process.stdin.isTTY && !ctx.json
    const input = await resolveInput(flags, isTty)

    const created = await request({
      method: "POST",
      path: "/prices",
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
      body: input,
    }).then((d) => priceSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(created, null, 2) + "\n")
      return
    }

    const out = renderSuccess({
      title: "Price created",
      id: created.id,
      rows: [
        { label: "Product", value: created.product },
        { label: "Amount", value: formatAgorot(created.unit_amount, created.currency ?? "ils") },
        { label: "Type", value: created.type ?? "-" },
        {
          label: "Recurring",
          value: created.recurring
            ? `every ${created.recurring.interval_count ?? 1} ${created.recurring.interval}`
            : "one-time",
        },
      ],
      nextStep: `View it: ${theme.bold(`ching prices get ${created.id}`)}`,
    })
    process.stdout.write(out + "\n")
  })
}
