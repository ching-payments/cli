// Distinct error codes the CLI maps every API failure into. Commands
// catch ApiError and the error renderer (ui/error.ts) chooses copy +
// exit code based on `code`.

export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "RATE_LIMIT"
  | "SERVER"
  | "NETWORK"
  | "UNKNOWN"

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number | null
  readonly serverCode: string | null
  readonly details: unknown

  constructor(opts: {
    code: ApiErrorCode
    status: number | null
    message: string
    serverCode?: string | null
    details?: unknown
  }) {
    super(opts.message)
    this.code = opts.code
    this.status = opts.status
    this.serverCode = opts.serverCode ?? null
    this.details = opts.details
  }
}

export function classifyStatus(status: number): ApiErrorCode {
  if (status === 401 || status === 403) {
    return status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN"
  }
  if (status === 404) return "NOT_FOUND"
  if (status === 429) return "RATE_LIMIT"
  if (status >= 500) return "SERVER"
  return "VALIDATION"
}
