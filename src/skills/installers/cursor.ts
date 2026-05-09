import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { SKILL_REPO } from "../repo"
import type { Installer, InstallContext, InstallResult, InstallScope } from "./types"

// Cursor stores rules at:
//   - global:  ~/.cursor/rules/<name>.mdc
//   - project: <project>/.cursor/rules/<name>.mdc
// .mdc is markdown with a small frontmatter block. Cursor uses
// `description`/`globs`/`alwaysApply`, not Anthropic's `name`/`license`,
// so we re-emit the frontmatter rather than copying SKILL.md verbatim.
//
// We also inline the SKILL.md body into the rule. Cursor doesn't support
// references/ subfiles the way Anthropic skills do, so we add a one-line
// pointer at the top so the model can fetch them on demand.
const RULE_FILENAME = "ching-payments.mdc"

function targetFile(scope: InstallScope, cwd: string): string {
  const root = scope === "global" ? os.homedir() : cwd
  return path.join(root, ".cursor", "rules", RULE_FILENAME)
}

export const cursorInstaller: Installer = {
  id: "cursor",
  label: "Cursor",

  resolveTarget({ scope, cwd }) {
    return targetFile(scope, cwd)
  },

  detect({ scope, cwd }) {
    const root = scope === "global" ? os.homedir() : cwd
    return fs.existsSync(path.join(root, ".cursor"))
  },

  async install(ctx: InstallContext): Promise<InstallResult> {
    const dest = targetFile(ctx.scope, ctx.cwd)
    const overwrote = fs.existsSync(dest)

    if (overwrote && !ctx.force) {
      throw new Error(
        `Already installed at ${dest}. Re-run with --force to overwrite.`,
      )
    }

    const skillMd = readSkillBody(ctx.sourceDir)
    const rule = buildCursorRule(skillMd)

    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, rule, "utf8")

    return { installedPath: dest, overwrote }
  },

  async uninstall({ scope, cwd }) {
    const dest = targetFile(scope, cwd)
    if (!fs.existsSync(dest)) return false
    fs.rmSync(dest)
    return true
  },
}

// Strip the YAML frontmatter from SKILL.md and return only the markdown
// body. The body is what we want to feed to Cursor.
function readSkillBody(sourceDir: string): { description: string; body: string } {
  const raw = fs.readFileSync(path.join(sourceDir, "SKILL.md"), "utf8")
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw)
  if (!match) {
    return { description: "", body: raw }
  }
  const [, frontmatter, body] = match
  const desc = parseSimpleYamlMultiline(frontmatter, "description")
  return { description: desc, body }
}

// Cursor rule files use this trio:
//   description  - short hint shown in Cursor's UI
//   globs        - empty (we want this on by default for everything)
//   alwaysApply  - false (Cursor decides based on description match)
function buildCursorRule(skill: { description: string; body: string }): string {
  const desc = skill.description.trim().replace(/\n+/g, " ").slice(0, 240)
  return [
    "---",
    `description: ${JSON.stringify(desc || "CHING payments integration guide.")}`,
    "globs:",
    "alwaysApply: false",
    "---",
    "",
    `> Source: https://github.com/${SKILL_REPO} - run \`ching skills install\` to refresh.`,
    "",
    skill.body.trim(),
    "",
  ].join("\n")
}

// Tiny YAML extractor for the `description: >- multiline string` shape used
// in the upstream SKILL.md. We do not need a full parser - just one field.
function parseSimpleYamlMultiline(yaml: string, key: string): string {
  const lines = yaml.split("\n")
  const idx = lines.findIndex((l) => l.startsWith(`${key}:`))
  if (idx === -1) return ""

  const head = lines[idx].slice(key.length + 1).trim()
  if (head && head !== ">-" && head !== ">" && head !== "|") {
    // single-line value
    return stripYamlString(head)
  }

  // Block scalar - take subsequent indented lines until we hit one that
  // isn't indented (next top-level key) or end of input.
  const out: string[] = []
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!/^\s/.test(line) && line.trim() !== "") break
    out.push(line.trim())
  }
  return out.join(" ").trim()
}

function stripYamlString(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
}
