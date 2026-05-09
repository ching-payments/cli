import { theme, symbols } from "./theme"

export interface DetailRow {
  label: string
  value: string | number | null | undefined
  // Render value in dim color (used for IDs, dates).
  dim?: boolean
  // Render value as monospace - we don't actually toggle a font in a
  // terminal, but we keep the shape so callers can opt in if we ever
  // need to.
  mono?: boolean
}

// Render a key/value detail panel.
//   PRODUCT prod_xxx
//   --------------------------------
//   Name      Acme Subscription
//   Created   3d ago
//
// Section headers passed via `sections` get a single dim divider above.
export function renderDetail(opts: {
  title: string
  id?: string
  rows: DetailRow[]
}): string {
  const lines: string[] = []
  const titleLine = opts.id
    ? `${theme.bold(opts.title.toUpperCase())} ${theme.muted(opts.id)}`
    : theme.bold(opts.title.toUpperCase())
  lines.push(titleLine)
  lines.push(theme.muted("─".repeat(48)))

  const labelWidth = Math.max(
    ...opts.rows.map((r) => r.label.length),
    8,
  )

  for (const row of opts.rows) {
    const label = theme.muted(row.label.padEnd(labelWidth))
    const value =
      row.value === null || row.value === undefined || row.value === ""
        ? theme.muted("-")
        : row.dim
          ? theme.muted(String(row.value))
          : String(row.value)
    lines.push(`${label}  ${value}`)
  }

  return lines.join("\n")
}

// Pretty success card after a create/update.
export function renderSuccess(opts: {
  title: string
  id?: string
  rows: DetailRow[]
  nextStep?: string
}): string {
  const head = `${theme.success(symbols.ok)} ${theme.bold(opts.title)}`
  const detail = renderDetail({ title: "", id: opts.id, rows: opts.rows })
    .split("\n")
    .slice(2) // drop the title + divider, we have our own head
    .join("\n")
  const next = opts.nextStep ? `\n\n${theme.muted(symbols.arrow)} ${opts.nextStep}` : ""
  return `${head}\n${detail}${next}`
}
