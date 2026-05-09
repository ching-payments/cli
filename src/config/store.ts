import fs from "node:fs"
import path from "node:path"
import os from "node:os"

export interface ConfigUser {
  id: string
  email: string | null
}

export interface ConfigSession {
  id: number
  name: string
  hostname: string
}

export interface ConfigProject {
  id: number
  visibleId: string
  name: string
}

export type ConfigMode = "test" | "live"

export interface CliConfig {
  version: 1
  // Either token (browser flow) OR api_key (paste-key fallback). Mutually
  // exclusive. The fetch wrapper inspects which is set to pick the right
  // header source.
  token?: string
  api_key?: string
  user: ConfigUser
  session?: ConfigSession
  active_project: ConfigProject | null
  active_mode: ConfigMode
}

const CONFIG_DIR = path.join(os.homedir(), ".ching")
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json")

export function configPath(): string {
  return CONFIG_PATH
}

export function readConfig(): CliConfig | null {
  let raw: string
  try {
    raw = fs.readFileSync(CONFIG_PATH, "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null
    throw err
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Treat malformed config as "not logged in" rather than crashing every
    // command. Re-running `ching login` overwrites it cleanly.
    return null
  }

  if (!parsed || typeof parsed !== "object") return null
  const cfg = parsed as Partial<CliConfig>

  if (cfg.version !== 1) return null
  if (!cfg.user || typeof cfg.user !== "object") return null
  if (!cfg.token && !cfg.api_key) return null
  if (cfg.active_mode !== "test" && cfg.active_mode !== "live") return null

  return cfg as CliConfig
}

export function writeConfig(cfg: CliConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  const json = JSON.stringify(cfg, null, 2)
  fs.writeFileSync(CONFIG_PATH, json, { mode: 0o600 })
  // chmod again on existing file (writeFileSync mode is only honored on
  // create on some platforms).
  try {
    fs.chmodSync(CONFIG_PATH, 0o600)
  } catch {
    // best effort - non-POSIX filesystems (e.g. Windows shares) reject this
  }
}

export function clearConfig(): boolean {
  try {
    fs.unlinkSync(CONFIG_PATH)
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false
    throw err
  }
}

export function requireConfig(): CliConfig {
  const cfg = readConfig()
  if (!cfg) {
    const e = new Error("Not signed in. Run `ching login` to get started.") as Error & { code: string }
    e.code = "NOT_LOGGED_IN"
    throw e
  }
  return cfg
}
