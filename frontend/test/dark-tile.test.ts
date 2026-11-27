import { describe, expect, it } from "vitest";
import { TdmmPrinterTileCard } from "../src/dark/tile/tdmm-printer-tile-card.ts";
import { makeHass } from "./fixtures/hass.js";

if (!customElements.get("tdmm-printer-tile-card")) customElements.define("tdmm-printer-tile-card", TdmmPrinterTileCard);
const mk = async (h = makeHass(), cfg: Record<string, unknown> = {}) => {
  const el = document.createElement("tdmm-printer-tile-card") as TdmmPrinterTileCard;
  el.setConfig({ type: "custom:tdmm-printer-tile-card", device_id: "dev_p1", ...cfg });
  el.hass = h;
  document.body.append(el);
  await el.updateComplete;
  return el;
};
const withState = (key: string, state: string) => {
  const h = makeHass();
  const id = Object.values(h.entities).find((e) => e.translation_key === key && e.entity_id.startsWith(key === "online" ? "binary_sensor" : "sensor"))!.entity_id;
  return { ...h, states: { ...h.states, [id]: { ...h.states[id]!, state } } };
};

describe("dark tile", () => {
  it("compact printing", async () => {
    const r = (await mk()).shadowRoot!;
    expect(r.querySelector(".line")!.textContent).toBe("42% · 60 min".replace("60 min", "1 h 0 min"));
    expect(r.querySelector(".badge")!.textContent).toBe("Printing");
    expect(r.querySelector(".bar")).toBeNull();
    expect(r.querySelector("button")!.getAttribute("aria-label")).toContain("X1C Garage");
  });
  it("wide adds bar, job", async () => {
    const r = (await mk(makeHass(), { variant: "wide" })).shadowRoot!;
    expect(r.querySelector(".bar")!.getAttribute("aria-valuenow")).toBe("42");
    expect(r.querySelector(".job")!.textContent).toBe("Benchy");
  });
  it("failed and offline", async () => {
    let r = (await mk(withState("print_state", "failed"))).shadowRoot!;
    expect(r.querySelector(".line")!.textContent).toBe("Failed · layer 120");
    expect(r.querySelector(".tile.failed")).toBeTruthy();
    r = (await mk(withState("print_state", "idle"))).shadowRoot!;
    expect(r.querySelector(".line")!.textContent).toBe("Idle");
    r = (await mk(withState("online", "off"))).shadowRoot!;
    expect(r.querySelector(".line")!.textContent).toBe("Offline");
    expect(r.querySelector(".tile.offline")).toBeTruthy();
  });
  it("tap dispatches hass-action (default navigate, more-info gets entity)", async () => {
    const el = await mk();
    const got: CustomEvent[] = [];
    el.addEventListener("hass-action", (e) => got.push(e as CustomEvent));
    el.shadowRoot!.querySelector("button")!.click();
    expect(got[0]!.detail.config.tap_action).toEqual({ action: "navigate", navigation_path: "#printer" });
    expect(got[0]!.detail.action).toBe("tap");
    const el2 = await mk(makeHass(), { tap_action: { action: "more-info" } });
    el2.addEventListener("hass-action", (e) => got.push(e as CustomEvent));
    el2.shadowRoot!.querySelector("button")!.click();
    expect(got[1]!.detail.config.tap_action.entity).toMatch(/print_state/);
  });
});
