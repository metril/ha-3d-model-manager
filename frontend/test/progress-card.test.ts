import { describe, expect, it, vi } from "vitest";
import { TdmmProgressCard } from "../src/cards/progress/tdmm-progress-card.ts";
import { makeHass } from "./fixtures/hass.js";

if (!customElements.get("tdmm-progress-card")) customElements.define("tdmm-progress-card", TdmmProgressCard);
const cfg = (extra = {}) => ({ type: "custom:tdmm-progress-card", device_id: "dev_p1", ...extra });
const mk = async (extra = {}, h = makeHass()) => {
  const el = document.createElement("tdmm-progress-card") as TdmmProgressCard;
  el.setConfig(cfg(extra));
  el.hass = h;
  document.body.append(el);
  await el.updateComplete;
  return el;
};

describe("tdmm-progress-card", () => {
  it("progress card renders with fixture hass", async () => {
    const el = await mk();
    expect(el.shadowRoot!.textContent).toContain("42%");
  });
  it("progress card hides hidden block", async () => {
    const el = await mk({ blocks: [{ type: "header" }, { type: "progress", hidden: true }, { type: "job" }] });
    expect(el.shadowRoot!.querySelector(".tdmm-progress")).toBeNull();
    expect(el.shadowRoot!.textContent).not.toContain("42%");
  });
  it("progress card does not re-render on unrelated state", async () => {
    const h = makeHass();
    const el = await mk({}, h);
    const spy = vi.spyOn(el as unknown as { render(): unknown }, "render");
    el.hass = { ...h, states: { ...h.states, "sensor.unrelated": { entity_id: "sensor.unrelated", state: "1", attributes: {}, last_changed: "", last_updated: "" } } };
    await el.updateComplete;
    expect(spy).not.toHaveBeenCalled();
  });
  it("getStubConfig picks first tdmm device", () => {
    expect(TdmmProgressCard.getStubConfig(makeHass()).device_id).toBe("dev_p1");
    expect(TdmmProgressCard.getStubConfig({ ...makeHass(), entities: {} }).device_id).toBe("");
  });
});
