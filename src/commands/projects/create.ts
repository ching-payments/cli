import * as p from "@clack/prompts"
import { request } from "@/api/client"
import { projectSchema } from "@/api/schemas"
import { writeConfig } from "@/config/store"
import { withCommand, type GlobalFlags } from "../_runner"
import { renderSuccess } from "@/ui/panel"
import { theme } from "@/ui/theme"

interface CreateFlags extends GlobalFlags {
  name?: string
  businessIdentityId?: string
  // After creation, set the new project as the active one for this CLI.
  // Defaults: true if there's no active project, false if there is.
  switch?: boolean
  noSwitch?: boolean
}

interface ResolvedInput {
  name: string
  businessIdentityId?: number
}

async function resolveInput(flags: CreateFlags, isTty: boolean): Promise<ResolvedInput> {
  if (flags.name) {
    return {
      name: flags.name,
      ...(flags.businessIdentityId
        ? { businessIdentityId: parseBusinessIdentity(flags.businessIdentityId) }
        : {}),
    }
  }
  if (!isTty) throw new Error("--name is required (no TTY for prompts)")

  const name = await p.text({
    message: "Project name",
    validate: (v) => (v.trim() ? undefined : "Required"),
  })
  if (p.isCancel(name)) process.exit(1)

  return {
    name: String(name).trim(),
    ...(flags.businessIdentityId
      ? { businessIdentityId: parseBusinessIdentity(flags.businessIdentityId) }
      : {}),
  }
}

function parseBusinessIdentity(raw: string): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("--business-identity-id must be a positive integer")
  }
  return n
}

export async function projectsCreateCommand(flags: CreateFlags): Promise<void> {
  await withCommand(flags, { mutating: true }, async (ctx) => {
    const isTty = !!process.stdin.isTTY && !ctx.json
    const input = await resolveInput(flags, isTty)

    const body: Record<string, unknown> = { name: input.name }
    if (input.businessIdentityId !== undefined) {
      body.businessIdentityId = input.businessIdentityId
    }

    const created = await request({
      method: "POST",
      path: "/projects",
      cfg: ctx.cfg,
      // Account-scoped; never send X-Project-Id (the new project does not
      // exist yet) and don't apply the active livemode either.
      projectIdOverride: null,
      body,
    }).then((d) => projectSchema.parse(d))

    // Decide whether to switch active project. Default behaviour: if the
    // user has no active project today, adopt the new one - it's almost
    // certainly what they want. Otherwise leave them on the current
    // project unless they explicitly asked to switch.
    const explicitSwitch = flags.switch === true
    const explicitNoSwitch = flags.noSwitch === true
    const adoptByDefault = !ctx.cfg.active_project
    const willSwitch = explicitNoSwitch
      ? false
      : explicitSwitch
        ? true
        : adoptByDefault

    if (willSwitch) {
      writeConfig({
        ...ctx.cfg,
        active_project: {
          id: created.id,
          visibleId: created.visibleId,
          name: created.name,
        },
      })
    }

    if (ctx.json) {
      process.stdout.write(
        JSON.stringify({ ...created, switched: willSwitch }, null, 2) + "\n",
      )
      return
    }

    const out = renderSuccess({
      title: "Project created",
      id: created.visibleId,
      rows: [
        { label: "Name", value: created.name },
        { label: "Numeric id", value: String(created.id) },
        {
          label: "Business identity",
          value: created.businessIdentityId ? String(created.businessIdentityId) : null,
        },
        { label: "Active", value: willSwitch ? "now" : "no - run `ching use` to switch" },
      ],
      nextStep: willSwitch
        ? `Add a product: ${theme.bold(`ching products create --name '...'`)}`
        : `Switch to it: ${theme.bold(`ching use ${created.visibleId}`)}`,
    })
    process.stdout.write(out + "\n")
  })
}
