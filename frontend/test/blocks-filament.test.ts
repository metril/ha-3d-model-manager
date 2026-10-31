import { nothing, render, type TemplateResult } from "lit";
import { describe, expect, it } from "vitest";
import "../src/base/tdmm-base-card.ts";
import { getBlock } from "../src/blocks/registry.ts";
import type { BlockContext } from "../src/blocks/types.ts";
import { normalizeConfig, type BlockType } from "../src/config.ts";
import { resolveEntities, ENTITY_KEYS, type EntityKey } from "../src/entities.ts";
import { ICON_SETS } from "../src/theme/tokens.ts";
import { ensureHaElements } from "../src/editor/load-ha.ts";
import { makeHass, type MakeHassOpts } from "./fixtures/hass.ts";

const mount = (type: BlockType, opts: MakeHassOpts = {}, cfg: Record<string, unknown> = {}) => {
  const hass = makeHass(opts);
  const resolved = resolveEntities(hass, "dev_p1");
  const config = normalizeConfig({ type: "custom:tdmm-printer-card", device_id: "dev_p1", ...cfg });
  const ctx: BlockContext = {
    hass, resolved, config,
    icon: (n) => ICON_SETS.default[n],
    state: (k: EntityKey) => (resolved.byKey[k] ? hass.states[resolved.byKey[k]!] : undefined),
    call: async () => undefined,
  };
  const div = document.createElement("div");
  const r = getBlock(type).render(ctx);
  if (r !== nothing) render(r as TemplateResult, div);
  return { div, ctx, resolved };
};
const ALL = Object.keys(ENTITY_KEYS) as EntityKey[];

describe("ams", () => {
  it("renders 4 slots sorted with materials", () => {
    const { div } = mount("ams");
    const slots = div.querySelectorAll(".tdmm-slot");
    expect(slots.length).toBe(4);
    const text = [...slots].map((s) => s.textContent);
    expect(text[0]).toContain("PLA");
    expect(text[1]).toContain("PETG");
    expect(text[2]).toContain("ABS");
    expect((slots[0]!.querySelector(".tdmm-swatch") as HTMLElement).getAttribute("style")).toContain("#FF0000");
    expect(div.textContent).toContain("4%");
    expect(div.textContent).toContain("28");
  });
  it("empty slot shows Empty", () => {
    const { div } = mount("ams");
    const s = div.querySelectorAll(".tdmm-slot")[3]!;
    expect(s.textContent).toContain("Empty");
    expect(s.querySelector(".tdmm-swatch")!.getAttribute("style") ?? "").not.toContain("#");
  });
  it("marks active slot", () => {
    const { div } = mount("ams");
    const slots = div.querySelectorAll(".tdmm-slot");
    expect(slots[0]!.classList.contains("active")).toBe(true);
    expect(div.querySelectorAll(".tdmm-slot.active").length).toBe(1);
  });
  it("renders nothing without AMS", () => {
    expect(mount("ams", { amsUnits: 0 }).div.innerHTML).toBe("");
  });
  it("size is 1 + units", () => {
    expect(getBlock("ams").size).toBe(1);
  });
});

describe("ext", () => {
  it("renders chip", () => {
    const { div } = mount("ext");
    expect(div.textContent).toContain("PETG");
    expect(div.querySelector(".tdmm-swatch")!.getAttribute("style")).toContain("#00FF00");
  });
  it("renders nothing when spool entities missing", () => {
    expect(mount("ext", { omit: ["external_spool_material", "external_spool_color"] }).div.innerHTML).toBe("");
  });
});

describe("camera", () => {
  it("renders no-camera placeholder when entity missing", () => {
    const { div } = mount("camera", { omit: ["camera"] });
    expect(div.textContent).toContain("No camera");
  });
  it("renders hui-image bound to camera entity with cameraView auto", () => {
    if (!customElements.get("hui-image")) customElements.define("hui-image", class extends HTMLElement {});
    const { div, ctx, resolved } = mount("camera");
    const el = div.querySelector("hui-image") as unknown as Record<string, unknown>;
    expect(el).toBeTruthy();
    expect(el.cameraImage).toBe("camera.x1c_garage_camera_renamed");
    expect(el.cameraView).toBe("auto");
    expect(el.fitMode).toBe("cover");
    expect(el.hass).toBe(ctx.hass);
    expect(getBlock("camera").uses(resolved)).toEqual(["camera.x1c_garage_camera_renamed"]);
  });
  it("renders nothing-throwing uses() when missing", () => {
    expect(getBlock("camera").uses(mount("camera", { omit: ["camera"] }).resolved)).toEqual([]);
  });
});

describe("blocks render nothing when entities missing", () => {
  it("ams/ext", () => {
    for (const t of ["ams", "ext"] as BlockType[]) expect(mount(t, { omit: ALL, amsUnits: 0 }).div.innerHTML).toBe("");
  });
});

describe("ensureHaElements", () => {
  it("resolves when loadCardHelpers absent", async () => {
    await expect(ensureHaElements(20)).resolves.toBeUndefined();
  });
  it("never throws when helpers reject", async () => {
    (window as unknown as { loadCardHelpers: unknown }).loadCardHelpers = async () => { throw new Error("x"); };
    await expect(ensureHaElements(20)).resolves.toBeUndefined();
    delete (window as unknown as { loadCardHelpers?: unknown }).loadCardHelpers;
  });
});
