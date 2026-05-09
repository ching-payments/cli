import { readConfig } from "@/config/store"
import { brandMark, modeBadge, theme, symbols } from "@/ui/theme"
import { renderDetail } from "@/ui/panel"

interface WhoamiFlags {
  json?: boolean
}

function maskToken(token: string): string {
  if (token.length < 12) return "***"
  return `${token.slice(0, 6)}...${token.slice(-4)}`
}

export async function whoamiCommand(flags: WhoamiFlags): Promise<void> {
  const cfg = readConfig()
  const json = !!flags.json

  if (!cfg) {
    if (json) {
      process.stdout.write(JSON.stringify({ ok: false, signed_in: false }) + "\n")
      return
    }
    process.stderr.write(
      `${theme.muted(symbols.bullet)} Not signed in. Run ${theme.bold("ching login")} to get started.\n`,
    )
    process.exit(1)
  }

  if (json) {
    process.stdout.write(
      JSON.stringify({
        ok: true,
        signed_in: true,
        user: cfg.user,
        active_project: cfg.active_project,
        active_mode: cfg.active_mode,
        session: cfg.session ?? null,
        auth_kind: cfg.api_key ? "api_key" : "cli_token",
      }) + "\n",
    )
    return
  }

  const credSource = cfg.api_key
    ? `${theme.muted("api key")} ${theme.bold(maskToken(cfg.api_key))}`
    : cfg.token
      ? `${theme.muted("CLI session")} ${theme.bold(cfg.session?.name ?? "")}`
      : ""

  const out = renderDetail({
    title: `${brandMark()} session`,
    rows: [
      { label: "User", value: cfg.user.email ?? cfg.user.id },
      {
        label: "Project",
        value: cfg.active_project ? `${cfg.active_project.name}` : null,
      },
      {
        label: "Project ID",
        value: cfg.active_project ? cfg.active_project.visibleId : null,
        dim: true,
      },
      { label: "Mode", value: modeBadge(cfg.active_mode) },
      { label: "Auth", value: credSource },
    ],
  })

  process.stdout.write(out + "\n")
}
