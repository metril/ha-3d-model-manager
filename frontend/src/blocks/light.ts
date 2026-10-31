import { html, nothing } from "lit";
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
    return html`<button class="tdmm-btn ${on ? "armed" : ""}" ?disabled=${st.state === "unavailable"}
      @click=${() => void ctx.call("light", "toggle", { entity_id: id })}>
      <ha-icon .icon=${ctx.icon("light")}></ha-icon><span>${on ? "Light on" : "Light off"}</span></button>`;
  },
});
