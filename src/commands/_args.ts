// Shared positional-argument parsing for commands that take a numeric
// resource id (webhooks, api keys). Throws a CLI-friendly error so the
// runner's error handler renders it consistently.
export function parseNumericId(raw: string, label = "id"): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return n
}
