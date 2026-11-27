import { afterEach, describe, expect, it, vi } from "vitest";
import { TdmmOlymposPrinterCard } from "../src/olympos/printer/tdmm-olympos-printer-card.ts";
import { TdmmOlymposCamera } from "../src/olympos/ui/camera.ts";
import { AMS_KEYS, PRINTER_KEYS } from "../src/olympos/keys.ts";
import { makeHass } from "./fixtures/hass.js";

const TAG = "tdmm-olympos-printer-card";
if (!customElements.get(TAG)) customElements.define(TAG, TdmmOlymposPrinterCard);
const mk = async (h = makeHass()) => {
  const el = document.createElement(TAG) as TdmmOlymposPrinterCard;
  el.setConfig({ type: `custom:${TAG}`, device_id: "dev_p1" });
  el.hass = h;
  document.body.append(el);
  await el.updateComplete;
  return el;
};
const $ = (el: HTMLElement, sel: string) => el.shadowRoot!.querySelector<HTMLElement>(sel)!;
const STOP = "button[aria-label='Hold to stop print']";
const PS = "sensor.x1c_garage_print_state_renamed";

afterEach(() => { document.body.innerHTML = ""; vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("review fixes", () => {
  it("hold fill grows between frames", async () => {
    vi.useFakeTimers();
    const el = await mk();
    $(el, STOP).dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(400);
    await el.updateComplete;
    const h1 = parseInt($(el, ".o-fill").style.height);
    await vi.advanceTimersByTimeAsync(400);
    await el.updateComplete;
    const h2 = parseInt($(el, ".o-fill").style.height);
    expect(h1).toBeGreaterThan(0);
    expect(h2).toBeGreaterThan(h1);
  });
  it("camera is not mounted before the IntersectionObserver reports", async () => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
    if (!customElements.get("tdmm-olympos-camera")) customElements.define("tdmm-olympos-camera", TdmmOlymposCamera);
    const cam = document.createElement("tdmm-olympos-camera") as TdmmOlymposCamera;
    cam.entity = { entity_id: "camera.x", state: "streaming", attributes: {} } as never;
    cam.mode = "live";
    document.body.append(cam);
    await cam.updateComplete;
    expect(cam.shadowRoot!.querySelector("ha-camera-stream")).toBeNull();
  });
  it("keys include active filament", () => {
    for (const k of ["active_filament_material", "active_filament_color"] as const) {
      expect(PRINTER_KEYS).toContain(k);
      expect(AMS_KEYS).toContain(k);
    }
  });
  it("reconnect after charts view shows main and restarts paused ticker", async () => {
    vi.useFakeTimers();
    const el = await mk(makeHass({ states: { [PS]: { state: "pause" } } }));
    $(el, "button[aria-label='Charts']").click();
    await el.updateComplete;
    expect($(el, ".o-hero")).toBeNull();
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
    document.body.append(el);
    await el.updateComplete;
    expect($(el, ".o-hero")).toBeTruthy();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });
  it("arming Stop moves focus to Cancel", async () => {
    vi.useFakeTimers();
    const el = await mk();
    $(el, STOP).dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(1700);
    await el.updateComplete;
    const cancel = $(el, ".o-ctl-row.two .o-btn");
    expect(el.shadowRoot!.activeElement).toBe(cancel);
  });
});
