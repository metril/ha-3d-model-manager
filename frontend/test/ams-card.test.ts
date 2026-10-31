import { describe, expect, it, vi } from "vitest";
import { TdmmAmsCard } from "../src/cards/ams/tdmm-ams-card.ts";
import { makeHass } from "./fixtures/hass.js";

if (!customElements.get("tdmm-ams-card")) customElements.define("tdmm-ams-card", TdmmAmsCard);
const mk = async (h = makeHass()) => {
  const el = document.createElement("tdmm-ams-card") as TdmmAmsCard;
  el.setConfig({ type: "custom:tdmm-ams-card", device_id: "dev_p1" });
  el.hass = h;
  document.body.append(el);
  await el.updateComplete;
  return el;
};
const idOf = (h: ReturnType<typeof makeHass>, pred: (e: { translation_key?: string; entity_id: string }) => boolean) =>
  Object.values(h.entities).find(pred)!.entity_id;

describe("tdmm-ams-card", () => {
  it("renders AMS slots with fixture hass", async () => {
    const el = await mk();
    expect(el.shadowRoot!.querySelectorAll(".tdmm-slot").length).toBe(4);
    expect(el.getCardSize()).toBeGreaterThan(1);
  });
  it("slots reappear once unavailable tray attributes are restored", async () => {
    const h = makeHass();
    const trays = Object.values(h.entities).filter((e) => /^tray_/.test(e.translation_key ?? "")).map((e) => e.entity_id);
    const hum = idOf(h, (e) => e.translation_key === "ams_humidity");
    const tmp = idOf(h, (e) => e.translation_key === "ams_temperature");
    const states = { ...h.states };
    for (const id of [...trays, hum, tmp]) states[id] = { ...h.states[id]!, state: "unavailable", attributes: {} };
    const el = await mk({ ...h, states });
    expect(el.shadowRoot!.querySelectorAll(".tdmm-slot").length).toBe(0);
    el.hass = { ...h, states: { ...h.states } };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".tdmm-slot").length).toBe(4);
  });
  it("two AMS units render two rows", async () => {
    const el = await mk(makeHass({ amsUnits: 2 }));
    expect(el.shadowRoot!.querySelectorAll(".tdmm-ams-unit").length).toBe(2);
  });
  it("slot remaining change re-renders, nozzle temp change does not", async () => {
    const h = makeHass();
    const el = await mk(h);
    const spy = vi.spyOn(el as unknown as { render(): unknown }, "render");
    const noz = idOf(h, (e) => e.translation_key === "nozzle_temperature");
    el.hass = { ...h, states: { ...h.states, [noz]: { ...h.states[noz]!, state: "230" } } };
    await el.updateComplete;
    expect(spy).not.toHaveBeenCalled();
    const rem = idOf(h, (e) => e.translation_key === "tray_remaining");
    el.hass = { ...h, states: { ...h.states, [rem]: { ...h.states[rem]!, state: "10" } } };
    await el.updateComplete;
    expect(spy).toHaveBeenCalled();
  });
  it("no AMS shows ext only", async () => {
    const el = await mk(makeHass({ amsUnits: 0 }));
    expect(el.shadowRoot!.querySelector(".tdmm-ams")).toBeNull();
    expect(el.shadowRoot!.textContent).toContain("PETG");
  });
  it("getStubConfig", () => {
    expect(TdmmAmsCard.getStubConfig(makeHass()).device_id).toBe("dev_p1");
  });
});
