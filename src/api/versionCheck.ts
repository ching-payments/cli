import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { theme, symbols } from "@/ui/theme"

const PACKAGE_NAME = "@ching-payments/cli"
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`
const CACHE_DIR = path.join(os.homedir(), ".ching")
const CACHE_PATH = path.join(CACHE_DIR, "version-cache.json")
// Once per 24h. Frequent enough that "I just published a fix" reaches users
// the next day; rare enough that the npm registry isn't hit every keystroke.
const CHECK_TTL_MS = 24 * 60 * 60 * 1000
// Short network timeout so a slow/dead registry never delays a command.
// The fetch is fire-and-forget anyway, but we want it to settle quickly so
// the cache writes before the process exits.
const FETCH_TIMEOUT_MS = 2500

interface VersionCache {
  // Last version we observed from the registry. Compared against the
  // bundled `package.json` version on every run.
  latestVersion: string
  // Unix ms. We refetch when this is older than CHECK_TTL_MS.
  checkedAt: number
}

interface RegistryLatestResponse {
  version?: string
}

function readCache(): VersionCache | null {
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<VersionCache>
    if (
      typeof parsed.latestVersion !== "string" ||
      typeof parsed.checkedAt !== "number"
    ) {
      return null
    }
    return parsed as VersionCache
  } catch {
    return null
  }
}

function writeCache(cache: VersionCache): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 })
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), { mode: 0o600 })
  } catch {
    // Cache write failure is non-fatal - worst case we recheck on every run.
  }
}

/**
 * Returns 1 if a > b, -1 if a < b, 0 if equal. Handles standard semver
 * `X.Y.Z` and pre-release suffixes (`-rc.1`, `-beta.2`). Treats any version
 * with a pre-release suffix as lower than the equivalent stable release,
 * matching npm's ordering.
 */
function compareSemver(a: string, b: string): number {
  const parse = (v: string): { core: number[]; pre: string | null } => {
    const [coreRaw, pre = null] = v.split("-")
    const core = coreRaw.split(".").map((p) => Number(p))
    return { core, pre }
  }
  const av = parse(a)
  const bv = parse(b)
  for (let i = 0; i < Math.max(av.core.length, bv.core.length); i++) {
    const ai = av.core[i] ?? 0
    const bi = bv.core[i] ?? 0
    if (ai !== bi) return ai > bi ? 1 : -1
  }
  // Equal core. Stable (no pre-release) beats pre-release.
  if (av.pre === null && bv.pre !== null) return 1
  if (av.pre !== null && bv.pre === null) return -1
  if (av.pre === bv.pre) return 0
  return (av.pre ?? "") > (bv.pre ?? "") ? 1 : -1
}

async function fetchLatestVersion(): Promise<string | null> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(REGISTRY_URL, {
      headers: { Accept: "application/json", "User-Agent": "ching-cli" },
      signal: ac.signal,
    })
    if (!res.ok) return null
    const body = (await res.json()) as RegistryLatestResponse
    if (typeof body.version !== "string") return null
    return body.version
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Synchronous check against the cached registry result. Returns the new
 * version string if the user is on an older release, or null otherwise.
 * Safe to call before the command runs - never hits the network.
 */
export function getCachedUpdateAvailable(currentVersion: string): string | null {
  if (shouldSkip()) return null
  const cache = readCache()
  if (!cache) return null
  if (compareSemver(cache.latestVersion, currentVersion) > 0) {
    return cache.latestVersion
  }
  return null
}

/**
 * Fire-and-forget background fetch. Awaits the registry and rewrites the
 * cache file but never blocks the caller's exit beyond FETCH_TIMEOUT_MS.
 * Re-runs only when the cache is stale; safe to call on every command.
 */
export function maybeRefreshVersionCacheInBackground(): void {
  if (shouldSkip()) return
  const cache = readCache()
  if (cache && Date.now() - cache.checkedAt < CHECK_TTL_MS) return

  // Detach. We don't await; if the process exits first, the partial fetch
  // is harmless. node's event loop won't keep the process alive longer than
  // the user's own pending I/O because the fetch+writeCache resolve fast.
  void fetchLatestVersion().then((latestVersion) => {
    if (!latestVersion) return
    writeCache({ latestVersion, checkedAt: Date.now() })
  })
}

/**
 * Print a one-line update banner if a newer version is cached. Designed
 * to be invoked at the end of a command - it's a notice, not an error.
 * No-op in --json mode, in CI, or when there's no cache yet.
 */
export function printUpdateBannerIfAvailable(currentVersion: string, json: boolean): void {
  if (json) return
  const latest = getCachedUpdateAvailable(currentVersion)
  if (!latest) return
  process.stderr.write(
    `\n${theme.warning(symbols.bullet)} Update available: ${theme.muted(currentVersion)} → ${theme.bold(latest)}.\n` +
      `  Run ${theme.bold(`npm i -g ${PACKAGE_NAME}`)} (or your package manager's equivalent).\n`,
  )
}

function shouldSkip(): boolean {
  // Don't pollute CI logs and don't risk burning the npm registry from a
  // build matrix. Respect the common CI signals.
  if (process.env.CI === "true" || process.env.CI === "1") return true
  if (process.env.CHING_DISABLE_UPDATE_CHECK === "1") return true
  return false
}
