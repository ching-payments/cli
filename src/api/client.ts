import { API_BASE } from "@/config/constants"
import type { CliConfig } from "@/config/store"
import { ApiError, classifyStatus } from "./errors"

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT"
  path: string
  body?: unknown
  query?: Record<string, string | number | undefined>
  // Per-command overrides for the persisted active project / mode.
  // `null` for project means "send no X-Project-Id header" (rare).
  projectIdOverride?: number | null
  modeOverride?: "test" | "live"
  // Auth source. `cfg` is normal use; `bearer` is for the loopback flow
  // before the config is persisted (e.g. validating a freshly minted
  // token).
  cfg?: CliConfig
  bearer?: string
  // Some endpoints (e.g. DELETE /webhooks/:id) return `{ success: true }`
  // with no `data` field. Set this to false to accept that shape and
  // resolve to undefined instead of throwing "Unexpected response shape".
  expectData?: boolean
}

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: { status: number; code: string; message: string; details?: unknown }
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(API_BASE + path)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue
      url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

function authHeader(opts: RequestOptions): string | null {
  if (opts.bearer) return `Bearer ${opts.bearer}`
  if (!opts.cfg) return null
  if (opts.cfg.api_key) return `Bearer ${opts.cfg.api_key}`
  if (opts.cfg.token) return `Bearer ${opts.cfg.token}`
  return null
}

function projectHeader(opts: RequestOptions): string | null {
  if (opts.projectIdOverride !== undefined) {
    return opts.projectIdOverride === null ? null : String(opts.projectIdOverride)
  }
  if (!opts.cfg) return null
  if (opts.cfg.api_key) return null // API keys are project-scoped server-side
  return opts.cfg.active_project ? String(opts.cfg.active_project.id) : null
}

function livemodeHeader(opts: RequestOptions): string | null {
  if (opts.modeOverride) return opts.modeOverride === "live" ? "true" : "false"
  if (!opts.cfg) return null
  if (opts.cfg.api_key) return null // baked into the key
  return opts.cfg.active_mode === "live" ? "true" : "false"
}

export async function request<T>(opts: RequestOptions): Promise<T> {
  const url = buildUrl(opts.path, opts.query)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "ching-cli",
  }

  const auth = authHeader(opts)
  if (auth) headers.Authorization = auth
  const proj = projectHeader(opts)
  if (proj) headers["X-Project-Id"] = proj
  const live = livemodeHeader(opts)
  if (live !== null) headers["X-Livemode"] = live

  let res: Response
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch (err) {
    throw new ApiError({
      code: "NETWORK",
      status: null,
      message:
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Network error reaching CHING API",
    })
  }

  let parsed: ApiEnvelope<T> | null = null
  const text = await res.text()
  if (text) {
    try {
      parsed = JSON.parse(text) as ApiEnvelope<T>
    } catch {
      parsed = null
    }
  }

  if (!res.ok || (parsed && parsed.success === false)) {
    const apiErr = parsed?.error
    throw new ApiError({
      code: classifyStatus(res.status),
      status: res.status,
      message: apiErr?.message || `HTTP ${res.status}`,
      serverCode: apiErr?.code ?? null,
      details: apiErr?.details,
    })
  }

  if (opts.expectData === false) {
    if (!parsed || parsed.success !== true) {
      throw new ApiError({
        code: "UNKNOWN",
        status: res.status,
        message: "Unexpected response shape from CHING API",
      })
    }
    return undefined as T
  }

  if (!parsed || parsed.success !== true || parsed.data === undefined) {
    throw new ApiError({
      code: "UNKNOWN",
      status: res.status,
      message: "Unexpected response shape from CHING API",
    })
  }

  return parsed.data
}
