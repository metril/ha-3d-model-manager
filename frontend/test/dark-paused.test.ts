import { describe, expect, it } from "vitest";
import { pausedSeconds } from "../src/dark/logic/paused.ts";

describe("pausedSeconds", () => {
  const now = Date.parse("2026-10-30T10:10:00Z");
  it("computes from last_changed", () => {
    expect(pausedSeconds({ last_changed: "2026-10-30T10:00:00Z" }, now)).toBe(600);
  });
  it("is 0 for missing, invalid or future values", () => {
    expect(pausedSeconds(undefined, now)).toBe(0);
    expect(pausedSeconds({ last_changed: "x" }, now)).toBe(0);
    expect(pausedSeconds({ last_changed: "2026-10-30T11:00:00Z" }, now)).toBe(0);
  });
});

describe("pausedSeconds paused_at", () => {
  const now = Date.parse("2026-10-30T10:10:00Z");
  it("prefers attributes.paused_at over last_changed", () => {
    const e = { last_changed: "2026-10-30T10:05:00Z", attributes: { paused_at: "2026-10-30T10:00:00Z" } };
    expect(pausedSeconds(e, now)).toBe(600);
  });
  it("falls back to last_changed when paused_at is null or invalid", () => {
    expect(pausedSeconds({ last_changed: "2026-10-30T10:05:00Z", attributes: { paused_at: null } }, now)).toBe(300);
    expect(pausedSeconds({ last_changed: "2026-10-30T10:05:00Z", attributes: { paused_at: "bad" } }, now)).toBe(300);
  });
});
