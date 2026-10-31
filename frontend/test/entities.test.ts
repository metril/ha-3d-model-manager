import { describe, expect, it } from "vitest";
import { ENTITY_KEYS, allEntityIds, resolveEntities } from "../src/entities.js";
import { makeHass } from "./fixtures/hass.js";

describe("resolveEntities", () => {
  it("resolves every EntityKey for fixture printer", () => {
    const r = resolveEntities(makeHass(), "dev_p1");
    expect(r.deviceFound).toBe(true);
    expect(Object.keys(r.byKey).length).toBe(Object.keys(ENTITY_KEYS).length);
    expect(allEntityIds(r).length).toBe(Object.keys(ENTITY_KEYS).length + 2 + 12);
  });

  it("resolves renamed entity by translation_key", () => {
    const r = resolveEntities(makeHass(), "dev_p1");
    expect(r.byKey.progress).toBe("sensor.x1c_garage_progress_renamed");
  });

  it("prefers number over sensor for nozzle_target_temperature", () => {
    const h = makeHass();
    expect(Object.keys(h.entities).some((id) => id.startsWith("sensor.x1c_garage_nozzle_target_temperature"))).toBe(true);
    expect(resolveEntities(h, "dev_p1").byKey.nozzle_target_temperature).toMatch(/^number\./);
  });

  it("prefers select over sensor for speed_profile", () => {
    const h = makeHass();
    expect(Object.keys(h.entities).some((id) => id.startsWith("sensor.x1c_garage_speed_profile"))).toBe(true);
    expect(resolveEntities(h, "dev_p1").byKey.speed_profile).toMatch(/^select\./);
  });

  it("collects AMS from child device sorted and grouped by ams_unit/slot attributes", () => {
    const r = resolveEntities(makeHass({ amsUnits: 2 }), "dev_p1");
    expect(r.ams.map((u) => u.unit)).toEqual([1, 2]);
    expect(r.ams[0]!.slots.map((s) => s.slot)).toEqual([1, 2, 3, 4]);
    expect(r.ams[0]!.slots[0]!.material).toBeTruthy();
    expect(r.ams[0]!.humidity).toBeTruthy();
    expect(r.ams[0]!.temperature).toBeTruthy();
  });

  it("ignores other platforms and other devices", () => {
    const h = makeHass();
    h.entities["sensor.foreign_progress"] = { entity_id: "sensor.foreign_progress", device_id: "dev_p1", platform: "bambu_lab", translation_key: "progress" };
    h.devices["dev_other"] = { id: "dev_other" };
    h.entities["sensor.other_dev_stage"] = { entity_id: "sensor.other_dev_stage", device_id: "dev_other", platform: "tdmm", translation_key: "stage" };
    const r = resolveEntities(h, "dev_p1");
    expect(r.byKey.progress).toBe("sensor.x1c_garage_progress_renamed");
    expect(r.byKey.stage).toBe("sensor.x1c_garage_stage_renamed");
    expect(allEntityIds(r)).not.toContain("sensor.foreign_progress");
    expect(resolveEntities(h, "dev_other").ams).toEqual([]);
  });

  it("deviceFound false for unknown device", () => {
    const r = resolveEntities(makeHass(), "nope");
    expect(r).toEqual({ deviceFound: false, byKey: {}, ams: [] });
  });

  it("omits keys and AMS when absent", () => {
    const r = resolveEntities(makeHass({ omit: ["door_open"], amsUnits: 0 }), "dev_p1");
    expect(r.byKey.door_open).toBeUndefined();
    expect(r.ams).toEqual([]);
  });
});
