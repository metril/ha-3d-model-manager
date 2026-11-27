import { describe, expect, it } from "vitest";
import { frameAge } from "../src/olympos/logic/camera-age.ts";
import { cameraChip } from "../src/olympos/ui/camera.ts";

const now = Date.parse("2026-10-30T10:00:00Z");
const ago = (s: number) => new Date(now - s * 1000).toISOString();

describe("frameAge", () => {
  it("live when missing, invalid or fresh", () => {
    expect(frameAge(undefined, now)).toEqual({ kind: "live" });
    expect(frameAge("garbage", now)).toEqual({ kind: "live" });
    expect(frameAge(ago(5), now)).toEqual({ kind: "live" });
  });
  it("lag > 5s, stall > 60s", () => {
    expect(frameAge(ago(6), now)).toEqual({ kind: "lag", sec: 6 });
    expect(frameAge(ago(60), now)).toEqual({ kind: "lag", sec: 60 });
    expect(frameAge(ago(61), now)).toEqual({ kind: "stall", min: 1 });
    expect(frameAge(ago(150), now)).toEqual({ kind: "stall", min: 2 });
  });
  it("future timestamps are live", () => {
    expect(frameAge(ago(-30), now)).toEqual({ kind: "live" });
  });
});

describe("cameraChip", () => {
  it("labels", () => {
    expect(cameraChip("last", false, undefined, now).label).toBe("Last frame");
    expect(cameraChip("live", true, undefined, now).label).toBe("Camera starting…");
    expect(cameraChip("live", false, ago(12), now)).toEqual({ label: "12 s old", tone: "warn" });
    expect(cameraChip("live", false, ago(130), now).label).toBe("Stalled · 2 min");
    expect(cameraChip("live", false, undefined, now).label).toBe("Live");
  });
});
