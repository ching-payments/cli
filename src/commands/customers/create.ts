import * as p from "@clack/prompts"
import { request } from "@/api/client"
import { customerSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderSuccess } from "@/ui/panel"
import { theme } from "@/ui/theme"

interface CreateFlags extends GlobalFlags {
  email?: string
  name?: string
  phone?: string
}

interface ResolvedInput {
  email: string
  name?: string
  phone?: string
}

async function resolveInput(flags: CreateFlags, isTty: boolean): Promise<ResolvedInput> {
  if (flags.email) {
    return { email: flags.email, name: flags.name, phone: flags.phone }
  }
  if (!isTty) throw new Error("--email is required (no TTY for prompts)")

  const email = await p.text({
    message: "Customer email",
    validate: (v) => {
      if (!v.trim()) return "Required"
      if (!v.includes("@")) return "Invalid email"
      return undefined
    },
  })
  if (p.isCancel(email)) process.exit(1)

  const name = await p.text({
    message: "Customer name (optional)",
    placeholder: "Press enter to skip",
  })
  if (p.isCancel(name)) process.exit(1)

  const phone = await p.text({
    message: "Phone number (optional)",
    placeholder: "Press enter to skip",
  })
  if (p.isCancel(phone)) process.exit(1)

  return {
    email: String(email).trim(),
    name: String(name).trim() || undefined,
    phone: String(phone).trim() || undefined,
  }
}

export async function customersCreateCommand(flags: CreateFlags): Promise<void> {
  await withCommand(flags, { mutating: true }, async (ctx) => {
    const isTty = !!process.stdin.isTTY && !ctx.json
    const input = await resolveInput(flags, isTty)

    const body: Record<string, unknown> = { email: input.email }
    if (input.name) body.name = input.name
    if (input.phone) body.phone = input.phone

    const created = await request({
      method: "POST",
      path: "/customers",
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
      body,
    }).then((d) => customerSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(created, null, 2) + "\n")
      return
    }

    const out = renderSuccess({
      title: "Customer created",
      id: created.id,
      rows: [
        { label: "Name", value: created.name },
        { label: "Email", value: created.email ?? null },
        { label: "Phone", value: created.phone ?? null },
      ],
      nextStep: `Open in dashboard: ${theme.bold(`ching open customers`)}`,
    })
    process.stdout.write(out + "\n")
  })
}
