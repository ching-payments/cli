import { ApiError } from "@/api/errors"
import type { CliConfig } from "@/config/store"
import { theme, symbols } from "./theme"

export interface ErrorContext {
  cfg: CliConfig | null
  json: boolean
  mode?: "test" | "live"
}

interface RenderedError {
  exitCode: number
  // Lines printed to stderr.
  stderr: string
}

function modeLabel(ctx: ErrorContext): string {
  const m = ctx.mode ?? ctx.cfg?.active_mode ?? "test"
  return m === "live" ? "LIVE" : "TEST"
}

function projectLabel(ctx: ErrorContext): string {
  return ctx.cfg?.active_project?.name ?? "(no project)"
}

function renderApiError(e: ApiError, ctx: ErrorContext): RenderedError {
  if (ctx.json) {
    return {
      exitCode: 1,
      stderr: JSON.stringify({
        error: {
          code: e.code,
          status: e.status,
          serverCode: e.serverCode,
          message: e.message,
          details: e.details,
        },
      }),
    }
  }

  let title = e.message
  let hint: string | null = null

  switch (e.code) {
    case "AUTH_REQUIRED":
      title = "Your CLI session has been revoked or expired."
      hint = `Run ${theme.bold("ching login")} to sign in again.`
      break
    case "FORBIDDEN":
      title = `You don't have access to project ${theme.bold(projectLabel(ctx))} in ${theme.bold(modeLabel(ctx))} mode.`
      hint = `Try ${theme.bold("ching use <project>")} or check the dashboard.`
      break
    case "NOT_FOUND":
      title = `${e.message} (project ${theme.bold(projectLabel(ctx))}, mode ${theme.bold(modeLabel(ctx))})`
      break
    case "VALIDATION":
      title = e.message
      if (e.details && typeof e.details === "object") {
        hint = JSON.stringify(e.details, null, 2)
      }
      break
    case "RATE_LIMIT":
      title = "Rate limited by CHING API."
      hint = "Wait a moment and try again."
      break
    case "SERVER":
      title = `CHING API error (HTTP ${e.status}).`
      hint = "If this keeps happening, contact support."
      break
    case "NETWORK":
      title = e.message
      hint = "Check your internet connection."
      break
    case "UNKNOWN":
    default:
      break
  }

  const lines = [
    `${theme.danger(symbols.fail)} ${theme.bold(title)}`,
  ]
  if (hint) lines.push(`  ${theme.muted(hint)}`)
  return { exitCode: 1, stderr: lines.join("\n") }
}

export function renderError(err: unknown, ctx: ErrorContext): RenderedError {
  if (err instanceof ApiError) return renderApiError(err, ctx)

  const message = err instanceof Error ? err.message : String(err)
  const code = (err as { code?: string } | null)?.code

  if (code === "NOT_LOGGED_IN") {
    if (ctx.json) {
      return {
        exitCode: 1,
        stderr: JSON.stringify({ error: { code: "NOT_LOGGED_IN", message } }),
      }
    }
    return {
      exitCode: 1,
      stderr: `${theme.danger(symbols.fail)} ${theme.bold(message)}`,
    }
  }

  if (ctx.json) {
    return {
      exitCode: 1,
      stderr: JSON.stringify({ error: { code: "UNKNOWN", message } }),
    }
  }
  return {
    exitCode: 1,
    stderr: `${theme.danger(symbols.fail)} ${theme.bold(message)}`,
  }
}

export function exitWithError(err: unknown, ctx: ErrorContext): never {
  const r = renderError(err, ctx)
  process.stderr.write(r.stderr + "\n")
  process.exit(r.exitCode)
}
