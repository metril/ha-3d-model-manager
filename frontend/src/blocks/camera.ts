import { css, html } from "lit";
import { registerBlock } from "./registry.ts";
import { ensureHaElements } from "../editor/load-ha.ts";
import { present } from "./format.ts";

let requested = false;

registerBlock({
  type: "camera", label: "Camera", icon: "camera", size: 2,
  uses: (r) => present(r.byKey.camera),
  render: (ctx) => {
    const id = ctx.resolved.byKey.camera;
    if (!id) return html`<div class="tdmm-camera tdmm-camera-empty">No camera</div>`;
    if (!customElements.get("hui-image") && !requested) {
      requested = true;
      void ensureHaElements();
    }
    return html`<div class="tdmm-camera"><hui-image .hass=${ctx.hass} .cameraImage=${id}
      .cameraView=${ctx.config.camera_view} .fitMode=${"cover"}></hui-image></div>`;
  },
  styles: css`
    .tdmm-camera { border-radius: var(--_tdmm-radius); overflow: hidden; background: var(--_tdmm-chip-bg); }
    .tdmm-camera-empty { padding: var(--_tdmm-gap); text-align: center; color: var(--_tdmm-text-secondary); }
  `,
});
