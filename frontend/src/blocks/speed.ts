import { css, html, nothing } from "lit";
import { registerBlock } from "./registry.ts";
import { fmtText, isAvailable, present } from "./format.ts";

registerBlock({
  type: "speed", label: "Speed", icon: "speed", size: 1,
  uses: (r) => present(r.byKey.speed_profile),
  render: (ctx) => {
    const id = ctx.resolved.byKey.speed_profile;
    const st = ctx.state("speed_profile");
    if (!id || !st) return nothing;
    const options = Array.isArray(st.attributes.options) ? (st.attributes.options as unknown[]).map(String) : [];
    const icon = html`<ha-icon .icon=${ctx.icon("speed")}></ha-icon>`;
    if (!id.startsWith("select.") || !options.length) {
      return html`<div class="tdmm-speed">${icon}<span>${fmtText(st)}</span></div>`;
    }
    const onChange = (e: Event) => void ctx.call("select", "select_option", { entity_id: id, option: (e.target as HTMLSelectElement).value });
    return html`<div class="tdmm-speed">${icon}
      <select class="tdmm-select" ?disabled=${!isAvailable(st)} @change=${onChange}>
        ${options.includes(st.state) ? nothing : html`<option value=${st.state} selected disabled>${st.state}</option>`}
        ${options.map((o) => html`<option value=${o} ?selected=${o === st.state}>${o}</option>`)}
      </select></div>`;
  },
  styles: css`
    .tdmm-speed { display: flex; align-items: center; gap: var(--_tdmm-gap); text-transform: capitalize; }
    .tdmm-speed ha-icon { --mdc-icon-size: 18px; color: var(--_tdmm-accent); }
    .tdmm-select { font: inherit; color: var(--_tdmm-text); background: var(--_tdmm-chip-bg); border: 0; border-radius: var(--_tdmm-radius); padding: 4px var(--_tdmm-gap); text-transform: capitalize; }
  `,
});
