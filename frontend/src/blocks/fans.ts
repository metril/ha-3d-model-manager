import { css, html, nothing } from "lit";
import type { EntityKey } from "../entities.ts";
import { registerBlock } from "./registry.ts";
import { isAvailable, present } from "./format.ts";

const FANS: { key: EntityKey; label: string }[] = [
  { key: "part_fan", label: "Part fan" },
  { key: "aux_fan", label: "Aux fan" },
  { key: "chamber_fan", label: "Chamber fan" },
];

registerBlock({
  type: "fans", label: "Fans", icon: "fan", size: 1,
  uses: (r) => present(...FANS.map((f) => r.byKey[f.key])),
  render: (ctx) => {
    const rows = FANS.filter((f) => ctx.state(f.key));
    if (!rows.length) return nothing;
    return html`<div class="tdmm-fans">${rows.map((f) => {
      const id = ctx.resolved.byKey[f.key]!;
      const st = ctx.state(f.key)!;
      const pct = Number(st.attributes.percentage);
      const value = Number.isFinite(pct) ? pct : 0;
      const onChange = (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value);
        if (Number.isFinite(v)) void ctx.call("fan", "set_percentage", { entity_id: id, percentage: v });
      };
      const disabled = !isAvailable(st);
      const slider = customElements.get("ha-slider")
        ? html`<ha-slider min="0" max="100" step="10" labeled .value=${value} ?disabled=${disabled} @change=${onChange}></ha-slider>`
        : html`<input type="range" min="0" max="100" step="10" .value=${String(value)} ?disabled=${disabled} @change=${onChange} />`;
      return html`<div class="tdmm-fan"><ha-icon .icon=${ctx.icon("fan")}></ha-icon><span class="tdmm-fan-label">${f.label}</span>${slider}</div>`;
    })}</div>`;
  },
  styles: css`
    .tdmm-fans { display: flex; flex-direction: column; gap: var(--_tdmm-gap); }
    .tdmm-fan { display: flex; align-items: center; gap: var(--_tdmm-gap); }
    .tdmm-fan ha-icon { --mdc-icon-size: 18px; color: var(--_tdmm-accent); }
    .tdmm-fan-label { min-width: 6em; color: var(--_tdmm-text-secondary); }
    .tdmm-fan input[type="range"], .tdmm-fan ha-slider { flex: 1; accent-color: var(--_tdmm-accent); }
  `,
});
