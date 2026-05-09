import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import { SKILL_TARBALL_URL, SKILL_TARBALL_PREFIX } from "./repo"

export interface ExtractedSkill {
  // Absolute path to the directory containing SKILL.md, references/, scripts/.
  // The caller is responsible for cleanup via `cleanup()`.
  dir: string
  cleanup: () => void
}

// Download the public skill repo as a tar.gz and extract it to a temp dir.
// Uses the system `tar` (present on macOS/Linux/Windows 10+) to avoid a
// JS-side tar implementation in the CLI bundle.
export async function downloadSkill(): Promise<ExtractedSkill> {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ching-skill-"))
  const tarballPath = path.join(tmpRoot, "skill.tar.gz")

  let res: Response
  try {
    res = await fetch(SKILL_TARBALL_URL, {
      redirect: "follow",
      headers: { "User-Agent": "ching-cli" },
    })
  } catch (err) {
    cleanup(tmpRoot)
    throw new Error(
      `Could not reach GitHub to download the skill: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }

  if (!res.ok || !res.body) {
    cleanup(tmpRoot)
    throw new Error(
      `GitHub returned HTTP ${res.status} when fetching the skill archive. Check your network and try again.`,
    )
  }

  // Stream the tarball straight to disk - the archive is small but we still
  // avoid loading the whole thing in memory.
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(tarballPath, buf)

  await runTar(["-xzf", tarballPath, "-C", tmpRoot])

  const innerDir = path.join(tmpRoot, SKILL_TARBALL_PREFIX)
  if (!fs.existsSync(innerDir)) {
    // Defensive: the GitHub archive layout could change in the future. Find
    // the first directory that contains a SKILL.md.
    const fallback = fs
      .readdirSync(tmpRoot, { withFileTypes: true })
      .find(
        (entry) =>
          entry.isDirectory() &&
          fs.existsSync(path.join(tmpRoot, entry.name, "SKILL.md")),
      )
    if (!fallback) {
      cleanup(tmpRoot)
      throw new Error(
        "Downloaded archive did not contain SKILL.md - the upstream repo layout may have changed.",
      )
    }
    return {
      dir: path.join(tmpRoot, fallback.name),
      cleanup: () => cleanup(tmpRoot),
    }
  }

  return {
    dir: innerDir,
    cleanup: () => cleanup(tmpRoot),
  }
}

function runTar(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("tar", args, { stdio: ["ignore", "ignore", "pipe"] })
    let stderr = ""
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", (err) => {
      // Most common: `tar` not on PATH (rare on macOS/Linux, possible on
      // very old Windows). Surface a clear error so the user knows what
      // to install.
      reject(
        new Error(
          `Could not run \`tar\`: ${err.message}. Please install GNU tar or BSD tar.`,
        ),
      )
    })
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`tar exited with code ${code}: ${stderr.trim()}`))
    })
  })
}

function cleanup(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // best-effort cleanup; the OS will reap /tmp eventually
  }
}
