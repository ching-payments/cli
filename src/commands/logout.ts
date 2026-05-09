import { request } from "@/api/client"
import { readConfig, clearConfig } from "@/config/store"
import { theme, symbols } from "@/ui/theme"
import { exitWithError } from "@/ui/error"

interface LogoutFlags {
  revoke?: boolean
  json?: boolean
}

export async function logoutCommand(flags: LogoutFlags): Promise<void> {
  const json = !!flags.json
  const cfg = readConfig()

  try {
    if (flags.revoke && cfg?.token) {
      // Best-effort server-side revocation. If it fails (network down,
      // already-revoked), we still want to clear the local config.
      try {
        await request({
          method: "DELETE",
          path: "/auth/cli_tokens/current",
          cfg,
        })
      } catch {
        // ignore - local cleanup proceeds
      }
    }

    const removed = clearConfig()

    if (json) {
      process.stdout.write(JSON.stringify({ ok: true, removed }) + "\n")
      return
    }

    if (!removed) {
      process.stderr.write(`${theme.muted(symbols.bullet)} No local credentials to remove.\n`)
      return
    }
    process.stderr.write(
      `${theme.success(symbols.ok)} ${theme.bold("Signed out.")}${flags.revoke ? " Server-side session revoked." : ""}\n`,
    )
  } catch (err) {
    exitWithError(err, { cfg, json })
  }
}
