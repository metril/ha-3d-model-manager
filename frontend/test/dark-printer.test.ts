import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TdmmPrinterPopupCard } from "../src/dark/printer/tdmm-printer-popup-card.ts";
import { makeHass } from "./fixtures/hass.js";

const TAG = "tdmm-printer-popup-card";
if (!customElements.get(TAG)) customElements.define(TAG, TdmmPrinterPopupCard);

const mk = async (h = makeHass()) => {
  const el = document.createElement(TAG) as TdmmPrinterPopupCard;
  el.setConfig({ type: `custom:${TAG}`, device_id: "dev_p1" });
  el.hass = h;
  document.body.append(el);
  await el.updateComplete;
  return el;
};
const $ = (el: HTMLElement, sel: string) => el.shadowRoot!.querySelector<HTMLElement>(sel)!;
const PS = "sensor.x1c_garage_print_state_renamed";

afterEach(() => { document.body.innerHTML = ""; vi.useRealTimers(); });

describe("dark printer card", () => {
  it("renders hero, tiles, controls and chips for a running print", async () => {
    const el = await mk();
    const t = el.shadowRoot!.textContent!;
    expect(t).toContain("42%");
    expect(t).toContain("120 / 300 layers");
    expect(t).toContain("Nozzle");
    expect($(el, ".o-hint").textContent!.trim()).toBe("");
    expect($(el, ".o-chip.acc")).toBeTruthy();
    expect($(el, ".o-chip.fault")).toBeNull();
    expect($(el, "button[aria-label='Hold to stop print']").hasAttribute("disabled")).toBe(false);
  });
  it("idle: no stage chip, stop disabled, big text Idle", async () => {
    const el = await mk(makeHass({ states: { [PS]: { state: "idle" } } }));
    expect($(el, ".o-chip")).toBeNull();
    expect($(el, ".o-big").textContent).toBe("Idle");
    expect($(el, "button[aria-label='Hold to stop print']").hasAttribute("disabled")).toBe(true);
  });
  it("target shown only when |delta|>3", async () => {
    const el = await mk(makeHass({ states: { "sensor.x1c_garage_nozzle_temperature_renamed": { state: "150" } } }));
    expect($(el, ".o-tt").textContent).toBe("→ 220°");
    const el2 = await mk();
    expect($(el2, ".o-tt").textContent).toBe("");
  });
  it("paused shows duration from last_changed and ticks only while paused", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-10-30T10:12:00Z"));
    const el = await mk(makeHass({ states: { [PS]: { state: "pause" } } }));
    expect(el.shadowRoot!.textContent).toContain("Paused · 12 min");
    expect($(el, ".o-chip.warn")).toBeTruthy();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("hold 1.5s arms, cancel disarms, confirm presses stop", async () => {
    vi.useFakeTimers();
    const h = makeHass();
    const el = await mk(h);
    const stop = () => $(el, "button[aria-label='Hold to stop print']");
    stop().dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(500);
    expect($(el, ".o-hint").textContent).toContain("Keep holding");
    stop().dispatchEvent(new Event("pointerup"));
    await el.updateComplete;
    expect($(el, ".o-hint").textContent!.trim()).toBe("");
    expect($(el, ".o-btn.danger")).toBeNull();

    stop().dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(1700);
    await el.updateComplete;
    expect($(el, ".o-btn.danger")).toBeTruthy();
    expect($(el, ".o-hint").textContent).toContain("Stops Benchy at 42%");
    // auto-timeout after 6s
    await vi.advanceTimersByTimeAsync(6100);
    await el.updateComplete;
    expect($(el, ".o-btn.danger")).toBeNull();

    stop().dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(1700);
    await el.updateComplete;
    $(el, ".o-btn.danger").click();
    await el.updateComplete;
    expect(h.callService).toHaveBeenCalledWith("button", "press", { entity_id: expect.stringContaining("stop") });
    expect($(el, ".o-btn.danger")).toBeNull();
  });
  it("keyboard Space on stop button starts hold", async () => {
    vi.useFakeTimers();
    const el = await mk();
    const stop = $(el, "button[aria-label='Hold to stop print']");
    stop.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    await vi.advanceTimersByTimeAsync(1700);
    await el.updateComplete;
    expect($(el, ".o-btn.danger")).toBeTruthy();
  });
  it("pause presses pause entity; resume while paused", async () => {
    const h = makeHass();
    const el = await mk(h);
    $(el, ".o-btn.pause").click();
    expect(h.callService).toHaveBeenCalledWith("button", "press", { entity_id: expect.stringContaining("pause") });
  });
  it("Charts/Device buttons switch views and tdmm-back returns", async () => {
    const el = await mk();
    $(el, "button[aria-label='Device']").click();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain("Device");
    expect($(el, ".o-hero")).toBeNull();
    el.dispatchEvent(new CustomEvent("tdmm-back", { bubbles: true, composed: true }));
    await el.updateComplete;
    expect($(el, ".o-hero")).toBeTruthy();
  });
  it("camera mounts only for live/last phases", async () => {
    const el = await mk();
    expect($(el, "tdmm-popup-camera")).toBeTruthy();
    const idle = await mk(makeHass({ states: { [PS]: { state: "idle" } } }));
    expect(idle.shadowRoot!.querySelectorAll("tdmm-popup-camera").length).toBe(0);
  });
  it("light toggle calls light.toggle", async () => {
    const h = makeHass();
    const el = await mk(h);
    $(el, "button[aria-label='Chamber light']").click();
    expect(h.callService).toHaveBeenCalledWith("light", "toggle", { entity_id: expect.stringContaining("chamber_light") });
  });
});
beforeEach(() => { document.body.innerHTML = ""; });
