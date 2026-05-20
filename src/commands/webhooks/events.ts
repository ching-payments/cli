// `--events charge.succeeded charge.failed` (variadic) or
// `--events 'charge.succeeded,charge.failed'` (comma-separated) - both
// flatten to a deduped, trimmed list. The backend requires at least one.
export function parseEvents(raw: string[] | string | undefined): string[] {
  if (raw === undefined) return []
  const parts = Array.isArray(raw) ? raw : [raw]
  const events = parts
    .flatMap((p) => p.split(","))
    .map((e) => e.trim())
    .filter((e) => e.length > 0)
  return [...new Set(events)]
}
