import { describe, expect, it } from "vitest";
import { ARM_MS, HOLD_MS, IDLE, holdProgress, step } from "../src/olympos/logic/hold.ts";

describe("hold machine", () => {
  it("idle -> holding -> armed after 1.5s", () => {
    let s = step(IDLE, "down", 1000);
    expect(s).toEqual({ kind: "holding", t0: 1000 });
    s = step(s, "tick", 1000 + HOLD_MS - 1);
    expect(s.kind).toBe("holding");
    s = step(s, "tick", 1000 + HOLD_MS);
    expect(s).toEqual({ kind: "armed", t: 2500 });
  });
  it("release or cancel while holding returns to idle", () => {
    const h = step(IDLE, "down", 0);
    expect(step(h, "up", 100)).toEqual(IDLE);
    expect(step(h, "cancel", 100)).toEqual(IDLE);
  });
  it("armed: cancel/confirm/timeout/tick-expiry -> idle; early tick stays", () => {
    const a = { kind: "armed", t: 0 } as const;
    expect(step(a, "cancel", 1)).toEqual(IDLE);
    expect(step(a, "confirm", 1)).toEqual(IDLE);
    expect(step(a, "timeout", 1)).toEqual(IDLE);
    expect(step(a, "tick", ARM_MS - 1)).toBe(a);
    expect(step(a, "tick", ARM_MS)).toEqual(IDLE);
    expect(step(a, "up", 1)).toBe(a);
  });
  it("ignores irrelevant events when idle", () => {
    for (const e of ["up", "tick", "cancel", "confirm", "timeout"] as const) expect(step(IDLE, e, 5)).toBe(IDLE);
  });
  it("progress", () => {
    expect(holdProgress({ kind: "holding", t0: 0 }, 750)).toBe(0.5);
    expect(holdProgress({ kind: "holding", t0: 0 }, 9999)).toBe(1);
    expect(holdProgress(IDLE, 10)).toBe(0);
  });
});
