import { describe, it, expect } from "vitest"
import { parseEvents } from "@/commands/webhooks/events"
import { parseNumericId } from "@/commands/_args"

describe("parseEvents", () => {
  it("accepts a variadic array of events", () => {
    expect(parseEvents(["charge.succeeded", "charge.failed"])).toEqual([
      "charge.succeeded",
      "charge.failed",
    ])
  })

  it("splits comma-separated values and trims", () => {
    expect(parseEvents("charge.succeeded, charge.failed")).toEqual([
      "charge.succeeded",
      "charge.failed",
    ])
  })

  it("flattens a mix of variadic and comma-separated, deduping", () => {
    expect(parseEvents(["charge.succeeded,charge.failed", "charge.succeeded"])).toEqual([
      "charge.succeeded",
      "charge.failed",
    ])
  })

  it("returns empty for undefined or blank input", () => {
    expect(parseEvents(undefined)).toEqual([])
    expect(parseEvents("")).toEqual([])
    expect(parseEvents([" , "])).toEqual([])
  })
})

describe("parseNumericId", () => {
  it("accepts positive integers", () => {
    expect(parseNumericId("42")).toBe(42)
  })

  it("rejects zero, negatives, decimals, and garbage", () => {
    expect(() => parseNumericId("0", "key id")).toThrowError(/key id/)
    expect(() => parseNumericId("-1")).toThrow()
    expect(() => parseNumericId("1.5")).toThrow()
    expect(() => parseNumericId("wh_abc")).toThrow()
  })
})
