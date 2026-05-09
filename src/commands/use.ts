import { request } from "@/api/client"
import { projectListSchema, type Project } from "@/api/schemas"
import { readConfig, requireConfig, writeConfig } from "@/config/store"
import { theme, symbols, modeBadge } from "@/ui/theme"
import { exitWithError } from "@/ui/error"

interface UseFlags {
  live?: boolean
  test?: boolean
  json?: boolean
}

function findProject(list: Project[], target: string): Project | undefined {
  // Accept either the visibleId (preferred, copy-pasted from `whoami`/`open`)
  // or the numeric primary key (advanced use). Numeric strings need the
  // exact equality check to avoid colliding with a visibleId that happens
  // to start with digits.
  const numeric = Number(target)
  if (Number.isFinite(numeric) && String(numeric) === target) {
    return list.find((p) => p.id === numeric)
  }
  return list.find((p) => p.visibleId === target)
}

export async function useCommand(targetArg: string | undefined, flags: UseFlags): Promise<void> {
  const json = !!flags.json
  const cfg = requireConfig()

  if (cfg.api_key) {
    const e = new Error(
      "API-key sessions can't switch project or mode (the key itself is bound to one). Re-run `ching login` to use the browser flow.",
    )
    exitWithError(e, { cfg, json })
    return
  }

  try {
    let next = { ...cfg }
    let changed = false

    if (flags.live && flags.test) {
      throw new Error("Pass at most one of --live or --test")
    }
    if (flags.live) {
      next = { ...next, active_mode: "live" }
      changed = true
    } else if (flags.test) {
      next = { ...next, active_mode: "test" }
      changed = true
    }

    if (targetArg) {
      const list = await request({
        path: "/projects",
        cfg,
      }).then((d) => projectListSchema.parse(d))
      const found = findProject(list, targetArg)
      if (!found) {
        const known = list.map((p) => `${p.visibleId} (${p.name})`).join(", ")
        throw new Error(
          `No project matching "${targetArg}". Available: ${known || "(none)"}`,
        )
      }
      next = {
        ...next,
        active_project: { id: found.id, visibleId: found.visibleId, name: found.name },
      }
      changed = true
    }

    if (!changed) {
      throw new Error("Pass a project id, --live, or --test")
    }

    writeConfig(next)

    if (json) {
      process.stdout.write(
        JSON.stringify({
          ok: true,
          active_project: next.active_project,
          active_mode: next.active_mode,
        }) + "\n",
      )
      return
    }

    const projLabel = next.active_project ? theme.bold(next.active_project.name) : theme.muted("(no project)")
    process.stderr.write(
      `${theme.success(symbols.ok)} Active session: ${projLabel} ${theme.muted("·")} ${modeBadge(next.active_mode)}\n`,
    )
  } catch (err) {
    exitWithError(err, { cfg: readConfig(), json })
  }
}
