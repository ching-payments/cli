import open from "open"
import { DASHBOARD_BASE } from "@/config/constants"
import { theme, symbols } from "@/ui/theme"
import { exitWithError } from "@/ui/error"
import { readConfig } from "@/config/store"

const PAGE_PATHS: Record<string, string> = {
  dashboard: "/",
  home: "/",
  products: "/products",
  prices: "/products", // prices live under products in dashboard
  customers: "/customers",
  charges: "/charges",
  refunds: "/refunds",
  subscriptions: "/subscriptions",
  documents: "/documents",
  webhooks: "/webhooks",
  "api-keys": "/api-keys",
  apikeys: "/api-keys",
  sessions: "/api-keys",
  settings: "/settings",
  billing: "/settings/billing",
}

interface OpenFlags {
  json?: boolean
}

export async function openCommand(pageArg: string | undefined, flags: OpenFlags): Promise<void> {
  const json = !!flags.json
  const key = (pageArg || "dashboard").toLowerCase()
  const path = PAGE_PATHS[key]
  if (!path) {
    const available = Object.keys(PAGE_PATHS).filter((k) => k !== "home" && k !== "apikeys").join(", ")
    exitWithError(new Error(`Unknown page "${pageArg}". Try one of: ${available}`), {
      cfg: readConfig(),
      json,
    })
    return
  }

  const url = `${DASHBOARD_BASE}${path}`

  try {
    await open(url)
    if (json) {
      process.stdout.write(JSON.stringify({ ok: true, url }) + "\n")
      return
    }
    process.stderr.write(`${theme.success(symbols.ok)} Opening ${theme.underline(url)}\n`)
  } catch (err) {
    exitWithError(err, { cfg: readConfig(), json })
  }
}
