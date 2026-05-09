import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { SKILL_SLUG } from "../repo"
import type { Installer, InstallContext, InstallResult, InstallScope } from "./types"

// Claude Code auto-loads skills from `~/.claude/skills/<slug>/` (global) and
// from `<project>/.claude/skills/<slug>/` (project-scoped, shipped to teammates
// via the repo). Both locations accept the SKILL.md + references/ + scripts/
// layout we ship as-is - we just copy the directory.
function targetDir(scope: InstallScope, cwd: string): string {
  const root = scope === "global" ? os.homedir() : cwd
  return path.join(root, ".claude", "skills", SKILL_SLUG)
}

export const claudeInstaller: Installer = {
  id: "claude",
  label: "Claude Code",

  resolveTarget({ scope, cwd }) {
    return targetDir(scope, cwd)
  },

  detect({ scope, cwd }) {
    // We treat presence of `.claude/` as "this user uses Claude Code". For
    // project scope, this also covers shared project-level skills.
    const root = scope === "global" ? os.homedir() : cwd
    return fs.existsSync(path.join(root, ".claude"))
  },

  async install(ctx: InstallContext): Promise<InstallResult> {
    const dest = targetDir(ctx.scope, ctx.cwd)
    const overwrote = fs.existsSync(dest)

    if (overwrote && !ctx.force) {
      throw new Error(
        `Already installed at ${dest}. Re-run with --force to overwrite.`,
      )
    }

    if (overwrote) {
      fs.rmSync(dest, { recursive: true, force: true })
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true })
    copyDirRecursive(ctx.sourceDir, dest)

    return { installedPath: dest, overwrote }
  },

  async uninstall({ scope, cwd }) {
    const dest = targetDir(scope, cwd)
    if (!fs.existsSync(dest)) return false
    fs.rmSync(dest, { recursive: true, force: true })
    return true
  },
}

// Lightweight recursive copy. Avoids pulling in fs-extra; the Node 18+ API
// `fs.cpSync` exists, but it has had quirks with permissions on macOS - the
// hand-rolled walk gives us full control.
function copyDirRecursive(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const s = path.join(src, entry.name)
    const d = path.join(dst, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(s, d)
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d)
      // Preserve executable bit on scripts/*.py so users can run them
      // directly out of the install dir.
      try {
        const stat = fs.statSync(s)
        if (stat.mode & 0o100) {
          fs.chmodSync(d, stat.mode & 0o777)
        }
      } catch {
        // ignore on filesystems that reject chmod (Windows shares)
      }
    }
  }
}
