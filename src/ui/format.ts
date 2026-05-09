// Formatting helpers shared across commands. Kept tiny - we don't pull
// in date-fns just to print "3d ago".

export function formatAgorot(amount: number, currency = "ils"): string {
  if (currency.toLowerCase() === "ils") {
    return `₪${(amount / 100).toFixed(2)}`
  }
  return `${amount} ${currency.toUpperCase()}`
}

export function formatRelative(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "-"
  const d = typeof input === "number" ? new Date(input * 1000) : new Date(input)
  if (Number.isNaN(d.getTime())) return "-"
  const diff = Date.now() - d.getTime()
  const sec = Math.round(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.round(day / 30)
  if (mo < 12) return `${mo}mo ago`
  const yr = Math.round(mo / 12)
  return `${yr}y ago`
}

// Strict integer parser for agorot inputs. Returns the parsed value or
// throws a CLI-friendly error explaining the format.
export function parseAgorot(raw: string): number {
  if (!/^[0-9]+$/.test(raw)) {
    if (/^[0-9]+\.[0-9]+$/.test(raw)) {
      const decimal = parseFloat(raw)
      const agorot = Math.round(decimal * 100)
      throw new Error(
        `amount is in agorot (integer). For ₪${decimal.toFixed(2)} use --amount=${agorot}.`,
      )
    }
    throw new Error("amount must be a positive integer in agorot")
  }
  const n = Number(raw)
  if (n < 0) throw new Error("amount must be non-negative")
  return n
}

// `--feature='Title|Subtitle'` → { title, subtitle? }. Subtitle optional.
export function parseFeature(raw: string): { title: string; subtitle?: string } {
  const idx = raw.indexOf("|")
  if (idx === -1) {
    const title = raw.trim()
    if (!title) throw new Error("feature title is required")
    return { title }
  }
  const title = raw.slice(0, idx).trim()
  const subtitle = raw.slice(idx + 1).trim()
  if (!title) throw new Error("feature title is required (before the |)")
  return subtitle ? { title, subtitle } : { title }
}

// `--metadata.k=v` collected by commander into ["k=v", ...].
export function parseMetadataPairs(pairs: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pair of pairs) {
    const idx = pair.indexOf("=")
    if (idx === -1) {
      throw new Error(`metadata expects key=value, got: ${pair}`)
    }
    const k = pair.slice(0, idx).trim()
    const v = pair.slice(idx + 1)
    if (!k) throw new Error("metadata key must not be empty")
    out[k] = v
  }
  return out
}
