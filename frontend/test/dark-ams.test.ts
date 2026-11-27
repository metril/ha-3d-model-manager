import { describe, expect, it } from "vitest";
import { TdmmSpoolsCard } from "../src/dark/ams/tdmm-spools-card.ts";
import { makeHass } from "./fixtures/hass.js";

if (!customElements.get("tdmm-spools-card")) customElements.define("tdmm-spools-card", TdmmSpoolsCard);
const mk = async (h = makeHass()) => {
  const el = document.createElement("tdmm-spools-card") as TdmmSpoolsCard;
  el.setConfig({ type: "custom:tdmm-spools-card", device_id: "dev_p1" });
  el.hass = h;
  document.body.append(el);
  await el.updateComplete;
  return el;
};

describe("dark ams card", () => {
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
