import { describe, expect, it, vi } from "vitest";
import { TdmmPrinterCard } from "../src/cards/printer/tdmm-printer-card.ts";
import { makeHass } from "./fixtures/hass.js";

if (!customElements.get("tdmm-printer-card")) customElements.define("tdmm-printer-card", TdmmPrinterCard);
const mk = async (extra = {}, h = makeHass()) => {
  const el = document.createElement("tdmm-printer-card") as TdmmPrinterCard;
  el.setConfig({ type: "custom:tdmm-printer-card", device_id: "dev_p1", ...extra });
  el.hass = h;
  document.body.append(el);
  await el.updateComplete;
  return el;
};
const tabBtn = (el: HTMLElement, id: string) => el.shadowRoot!.querySelector<HTMLElement>(`.tdmm-tabs [data-tab="${id}"]`)!;

describe("tdmm-printer-card", () => {
  it("renders status tab by default with fixture hass", async () => {
    const el = await mk();
    expect(el.shadowRoot!.textContent).toContain("42%");
    expect(el.shadowRoot!.querySelector(".tdmm-actions")).toBeNull();
  });
  it("switching to control shows actions", async () => {
    const el = await mk();
    tabBtn(el, "control").click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".tdmm-actions")).not.toBeNull();
    expect(el.shadowRoot!.textContent).not.toContain("42%");
  });
  it("filament tab shows AMS slots", async () => {
    const el = await mk();
    tabBtn(el, "filament").click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".tdmm-slot").length).toBe(4);
  });
  it("default_tab control respected", async () => {
    const el = await mk({ default_tab: "control" });
    expect(el.shadowRoot!.querySelector(".tdmm-actions")).not.toBeNull();
  });
  it("hide_tabs hides tab buttons and falls back", async () => {
    const el = await mk({ hide_tabs: ["status"], default_tab: "status" });
    expect(tabBtn(el, "status")).toBeNull();
    expect(el.shadowRoot!.querySelector(".tdmm-actions")).not.toBeNull();
    const one = await mk({ hide_tabs: ["status", "filament"] });
    expect(one.shadowRoot!.querySelector(".tdmm-tabs")).toBeNull();
  });
  it("inactive tab entity change does not re-render", async () => {
    const h = makeHass();
    const el = await mk({}, h);
    const spy = vi.spyOn(el as unknown as { render(): unknown }, "render");
    const id = Object.values(h.entities).find((e) => e.translation_key === "aux_fan")!.entity_id;
    el.hass = { ...h, states: { ...h.states, [id]: { ...h.states[id]!, state: "on" } } };
    await el.updateComplete;
    expect(spy).not.toHaveBeenCalled();
  });
  it("control tab re-renders on aux_fan change", async () => {
    const h = makeHass();
    const el = await mk({}, h);
    tabBtn(el, "control").click();
    await el.updateComplete;
    const spy = vi.spyOn(el as unknown as { render(): unknown }, "render");
    const id = Object.values(h.entities).find((e) => e.translation_key === "aux_fan")!.entity_id;
    el.hass = { ...h, states: { ...h.states, [id]: { ...h.states[id]!, state: "on" } } };
    await el.updateComplete;
    expect(spy).toHaveBeenCalled();
  });
  it("light and dark both render", async () => {
    for (const dark of [true, false]) {
      const el = await mk({}, makeHass({ dark }));
      expect(el.shadowRoot!.textContent).toContain("42%");
      expect(el.shadowRoot!.innerHTML).not.toMatch(/style="[^"]*(#[0-9a-f]{3}|rgb\()/i);
    }
  });
  it("getStubConfig and getGridOptions", async () => {
    expect(TdmmPrinterCard.getStubConfig(makeHass()).device_id).toBe("dev_p1");
    expect((await mk()).getGridOptions()).toEqual({ columns: 12, rows: "auto", min_columns: 6 });
  });
});
