import chalk from "chalk"

// `CHING_CLI_TEST=1` strips color/emoji so vitest snapshots are stable.
const TEST_MODE = process.env.CHING_CLI_TEST === "1"

if (TEST_MODE) {
  // chalk@5 honors FORCE_COLOR=0 / NO_COLOR. Set programmatically so this
  // works regardless of the surrounding shell.
  ;(chalk as unknown as { level: number }).level = 0
}

export const theme = {
  // Core palette - kept narrow on purpose; deeper customization belongs
  // in tailwind, not here.
  brand: chalk.hex("#7c3aed"), // CHING violet
  primary: chalk.hex("#6366f1"),
  success: chalk.green,
  danger: chalk.red,
  warning: chalk.yellow,
  muted: chalk.dim,
  bold: chalk.bold,
  underline: chalk.underline,
  // Mode badges - red is intentional for live; we want to surprise the
  // eye when the user is one keystroke away from a real charge.
  testBadge: chalk.bgHex("#1e293b").white.bold,
  liveBadge: chalk.bgHex("#dc2626").white.bold,
}

export const symbols = {
  ok: TEST_MODE ? "v" : "✓",     // ✓
  fail: TEST_MODE ? "x" : "✗",   // ✗
  arrow: TEST_MODE ? "->" : "→", // →
  bullet: TEST_MODE ? "*" : "•", // •
}

export function modeBadge(mode: "test" | "live"): string {
  if (mode === "live") return theme.liveBadge(" LIVE ")
  return theme.testBadge(" TEST ")
}

export function brandMark(): string {
  return theme.brand.bold("CHING")
}
