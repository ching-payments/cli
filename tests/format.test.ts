import { describe, it, expect } from "vitest"
import {
  parseAgorot,
  parseFeature,
  parseMetadataPairs,
  formatAgorot,
  formatRelative,
} from "@/ui/format"

describe("parseAgorot", () => {
  it("accepts positive integers", () => {
    expect(parseAgorot("4990")).toBe(4990)
    expect(parseAgorot("0")).toBe(0)
  })

  it("rejects decimals with a clear conversion hint", () => {
    expect(() => parseAgorot("49.90")).toThrowError(/--amount=4990/)
  })

  it("rejects garbage", () => {
    expect(() => parseAgorot("forty-nine")).toThrow()
    expect(() => parseAgorot("")).toThrow()
    expect(() => parseAgorot("-100")).toThrow()
  })
})

describe("parseFeature", () => {
  it("parses title and subtitle", () => {
    expect(parseFeature("Unlimited|All channels")).toEqual({
      title: "Unlimited",
      subtitle: "All channels",
    })
  })

  it("returns just title when no separator", () => {
    expect(parseFeature("Solo")).toEqual({ title: "Solo" })
  })

  it("trims whitespace around both halves", () => {
    expect(parseFeature("  Title  |  Sub  ")).toEqual({ title: "Title", subtitle: "Sub" })
  })

  it("treats empty subtitle as missing", () => {
    expect(parseFeature("Title|")).toEqual({ title: "Title" })
  })

  it("rejects empty title", () => {
    expect(() => parseFeature("")).toThrow()
    expect(() => parseFeature("|sub")).toThrow()
  })
})

describe("parseMetadataPairs", () => {
  it("collects multiple key=value pairs", () => {
    expect(parseMetadataPairs(["a=1", "b=two", "c="])).toEqual({
      a: "1",
      b: "two",
      c: "",
    })
  })

  it("rejects pairs without =", () => {
    expect(() => parseMetadataPairs(["nope"])).toThrow()
  })
})

describe("formatAgorot", () => {
  it("formats ils with shekel sign", () => {
    expect(formatAgorot(4990)).toBe("₪49.90")
    expect(formatAgorot(0)).toBe("₪0.00")
  })

  it("falls back for other currencies", () => {
    expect(formatAgorot(100, "usd")).toBe("100 USD")
  })
})

describe("formatRelative", () => {
  it("returns - for null/undefined", () => {
    expect(formatRelative(null)).toBe("-")
    expect(formatRelative(undefined)).toBe("-")
  })

  it("handles seconds, minutes, hours", () => {
    const now = new Date()
    const minus30s = new Date(now.getTime() - 30 * 1000).toISOString()
    expect(formatRelative(minus30s)).toMatch(/^\d+s ago$/)
  })

  it("returns - for invalid input", () => {
    expect(formatRelative("not a date")).toBe("-")
  })
})
