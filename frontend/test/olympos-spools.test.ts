import { html, render } from "lit";
import { describe, expect, it, vi } from "vitest";
import { TdmmOlymposAmsCard } from "../src/olympos/ams/tdmm-olympos-ams-card.ts";
import { colorName, renderSpools } from "../src/olympos/ui/spools.ts";
import { makeHass } from "./fixtures/hass.js";

if (!customElements.get("tdmm-olympos-ams-card")) customElements.define("tdmm-olympos-ams-card", TdmmOlymposAmsCard);

async function ctxOf(h = makeHass()) {
  const el = document.createElement("tdmm-olympos-ams-card") as TdmmOlymposAmsCard;
  el.setConfig({ type: "custom:tdmm-olympos-ams-card", device_id: "dev_p1" });
  el.hass = h;
  document.body.append(el);
  await el.updateComplete;
  return (el as unknown as { buildCtx(): Parameters<typeof renderSpools>[0] }).buildCtx();
}

describe("spools", () => {
  it("names colours", () => {
    expect(colorName("#F5F5F5")).toBe("White");
    expect(colorName("#E53935")).toBe("Red");
  });
  it("renders buttons, empty, low, ext, selection", async () => {
    const h = makeHass();
    const id = Object.values(h.entities).find((e) => e.translation_key === "tray_remaining" && h.states[e.entity_id]!.attributes.slot === 3)?.entity_id;
    const hh = id ? { ...h, states: { ...h.states, [id]: { ...h.states[id]!, state: "10" } } } : h;
    const ctx = await ctxOf(hh);
    const pick = vi.fn();
    const host = document.createElement("div");
    render(renderSpools(ctx, ctx.resolved.ams, { unit: 1, slot: 3 }, pick), host);
    const btns = [...host.querySelectorAll<HTMLButtonElement>("button.olp-spool")];
    expect(btns).toHaveLength(5);
    expect(btns[3]!.classList.contains("empty")).toBe(true);
    expect(btns[2]!.classList.contains("low")).toBe(true);
    expect(btns[2]!.getAttribute("aria-pressed")).toBe("true");
    expect(btns[0]!.getAttribute("aria-pressed")).toBe("false");
    expect(btns[0]!.getAttribute("aria-label")).toContain("Tray 1");
    expect(btns[4]!.getAttribute("aria-label")).toBe("External spool");
    expect(host.querySelector(".olp-detail")!.textContent).toMatch(/AMS 1 · Tray 3 · ABS · .* · 10 % · Low/);
    btns[0]!.click();
    expect(pick).toHaveBeenCalledWith({ unit: 1, slot: 1 });
    btns[2]!.click();
    expect(pick).toHaveBeenLastCalledWith(undefined);
  });
  it("ext detail", async () => {
    const ctx = await ctxOf();
    const host = document.createElement("div");
    render(html`${renderSpools(ctx, ctx.resolved.ams, "ext", () => {})}`, host);
    expect(host.querySelector(".olp-detail")!.textContent).toContain("External spool · PETG");
  });
});
