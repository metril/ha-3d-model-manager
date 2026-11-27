import { describe, expect, it } from "vitest";
import { fmtEta, fmtMinutes, fmtPausedFor, spoolLow, timeLost } from "../src/dark/logic/format.ts";

describe("dark format", () => {
  it("fmtPausedFor", () => {
    expect(fmtPausedFor(0)).toBe("0 s");
    expect(fmtPausedFor(59)).toBe("59 s");
    expect(fmtPausedFor(60)).toBe("1 min");
    expect(fmtPausedFor(3599)).toBe("59 min");
    expect(fmtPausedFor(3600)).toBe("1 h 00 min");
    expect(fmtPausedFor(3600 + 5 * 60)).toBe("1 h 05 min");
    expect(fmtPausedFor(-4)).toBe("0 s");
    expect(fmtPausedFor(NaN)).toBe("0 s");
  });
  it("fmtEta", () => {
    const now = Date.parse("2026-10-30T10:00:00Z");
    expect(fmtEta("2026-10-30T12:00:00Z", now, "en-US")).toMatch(/\d{1,2}:\d{2}/);
    expect(fmtEta(undefined, now)).toBe("");
    expect(fmtEta("nope", now)).toBe("");
    expect(fmtEta("2026-10-30T08:00:00Z", now)).toBe("");
  });
  it("timeLost", () => {
    expect(timeLost(0.5, 60)).toBe(60);
    expect(timeLost(0.62, 14)).toBe(23);
    expect(timeLost(0, 60)).toBeUndefined();
    expect(timeLost(1, 60)).toBeUndefined();
    expect(timeLost(1.2, 60)).toBeUndefined();
    expect(timeLost(NaN, 60)).toBeUndefined();
    expect(timeLost(0.5, NaN)).toBeUndefined();
    expect(fmtMinutes(121)).toBe("2 h 01 min");
    expect(fmtMinutes(45)).toBe("45 min");
  });
  it("spoolLow", () => {
    expect(spoolLow(14)).toBe(true);
    expect(spoolLow(15)).toBe(false);
    expect(spoolLow(0)).toBe(true);
    expect(spoolLow(undefined)).toBe(false);
    expect(spoolLow(-1)).toBe(false);
  });
});
