import { describe, it, expect, vi, afterEach } from "vitest";
import { CARD_DEFAULTS, CARD_TYPES, kindFromType, normalizeConfig, serializeConfig } from "../src/config.js";

const P = "custom:tdmm-printer-card";
afterEach(() => vi.restoreAllMocks());

describe("config", () => {
  it("kindFromType maps and throws", () => {
    expect(kindFromType(CARD_TYPES.ams)).toBe("ams");
    expect(() => kindFromType("custom:nope")).toThrow();
  });
  it("serialize default printer config is minimal", () => {
    expect(serializeConfig(normalizeConfig({ type: P, device_id: "dev_p1" }))).toEqual({ type: P, device_id: "dev_p1" });
  });
  it("serialize keeps only changed tab", () => {
    const n = normalizeConfig({ type: P, device_id: "d" });
    n.tabs.control = [...n.tabs.control].reverse();
    const out = serializeConfig(n);
    expect(out.tabs?.control).toBeDefined();
    expect(out.tabs?.status).toBeUndefined();
    expect(out.blocks).toBeUndefined();
  });
  it("serialize keeps hidden true, drops hidden false", () => {
    const n = normalizeConfig({ type: CARD_TYPES.progress, device_id: "d" });
    n.blocks = [{ type: "header", hidden: true }, { type: "progress", hidden: false }, { type: "job" }];
    expect(serializeConfig(n).blocks).toEqual([{ type: "header", hidden: true }, { type: "progress" }, { type: "job" }]);
  });
  it("serialize drops empty and default theme keys", () => {
    const n = normalizeConfig({ type: P, device_id: "d" });
    n.theme = { accent: "", density: "normal", icon_set: "default" };
    expect(serializeConfig(n).theme).toBeUndefined();
    n.theme = { radius: 4, accent: "" };
    expect(serializeConfig(n).theme).toEqual({ radius: 4 });
  });
  it("normalize drops unknown tab, invalid default_tab, unknown hide_tabs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const n = normalizeConfig({
      type: P, device_id: "d", tabs: { bogus: [{ type: "header" }] }, default_tab: "x", hide_tabs: ["control", "y"],
    });
    expect(Object.keys(n.tabs).sort()).toEqual(["control", "filament", "status"]);
    expect(n.default_tab).toBe("status");
    expect(n.hide_tabs).toEqual(["control"]);
    expect(warn).toHaveBeenCalled();
  });
  it("round trip", () => {
    const xs = [
      { type: P, device_id: "a" },
      { type: P, device_id: "b", tabs: { control: [{ type: "fans" }, { type: "actions", hidden: true }, { type: "temps" }, { type: "light" }, { type: "speed" }] },
        hide_tabs: ["filament"], default_tab: "control", theme: { radius: 4, accent: "#f60" } },
      { type: CARD_TYPES.camera, device_id: "c", camera_view: "live", blocks: [{ type: "progress" }, { type: "camera" }] },
    ];
    for (const x of xs) expect(serializeConfig(normalizeConfig(x))).toEqual(x);
  });
  it("normalize tolerates unknown and duplicate blocks", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const n = normalizeConfig({
      type: CARD_TYPES.progress, device_id: "d",
      blocks: [{ type: "job", hidden: true }, { type: "zzz" }, { type: "job" }, { type: "header", hidden: false }],
    });
    expect(n.blocks).toEqual([{ type: "job", hidden: true }, { type: "header" }, { type: "progress" }]);
    expect(warn).toHaveBeenCalled();
  });
  it("normalize appends missing printer blocks visible", () => {
    const n = normalizeConfig({ type: P, device_id: "d", tabs: { status: [{ type: "hms" }] } });
    expect(n.tabs.status.map((b) => b.type)).toEqual(["hms", "header", "progress", "temps", "job"]);
  });
  it("defaults", () => {
    expect(CARD_DEFAULTS.default_tab).toBe("status");
    expect(CARD_DEFAULTS.camera_view).toBe("auto");
  });
  it("normalize throws without device_id", () => {
    expect(() => normalizeConfig({ type: P })).toThrow("device_id is required");
    expect(() => normalizeConfig({ type: P, device_id: 3 })).toThrow("device_id is required");
    expect(() => normalizeConfig(null)).toThrow("device_id is required");
  });
  it("non-array block list falls back to defaults", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const n = normalizeConfig({ type: CARD_TYPES.progress, device_id: "d", blocks: "header" });
    expect(n.blocks).toEqual(CARD_DEFAULTS.blocks.progress);
    expect(warn).toHaveBeenCalled();
  });
  it("unknown type falls back to printer kind without throwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const n = normalizeConfig({ type: "custom:other", device_id: "d" });
    expect(n.kind).toBe("printer");
    expect(warn).toHaveBeenCalled();
  });
  it("serialize(normalize()) is idempotent", () => {
    const c = { type: P, device_id: "d", tabs: { status: [{ type: "hms", hidden: true }, { type: "zzz" }] } };
    const once = serializeConfig(normalizeConfig(c));
    expect(serializeConfig(normalizeConfig(once))).toEqual(once);
  });
});
