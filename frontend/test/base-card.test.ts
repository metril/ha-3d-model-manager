import { html, nothing } from "lit";
import { registerBlock } from "../src/blocks/registry.ts";
import { describe, expect, it, vi } from "vitest";
import { TdmmBaseCard } from "../src/base/tdmm-base-card.ts";
import { hassChanged } from "../src/base/diff.ts";
import { tokenCss } from "../src/theme/tokens.ts";
import type { HomeAssistant } from "../src/ha-types.ts";
import { makeHass } from "./fixtures/hass.js";

class TestCard extends TdmmBaseCard {
  ids: string[] = [];
  protected visibleBlocks() { return this.config?.blocks ?? []; }
  protected override computeUsedIds() { return this.ids; }
  setIds(ids: string[]) { this.ids = ids; this.usedIds = ids; }
  get styleText() { return ((this.constructor as typeof TdmmBaseCard).styles as unknown as { cssText: string }[]).map((s) => s.cssText).join(""); }
}
customElements.define("tdmm-test-card", TestCard);

const PROG = "sensor.x1c_garage_progress_renamed";
const mk = (theme?: object, device_id = "dev_p1") => {
  const el = new TestCard();
  el.setIds([PROG]);
  el.setConfig({ type: "custom:tdmm-printer-card", device_id, theme });
  return el;
};
const withState = (h: HomeAssistant, id: string, state: string): HomeAssistant =>
  ({ ...h, states: { ...h.states, [id]: { ...h.states[id]!, state } } });

describe("hassChanged", () => {
  const h = makeHass();
  it("false for unrelated state change", () => {
    expect(hassChanged(h, withState(h, "sensor.x1c_garage_stage_renamed", "x"), [PROG])).toBe(false);
  });
  it("true for tracked state change", () => {
    expect(hassChanged(h, withState(h, PROG, "50"), [PROG])).toBe(true);
  });
  it("true when entities registry replaced", () => {
    expect(hassChanged(h, { ...h, entities: { ...h.entities } }, [PROG])).toBe(true);
  });
  it("true on language change", () => {
    expect(hassChanged(h, { ...h, locale: { language: "de" } }, [PROG])).toBe(true);
  });
  it("true on first hass", () => {
    expect(hassChanged(undefined, h, [PROG])).toBe(true);
  });
});

describe("TdmmBaseCard", () => {
  it("hass setter skips requestUpdate for unrelated changes", () => {
    const el = mk();
    const spy = vi.spyOn(el, "requestUpdate");
    const h = makeHass();
    el.hass = h;
    expect(spy).toHaveBeenCalledTimes(1);
    el.hass = withState(h, "sensor.x1c_garage_stage_renamed", "x");
    expect(spy).toHaveBeenCalledTimes(1);
    el.hass = withState(h, PROG, "50");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("applyTheme sets and clears inline vars", () => {
    const el = mk({ accent: "red" });
    expect(el.style.getPropertyValue("--tdmm-accent")).toBe("red");
    el.setConfig({ type: "custom:tdmm-printer-card", device_id: "dev_p1" });
    expect(el.style.getPropertyValue("--tdmm-accent")).toBe("");
  });

  it("styles consume only private vars", () => {
    const css = mk().styleText.split(tokenCss()).join("");
    expect(css).not.toContain("var(--tdmm-");
    expect(css).toContain("--_tdmm-");
  });

  it("renders not-found for unknown device", async () => {
    const el = mk(undefined, "nope");
    el.hass = makeHass();
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("ha-alert")?.textContent).toContain("Printer not found");
    el.remove();
  });

  it("getGridOptions defaults", () => {
    expect(mk().getGridOptions()).toEqual({ columns: 12, rows: "auto", min_columns: 6 });
    expect(mk().getCardSize()).toBe(1);
  });
});

describe("block rendering", () => {
  it("renders registered blocks, skips hidden and nothing, sums size", async () => {
    registerBlock({ type: "header", label: "H", icon: "printer", size: 2, uses: (r) => [r.byKey.progress!], render: (c) => html`<p class="h">${c.state("progress")?.state}</p>` });
    registerBlock({ type: "hms", label: "M", icon: "alert", size: 3, uses: () => [], render: () => nothing });
    const el = new TestCard();
    el.setConfig({ type: "custom:tdmm-printer-card", device_id: "dev_p1", blocks: [{ type: "header" }, { type: "hms" }, { type: "progress", hidden: true }] });
    el.hass = makeHass();
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("p.h")).toHaveLength(1);
    expect(el.shadowRoot!.querySelector("p.h")?.textContent).toBe("42");
    expect(el.getCardSize()).toBe(5);
    el.remove();
  });
});

class RealCard extends TdmmBaseCard {
  protected visibleBlocks() { return this.config?.blocks ?? []; }
  get ids() { return this.usedIds; }
  recompute() { this.refresh(); }
  addBogus() { this.config!.blocks.push({ type: "bogus" as never }); }
}
customElements.define("tdmm-real-card", RealCard);

describe("registry-based used ids", () => {
  const cfg = { type: "custom:tdmm-printer-card", device_id: "dev_p1", blocks: [{ type: "light" as const }] };
  const withBogus = (el: RealCard) => { el.setConfig(cfg); el.addBogus(); };
  it("computeUsedIds unions block uses, drops falsy ids, after hass set", () => {
    registerBlock({ type: "light", label: "L", icon: "light", size: 1, uses: (r) => [r.byKey.progress!, undefined as unknown as string, ""], render: () => nothing });
    const el = new RealCard();
    withBogus(el);
    el.hass = makeHass();
    expect(el.ids).toEqual([PROG]);
    el.recompute();
    expect(el.ids).toEqual([PROG]);
  });
  it("renderBlocks warns and skips unregistered block types", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const el = new RealCard();
    withBogus(el);
    el.hass = makeHass();
    document.body.append(el);
    await el.updateComplete;
    expect(warn).toHaveBeenCalled();
    el.remove();
    warn.mockRestore();
  });
});
