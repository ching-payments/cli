import Table from "cli-table3"
import { theme } from "./theme"

export interface ColumnDef<T> {
  header: string
  // Cell renderer. Return value goes through `String()` so it can include
  // pre-formatted ANSI escapes from theme.* helpers.
  render: (row: T) => string | number | null | undefined
  align?: "left" | "right" | "center"
  // Hide the column entirely - useful when a flag (e.g. --product) makes
  // a column redundant.
  hide?: boolean
}

export function renderTable<T>(rows: T[], columns: ColumnDef<T>[]): string {
  const visible = columns.filter((c) => !c.hide)
  const t = new Table({
    head: visible.map((c) => theme.muted(c.header.toUpperCase())),
    style: {
      head: [],
      border: [],
      "padding-left": 1,
      "padding-right": 1,
    },
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "┌",
      "top-right": "┐",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "└",
      "bottom-right": "┘",
      left: "│",
      "left-mid": "├",
      mid: "─",
      "mid-mid": "┼",
      right: "│",
      "right-mid": "┤",
      middle: "│",
    },
    colAligns: visible.map((c) => c.align ?? "left"),
  }) as InstanceType<typeof Table> & { push: (row: string[]) => void }

  for (const row of rows) {
    t.push(
      visible.map((c) => {
        const v = c.render(row)
        if (v === null || v === undefined) return theme.muted("-")
        return String(v)
      }),
    )
  }

  return t.toString()
}
