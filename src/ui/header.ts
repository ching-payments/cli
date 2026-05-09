import type { CliConfig } from "@/config/store"
import { brandMark, modeBadge, theme, symbols } from "./theme"

export interface HeaderOptions {
  cfg: CliConfig | null
  // True for write commands (create/update/delete). The mode badge prints
  // brighter so the user notices when they're about to mutate live data.
  mutating?: boolean
  // Override of the active mode (when --live / --test passed for one call).
  mode?: "test" | "live"
}

// One-line chrome printed before every human-readable command output.
// Suppressed in --json mode by callers - they just don't call it.
export function printHeader(opts: HeaderOptions): void {
  const { cfg, mutating } = opts
  if (!cfg) {
    console.error(`${brandMark()} ${theme.muted("· not signed in")}`)
    return
  }
  const mode = opts.mode ?? cfg.active_mode
  const project = cfg.active_project
    ? cfg.active_project.name
    : "(no project)"

  const projectFmt = mutating
    ? theme.bold(project)
    : theme.muted(project)

  const sep = theme.muted(` ${symbols.bullet} `)
  console.error(`${brandMark()}${sep}${modeBadge(mode)}${sep}${projectFmt}`)
}
