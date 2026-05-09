import * as p from "@clack/prompts"
import { readConfig, requireConfig, type CliConfig } from "@/config/store"
import { printHeader } from "@/ui/header"
import { exitWithError } from "@/ui/error"

export interface GlobalFlags {
  json?: boolean
  project?: string
  live?: boolean
  test?: boolean
  yes?: boolean
}

export interface CommandContext {
  cfg: CliConfig
  json: boolean
  // Effective project ID for this single command (after --project override).
  projectIdOverride: number | null | undefined
  // Effective mode for this single command (after --live/--test override).
  modeOverride: "test" | "live" | undefined
  effectiveMode: "test" | "live"
  // Whether this command writes (printed mode badge gets bold + live writes
  // get a confirm prompt).
  mutating: boolean
  // True if the --yes flag was passed (skip live-write confirms).
  yes: boolean
}

export async function withCommand<T>(
  flags: GlobalFlags,
  opts: {
    mutating?: boolean
    // Whether to print the brand chrome line before the command runs.
    printHeader?: boolean
  },
  fn: (ctx: CommandContext) => Promise<T>,
): Promise<T> {
  const json = !!flags.json
  let cfg: CliConfig
  try {
    cfg = requireConfig()
  } catch (err) {
    exitWithError(err, { cfg: null, json })
  }

  const projectIdOverride = flags.project !== undefined ? parseInt(flags.project, 10) : undefined
  if (projectIdOverride !== undefined && Number.isNaN(projectIdOverride)) {
    exitWithError(new Error("--project expects a numeric project id"), { cfg, json })
  }

  const modeOverride: "test" | "live" | undefined = flags.live ? "live" : flags.test ? "test" : undefined
  const effectiveMode: "test" | "live" = modeOverride ?? cfg.active_mode

  const mutating = !!opts.mutating

  const isTty = !json && process.stdin.isTTY && process.stdout.isTTY

  if (mutating && effectiveMode === "live" && !flags.yes && isTty) {
    const project = cfg.active_project?.name ?? "(unknown project)"
    const proceed = await p.confirm({
      message: `You are about to perform a LIVE write on ${project}. Continue?`,
      initialValue: false,
    })
    if (p.isCancel(proceed) || !proceed) {
      process.stderr.write("Cancelled.\n")
      process.exit(1)
    }
  }

  if (opts.printHeader !== false && !json) {
    printHeader({ cfg, mutating, mode: effectiveMode })
  }

  const ctx: CommandContext = {
    cfg,
    json,
    projectIdOverride,
    modeOverride,
    effectiveMode,
    mutating,
    yes: !!flags.yes,
  }

  try {
    return await fn(ctx)
  } catch (err) {
    exitWithError(err, { cfg, json, mode: effectiveMode })
  }
}

// Simple helper for commands that just need to read the config without
// the chrome (e.g. version, help fallbacks).
export function maybeConfig(): CliConfig | null {
  return readConfig()
}
