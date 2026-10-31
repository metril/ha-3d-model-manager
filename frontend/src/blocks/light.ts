import { css, html, nothing } from "lit";
import { registerBlock } from "./registry.ts";
import { present } from "./format.ts";

registerBlock({
  type: "light", label: "Chamber light", icon: "light", size: 1,
  uses: (r) => present(r.byKey.chamber_light),
  render: (ctx) => {
    const id = ctx.resolved.byKey.chamber_light;
    const st = ctx.state("chamber_light");
    if (!id || !st) return nothing;
    const on = st.state === "on";
    return html`<button class="tdmm-light ${on ? "on" : ""}" ?disabled=${st.state === "unavailable"}
      @click=${() => void ctx.call("light", "toggle", { entity_id: id })}>
      <ha-icon .icon=${ctx.icon("light")}></ha-icon><span>${on ? "Light on" : "Light off"}</span></button>`;
  },
  styles: css`
    .tdmm-light { display: inline-flex; align-items: center; gap: 4px; font: inherit; color: var(--_tdmm-text); background: var(--_tdmm-chip-bg); border: 0; border-radius: var(--_tdmm-radius); padding: 6px var(--_tdmm-gap); cursor: pointer; }
    .tdmm-light ha-icon { --mdc-icon-size: 18px; color: var(--_tdmm-accent); }
    .tdmm-light.on { outline: 2px solid var(--_tdmm-accent); }
    .tdmm-light:disabled { opacity: 0.5; cursor: default; }
  `,
});
