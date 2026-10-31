import { nothing, render, type TemplateResult } from "lit";
import { describe, expect, it } from "vitest";
import { getBlock, blockStyles } from "../src/blocks/registry.ts";
import type { BlockContext } from "../src/blocks/types.ts";
import type { BlockType } from "../src/config.ts";
import { fmtDuration, fmtPercent, fmtTemp, isAvailable } from "../src/blocks/format.ts";
import { TdmmBaseCard } from "../src/base/tdmm-base-card.ts";
import { normalizeConfig } from "../src/config.ts";
import { ENTITY_KEYS, resolveEntities, type EntityKey } from "../src/entities.ts";
import { ICON_SETS } from "../src/theme/tokens.ts";
import { makeHass, type MakeHassOpts } from "./fixtures/hass.ts";

const ctxFor = (opts: MakeHassOpts = {}): BlockContext => {
  const hass = makeHass(opts);
  const resolved = resolveEntities(hass, "dev_p1");
  const config = normalizeConfig({ type: "custom:tdmm-printer-card", device_id: "dev_p1" });
  return {
    hass, resolved, config,
    icon: (n) => ICON_SETS.default[n],
    state: (k: EntityKey) => (resolved.byKey[k] ? hass.states[resolved.byKey[k]!] : undefined),
    call: async () => undefined,
  };
};
const fmtHtml = (type: BlockType): string => {
  const o = ctxFor();
  const ctx = { ...o, hass: { ...o.hass, formatEntityState: (s: { state: string }) => `L10N-${s.state}` } };
  const div = document.createElement("div");
  render(getBlock(type).render(ctx) as TemplateResult, div);
  return div.innerHTML;
};
const html = (type: BlockType, opts?: MakeHassOpts): string => {
  const div = document.createElement("div");
  const r = getBlock(type).render(ctxFor(opts));
  if (r === nothing) return "";
  render(r as TemplateResult, div);
  return div.innerHTML;
};
const ID = (k: string) => `sensor.x1c_garage_${k}_renamed`;

describe("format", () => {
  it("formats minutes by unit", () => {
    const rows: [number, string | undefined, string][] = [
      [0, "min", "0m"], [60, "min", "1h 00m"], [65, "min", "1h 05m"],
      [3600, "s", "1h 00m"], [59, "s", "0m"], [1, "h", "1h 00m"], [90, undefined, "1h 30m"],
    ];
    for (const [v, u, out] of rows) expect(fmtDuration(v, u)).toBe(out);
  });
  it("isAvailable/fmtTemp/fmtPercent", () => {
    const s = (state: string) => ({ entity_id: "x", state, attributes: {}, last_changed: "", last_updated: "" });
    expect(isAvailable(undefined)).toBe(false);
    expect(isAvailable(s("unavailable"))).toBe(false);
    expect(isAvailable(s("unknown"))).toBe(false);
    expect(isAvailable(s("1"))).toBe(true);
    expect(fmtTemp(s("220"))).toBe("220 °C");
    expect(fmtTemp(undefined)).toBe("—");
    expect(fmtPercent(s("42"))).toBe("42%");
    expect(fmtPercent(s("unknown"))).toBe("—");
  });
});

describe("status blocks", () => {
  it("header shows model name and state", () => {
    const h = html("header");
    expect(h).toContain("Benchy");
    expect(h).toContain("running");
  });
  it("progress shows 42% and remaining 1h 00m and layer x/y", () => {
    const h = html("progress");
    expect(h).toContain("42%");
    expect(h).toContain("1h 00m");
    expect(h).toContain("120/300");
  });
  it("progress shows dash when unknown", () => {
    const h = html("progress", { states: { [ID("progress")]: { state: "unknown" }, [ID("remaining_time")]: { state: "unavailable" } } });
    expect(h).not.toContain("NaN");
    expect(h).not.toContain("42%");
    expect(h).toContain("—");
  });
  it("temps shows nozzle current/target", () => {
    const h = html("temps");
    expect(h).toContain("220 °C");
    expect(h).toContain("60 °C");
  });
  it("job shows thumbnail img when print_thumbnail entity has entity_picture", () => {
    const id = "image.x1c_garage_print_thumbnail_renamed";
    const h = html("job", { states: { [id]: { attributes: { entity_picture: "/api/image_proxy/x?token=1" } } } });
    expect(h).toContain("<img");
    expect(h).toContain("/api/image_proxy/x?token=1");
    expect(html("job")).not.toContain("<img");
  });
  it("hms renders nothing when hms_active off", () => {
    expect(html("hms")).toBe("");
    const id = "binary_sensor.x1c_garage_hms_active_renamed";
    const h = html("hms", { states: { [id]: { state: "on" }, [ID("print_error")]: { state: "HMS_0300" } } });
    expect(h).toContain("HMS_0300");
  });
  it("blocks render nothing when entities missing", () => {
    const omit = Object.keys(ENTITY_KEYS) as EntityKey[];
    for (const t of ["header", "progress", "temps", "job", "hms"] as BlockType[]) {
      expect(getBlock(t).render(ctxFor({ omit }))).toBe(nothing);
    }
  });
  it("uses() returns only resolved ids", () => {
    const hass = makeHass();
    const r = resolveEntities(hass, "dev_p1");
    expect(getBlock("progress").uses(r)).toContain(ID("progress"));
    const empty = resolveEntities(makeHass({ omit: Object.keys(ENTITY_KEYS) as EntityKey[] }), "dev_p1");
    for (const t of ["header", "progress", "temps", "job", "hms"] as BlockType[]) expect(getBlock(t).uses(empty)).toEqual([]);
  });
  it("sizes", () => {
    expect(["header", "progress", "temps", "job", "hms"].map((t) => getBlock(t as BlockType).size)).toEqual([1, 2, 1, 2, 1]);
  });
});

describe("block style registration", () => {
  it("card classes defined after blocks import include block styles in elementStyles", () => {
    class Fresh extends TdmmBaseCard { protected visibleBlocks() { return []; } }
    customElements.define("tdmm-fresh-card", Fresh);
    const finalized = (Fresh as unknown as { elementStyles: { cssText?: string }[] }).elementStyles;
    const text = finalized.map((s) => s.cssText ?? "").join("");
    const block = blockStyles();
    expect(block.length).toBeGreaterThan(0);
    for (const s of block) expect(text).toContain(s.cssText);
  });
});

describe("formatEntityState", () => {
  it("header and job use hass.formatEntityState when present", () => {
    expect(fmtHtml("header")).toContain("L10N-running");
    expect(fmtHtml("job")).toContain("L10N-printing");
    expect(html("header")).toContain("running");
  });
});
