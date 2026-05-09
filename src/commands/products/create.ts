import * as p from "@clack/prompts"
import { request } from "@/api/client"
import { productSchema } from "@/api/schemas"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderSuccess } from "@/ui/panel"
import { parseFeature } from "@/ui/format"
import { theme } from "@/ui/theme"

interface CreateFlags extends GlobalFlags {
  name?: string
  description?: string
  feature?: string[]
  unlisted?: boolean
}

interface ResolvedInput {
  name: string
  description?: string
  features: { title: string; subtitle?: string }[]
  unlisted: boolean
}

async function resolveInput(flags: CreateFlags, isTty: boolean): Promise<ResolvedInput> {
  const features: { title: string; subtitle?: string }[] = []
  if (flags.feature) {
    for (const raw of flags.feature) features.push(parseFeature(raw))
  }

  if (flags.name) {
    return {
      name: flags.name,
      description: flags.description,
      features,
      unlisted: !!flags.unlisted,
    }
  }

  if (!isTty) {
    throw new Error("--name is required (no TTY for interactive prompts)")
  }

  const name = await p.text({
    message: "Product name",
    validate: (v) => (v.trim().length === 0 ? "Required" : undefined),
  })
  if (p.isCancel(name)) process.exit(1)

  const description = await p.text({
    message: "Description (optional)",
    placeholder: "Press enter to skip",
  })
  if (p.isCancel(description)) process.exit(1)

  let unlisted = !!flags.unlisted
  if (flags.unlisted === undefined) {
    const ans = await p.confirm({
      message: "Unlisted? (hidden from public catalog)",
      initialValue: false,
    })
    if (p.isCancel(ans)) process.exit(1)
    unlisted = !!ans
  }

  return {
    name: name.trim(),
    description: description.trim() ? description.trim() : undefined,
    features,
    unlisted,
  }
}

export async function productsCreateCommand(flags: CreateFlags): Promise<void> {
  await withCommand(flags, { mutating: true }, async (ctx) => {
    const isTty = !!process.stdin.isTTY && !ctx.json

    const input = await resolveInput(flags, isTty)

    const body: Record<string, unknown> = {
      name: input.name,
    }
    if (input.description) body.description = input.description
    if (input.features.length) body.features = input.features
    if (input.unlisted) body.unlisted = true

    const created = await request({
      method: "POST",
      path: "/products",
      cfg: ctx.cfg,
      projectIdOverride: ctx.projectIdOverride,
      modeOverride: ctx.modeOverride,
      body,
    }).then((d) => productSchema.parse(d))

    if (ctx.json) {
      process.stdout.write(JSON.stringify(created, null, 2) + "\n")
      return
    }

    const out = renderSuccess({
      title: "Product created",
      id: created.id,
      rows: [
        { label: "Name", value: created.name },
        { label: "Features", value: created.features?.length ? String(created.features.length) : null },
        { label: "Unlisted", value: created.unlisted ? "yes" : "no" },
      ],
      nextStep: `Add a price: ${theme.bold(`ching prices create --product=${created.id} --amount=4990`)}`,
    })
    process.stdout.write(out + "\n")
  })
}
