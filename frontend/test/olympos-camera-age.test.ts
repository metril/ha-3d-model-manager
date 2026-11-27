import { describe, expect, it } from "vitest";
import { cameraState } from "../src/olympos/logic/camera-age.ts";
import { cameraChip } from "../src/olympos/ui/camera.ts";

describe("cameraState", () => {
  it("maps known states, everything else is unknown", () => {
    expect(cameraState("live")).toBe("live");
    expect(cameraState("stalled")).toBe("stalled");
    expect(cameraState("warming")).toBe("warming");
    for (const v of ["off", undefined, null, 5, "x"]) expect(cameraState(v)).toBe("unknown");
  });
});

describe("cameraChip", () => {
  it("labels from camera_state", () => {
    expect(cameraChip("last", false, "live").label).toBe("Last frame");
    expect(cameraChip("live", false, "live")).toEqual({ label: "Live", tone: "live" });
    expect(cameraChip("live", true, "live").label).toBe("Live");
    expect(cameraChip("live", false, "stalled")).toEqual({ label: "Stalled", tone: "stall" });
    expect(cameraChip("live", false, "warming").label).toBe("Camera starting…");
  });
  it("off or absent falls back to stream-loading state", () => {
    expect(cameraChip("live", true, "off").label).toBe("Camera starting…");
    expect(cameraChip("live", true, undefined).label).toBe("Camera starting…");
    expect(cameraChip("live", false, "off").label).toBe("Live");
    expect(cameraChip("live", false, undefined).label).toBe("Live");
  });
});
