import os from "node:os"
import * as p from "@clack/prompts"
import open from "open"
import { request } from "@/api/client"
import { meSchema, projectListSchema } from "@/api/schemas"
import { writeConfig, type CliConfig } from "@/config/store"
import { DASHBOARD_BASE } from "@/config/constants"
import { startLoopback, manualPasteHint } from "@/auth/loopback"
import { theme, brandMark, symbols, modeBadge } from "@/ui/theme"
import { exitWithError } from "@/ui/error"

interface LoginFlags {
  withKey?: boolean
  json?: boolean
}

function buildAuthorizeUrl(callbackUrl: string, state: string, hostname: string): string {
  const u = new URL("/cli/authorize", DASHBOARD_BASE)
  u.searchParams.set("cb", callbackUrl)
  u.searchParams.set("state", state)
  u.searchParams.set("hostname", hostname)
  return u.toString()
}

async function browserLogin(json: boolean): Promise<{ token: string; hostname: string }> {
  const hostname = os.hostname()
  const handle = await startLoopback()
  const authorizeUrl = buildAuthorizeUrl(handle.callbackUrl, handle.state, hostname)

  if (!json) {
    p.note(authorizeUrl, "Opening browser to authorize")
  }

  let browserOpened = true
  try {
    await open(authorizeUrl)
  } catch {
    browserOpened = false
  }

  const spinner = !json ? p.spinner() : null
  spinner?.start("Waiting for browser authorization")
  if (!browserOpened && !json) {
    process.stderr.write("\n" + manualPasteHint(authorizeUrl) + "\n")
  }

  let token: string
  try {
    const r = await handle.result
    token = r.token
  } catch (err) {
    spinner?.stop("Authorization failed", 1)
    handle.close()
    throw err
  }
  spinner?.stop("Authorized")
  return { token, hostname }
}

async function pasteKeyLogin(json: boolean): Promise<{ apiKey: string }> {
  if (json) {
    throw new Error("--with-key requires interactive terminal input. Use `ching login --with-key` from a TTY.")
  }
  const apiKey = await p.password({
    message: "Paste your API key (ck_test_... or ck_live_...)",
    validate: (v) => {
      if (!v) return "API key is required"
      if (!/^(ck|sk)_(test|live)_/.test(v)) return "Expected ck_test_* or ck_live_* key"
      return undefined
    },
  })
  if (p.isCancel(apiKey)) {
    process.exit(1)
  }
  return { apiKey }
}

export async function loginCommand(flags: LoginFlags): Promise<void> {
  const json = !!flags.json

  if (!json) {
    process.stderr.write(`${brandMark()} ${theme.muted("· sign in")}\n\n`)
  }

  try {
    let cfg: CliConfig

    if (flags.withKey) {
      const { apiKey } = await pasteKeyLogin(json)
      // Validate the key before persisting.
      const tempCfg: CliConfig = {
        version: 1,
        api_key: apiKey,
        user: { id: "", email: null },
        active_project: null,
        active_mode: apiKey.includes("_live_") ? "live" : "test",
      }
      const me = await request({
        path: "/auth/me",
        cfg: tempCfg,
      }).then((d) => meSchema.parse(d))

      cfg = {
        version: 1,
        api_key: apiKey,
        user: { id: me.id, email: me.email },
        active_project: null,
        active_mode: tempCfg.active_mode,
      }
    } else {
      const { token, hostname } = await browserLogin(json)

      // Use the freshly minted token to fetch identity + project list.
      const me = await request({
        path: "/auth/me",
        bearer: token,
      }).then((d) => meSchema.parse(d))

      const projects = await request({
        path: "/projects",
        bearer: token,
      }).then((d) => projectListSchema.parse(d))

      let activeProject: CliConfig["active_project"] = null
      if (projects.length === 1) {
        activeProject = {
          id: projects[0].id,
          visibleId: projects[0].visibleId,
          name: projects[0].name,
        }
      } else if (projects.length > 1 && !json) {
        const choice = await p.select({
          message: "Choose your active project",
          options: projects.map((proj) => ({
            value: proj.id,
            label: proj.name,
            hint: proj.visibleId,
          })),
        })
        if (p.isCancel(choice)) process.exit(1)
        const picked = projects.find((proj) => proj.id === choice)!
        activeProject = {
          id: picked.id,
          visibleId: picked.visibleId,
          name: picked.name,
        }
      } else if (projects.length > 1 && json) {
        // Pick the first deterministically; user can switch with `ching use`.
        activeProject = {
          id: projects[0].id,
          visibleId: projects[0].visibleId,
          name: projects[0].name,
        }
      }

      cfg = {
        version: 1,
        token,
        user: { id: me.id, email: me.email },
        session: { id: 0, name: hostname, hostname },
        active_project: activeProject,
        active_mode: "test",
      }
    }

    writeConfig(cfg)

    if (json) {
      process.stdout.write(
        JSON.stringify({
          ok: true,
          user: cfg.user,
          active_project: cfg.active_project,
          active_mode: cfg.active_mode,
        }) + "\n",
      )
      return
    }

    const projLabel = cfg.active_project
      ? theme.bold(cfg.active_project.name)
      : theme.muted("(no project)")
    process.stderr.write(
      `\n${theme.success(symbols.ok)} ${theme.bold("Signed in")} ${theme.muted("as")} ${theme.bold(cfg.user.email ?? cfg.user.id)} ${theme.muted("·")} ${projLabel} ${theme.muted("·")} ${modeBadge(cfg.active_mode)}\n`,
    )
    if (!cfg.active_project) {
      process.stderr.write(
        `${theme.muted(symbols.arrow)} You don't have a project yet. Create one in ${theme.underline(`${DASHBOARD_BASE}/`)}, then re-run.\n`,
      )
    }
  } catch (err) {
    exitWithError(err, { cfg: null, json })
  }
}
