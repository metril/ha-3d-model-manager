import { describe, expect, it } from "vitest";
import { TdmmCameraCard } from "../src/cards/camera/tdmm-camera-card.ts";
import { makeHass } from "./fixtures/hass.js";

if (!customElements.get("tdmm-camera-card")) customElements.define("tdmm-camera-card", TdmmCameraCard);
const mk = async (extra = {}, h = makeHass()) => {
  const el = document.createElement("tdmm-camera-card") as TdmmCameraCard;
  el.setConfig({ type: "custom:tdmm-camera-card", device_id: "dev_p1", ...extra });
  el.hass = h;
  document.body.append(el);
  await el.updateComplete;
  return { el, h };
};
const img = (el: HTMLElement) => el.shadowRoot!.querySelector("hui-image") as (HTMLElement & { cameraView: string; cameraImage: string }) | null;

describe("tdmm-camera-card", () => {
  it("renders hui-image for printer camera with fixture hass", async () => {
    const { el } = await mk();
    expect(img(el)!.cameraImage).toMatch(/^camera\./);
    expect(el.getGridOptions()).toEqual({ columns: 12, rows: "auto", min_columns: 6, min_rows: 3 });
  });
  it("camera_view live passed through", async () => {
    const { el } = await mk({ camera_view: "live" });
    expect(img(el)!.cameraView).toBe("live");
  });
  it("hui-image element is reused across progress updates", async () => {
    const { el, h } = await mk();
    const first = img(el);
    const id = Object.values(h.entities).find((e) => e.translation_key === "progress")!.entity_id;
    el.hass = { ...h, states: { ...h.states, [id]: { ...h.states[id]!, state: "50" } } };
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain("50%");
    expect(img(el)).toBe(first);
  });
  it("no camera entity shows placeholder", async () => {
    const { el } = await mk({}, makeHass({ omit: ["camera"] }));
    expect(img(el)).toBeNull();
    expect(el.shadowRoot!.textContent).toContain("No camera");
  });
});
