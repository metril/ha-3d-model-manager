import { describe, expect, it } from "vitest";
import { TdmmOlymposAmsCard } from "../src/olympos/ams/tdmm-olympos-ams-card.ts";
import { makeHass } from "./fixtures/hass.js";

if (!customElements.get("tdmm-olympos-ams-card")) customElements.define("tdmm-olympos-ams-card", TdmmOlymposAmsCard);
const mk = async (h = makeHass()) => {
  const el = document.createElement("tdmm-olympos-ams-card") as TdmmOlymposAmsCard;
  el.setConfig({ type: "custom:tdmm-olympos-ams-card", device_id: "dev_p1" });
  el.hass = h;
  document.body.append(el);
  await el.updateComplete;
  return el;
};

describe("olympos ams card", () => {
  it("one row per unit with labelled chips and one shared detail line", async () => {
    const el = await mk(makeHass({ amsUnits: 2 }));
    const r = el.shadowRoot!;
    expect(r.querySelectorAll(".olp-unit")).toHaveLength(2);
    expect(r.querySelectorAll(".olp-detail")).toHaveLength(1);
    expect(r.querySelector(".olp-unit-head")!.textContent).toContain("AMS 1");
    expect([...r.querySelectorAll(".olp-chip")].every((c) => c.getAttribute("aria-label"))).toBe(true);
    expect(r.querySelector('.olp-chip[aria-label^="Humidity"]')).toBeTruthy();
    expect(r.querySelectorAll("button.olp-spool")).toHaveLength(9);
  });
  it("tap selects and updates the detail line", async () => {
    const el = await mk();
    const r = el.shadowRoot!;
    r.querySelectorAll<HTMLButtonElement>("button.olp-spool")[1]!.click();
    await el.updateComplete;
    expect(r.querySelector(".olp-detail")!.textContent).toContain("Tray 2");
    expect(r.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(1);
  });
});
