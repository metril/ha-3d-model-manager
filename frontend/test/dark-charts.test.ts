import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import { normalizeConfig } from "../src/config.ts";
import { resolveEntities } from "../src/entities.ts";
import { renderChartsView } from "../src/dark/printer/charts-view.ts";
import type { ChartsState, DarkCtx } from "../src/dark/contracts.ts";
import { makeHass } from "./fixtures/hass.js";

export function mkCtx(over: Record<string, unknown> = {}, states?: Record<string, { state: string }>): DarkCtx {
  const hass = makeHass({ states });
  const resolved = resolveEntities(hass, "dev_p1");
  const config = normalizeConfig({ type: "custom:tdmm-printer-popup-card", device_id: "dev_p1" } as never);
  return {
    hass, config, resolved, phase: "idle", palette: {} as never, v: (t) => `var(--_tdmm-${t})`,
    state: (k) => (resolved.byKey[k] ? hass.states[resolved.byKey[k]!] : undefined),
    press: vi.fn().mockResolvedValue(undefined), callService: vi.fn().mockResolvedValue(undefined),
    icon: () => "mdi:x", now: 0, ...over,
  } as DarkCtx;
}
const root = (s: ChartsState, d = vi.fn()) => { const el = document.createElement("div"); render(renderChartsView(mkCtx(), s, d), el); return el; };
const data = { t0: 0, t1: 1000, nozzle: [{ t: 0, v: 200 }], bed: [{ t: 0, v: 60 }], nozzleTarget: [{ t: 0, v: 220 }], bedTarget: [], progress: [{ t: 0, v: 40 }] };

describe("charts view", () => {
  it("renders two accessible charts and pressed range", () => {
    const el = root({ range: "6h", loading: false, data });
    const imgs = el.querySelectorAll('svg[role="img"]');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]!.getAttribute("aria-label")).toContain("nozzle 200 degrees");
    const pressed = [...el.querySelectorAll("button[aria-pressed]")].map((b) => b.getAttribute("aria-pressed"));
    expect(pressed).toEqual(["false", "true", "false"]);
  });
  it("dispatches range and refresh", () => {
    const d = vi.fn();
    const el = root({ range: "1h", loading: false, error: "boom" }, d);
    (el.querySelectorAll("button[aria-pressed]")[2] as HTMLElement).click();
    expect(d).toHaveBeenCalledWith({ type: "range", range: "24h" });
    [...el.querySelectorAll("button")].find((b) => b.textContent === "Retry")!.click();
    expect(d).toHaveBeenCalledWith({ type: "refresh" });
  });
  it("loading and empty states", () => {
    expect(root({ range: "1h", loading: true }).textContent).toContain("Loading");
    expect(root({ range: "1h", loading: false }).textContent).toContain("No history");
  });
  it("back fires tdmm-back", () => {
    const el = root({ range: "1h", loading: false });
    const fn = vi.fn(); el.addEventListener("tdmm-back", fn);
    (el.querySelector('button[aria-label="Back"]') as HTMLElement).click();
    expect(fn).toHaveBeenCalled();
  });
});
