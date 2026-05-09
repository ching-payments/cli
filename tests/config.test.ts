import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

let tmpHome: string

beforeEach(async () => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "ching-cli-test-"))
  vi.spyOn(os, "homedir").mockReturnValue(tmpHome)
  vi.resetModules()
})

afterAll(() => {
  vi.restoreAllMocks()
})

describe("config store", () => {
  it("returns null when no config exists", async () => {
    const { readConfig } = await import("@/config/store")
    expect(readConfig()).toBeNull()
  })

  it("writes and reads back", async () => {
    const { writeConfig, readConfig, configPath } = await import("@/config/store")

    writeConfig({
      version: 1,
      token: "ey.test",
      user: { id: "u_1", email: "x@y.com" },
      session: { id: 7, name: "host", hostname: "host" },
      active_project: { id: 1, visibleId: "proj_x", name: "Acme" },
      active_mode: "test",
    })

    const got = readConfig()
    expect(got).not.toBeNull()
    expect(got!.token).toBe("ey.test")
    expect(got!.active_project?.name).toBe("Acme")
    expect(got!.active_mode).toBe("test")
    expect(fs.existsSync(configPath())).toBe(true)
  })

  it("writes 0600-mode file on POSIX", async () => {
    if (process.platform === "win32") return
    const { writeConfig, configPath } = await import("@/config/store")
    writeConfig({
      version: 1,
      token: "t",
      user: { id: "u", email: null },
      active_project: null,
      active_mode: "test",
    })
    const stat = fs.statSync(configPath())
    expect(stat.mode & 0o777).toBe(0o600)
  })

  it("treats malformed JSON as no-config", async () => {
    const { configPath, readConfig } = await import("@/config/store")
    fs.mkdirSync(path.dirname(configPath()), { recursive: true })
    fs.writeFileSync(configPath(), "not json")
    expect(readConfig()).toBeNull()
  })

  it("rejects unknown version", async () => {
    const { configPath, readConfig } = await import("@/config/store")
    fs.mkdirSync(path.dirname(configPath()), { recursive: true })
    fs.writeFileSync(
      configPath(),
      JSON.stringify({ version: 99, token: "t", user: { id: "u", email: null }, active_mode: "test" }),
    )
    expect(readConfig()).toBeNull()
  })

  it("clearConfig removes the file and returns true", async () => {
    const { writeConfig, clearConfig, readConfig, configPath } = await import(
      "@/config/store"
    )
    writeConfig({
      version: 1,
      token: "t",
      user: { id: "u", email: null },
      active_project: null,
      active_mode: "test",
    })
    expect(fs.existsSync(configPath())).toBe(true)
    expect(clearConfig()).toBe(true)
    expect(readConfig()).toBeNull()
  })

  it("clearConfig is a no-op when no file exists", async () => {
    const { clearConfig } = await import("@/config/store")
    expect(clearConfig()).toBe(false)
  })

  it("requireConfig throws NOT_LOGGED_IN when missing", async () => {
    const { requireConfig } = await import("@/config/store")
    expect(() => requireConfig()).toThrowError(/login/)
  })
})
