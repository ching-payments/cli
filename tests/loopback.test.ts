import { describe, it, expect } from "vitest"
import { startLoopback } from "@/auth/loopback"

describe("loopback", () => {
  it("captures token when state matches", async () => {
    const handle = await startLoopback()

    const url = `${handle.callbackUrl}?state=${encodeURIComponent(handle.state)}&token=ey.test`
    const fetchPromise = fetch(url)

    const result = await handle.result
    await fetchPromise // drain so the server can close cleanly

    expect(result.token).toBe("ey.test")
  })

  it("rejects with state mismatch", async () => {
    const handle = await startLoopback()

    const url = `${handle.callbackUrl}?state=wrong&token=ey.test`
    const fetchPromise = fetch(url)

    await expect(handle.result).rejects.toThrow(/state/)
    await fetchPromise
  })

  it("rejects on cancel", async () => {
    const handle = await startLoopback()

    const url = `${handle.callbackUrl}?state=${encodeURIComponent(handle.state)}&error=cancelled`
    const fetchPromise = fetch(url)

    await expect(handle.result).rejects.toThrow(/cancelled/)
    await fetchPromise
  })

  it("only binds 127.0.0.1", async () => {
    const handle = await startLoopback()
    const url = new URL(handle.callbackUrl)
    expect(url.hostname).toBe("127.0.0.1")
    handle.close()
    await expect(handle.result).rejects.toThrow()
  })
})
