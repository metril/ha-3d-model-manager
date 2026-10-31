import { css, html, nothing } from "lit";
import type { IconName } from "./types.ts";
import type { EntityKey } from "../entities.ts";
import { registerBlock } from "./registry.ts";
import { fmtTemp, present } from "./format.ts";

const ROWS: { icon: IconName; label: string; cur: EntityKey; tgt?: EntityKey }[] = [
  { icon: "nozzle", label: "Nozzle", cur: "nozzle_temperature", tgt: "nozzle_target_temperature" },
  { icon: "bed", label: "Bed", cur: "bed_temperature", tgt: "bed_target_temperature" },
  { icon: "chamber", label: "Chamber", cur: "chamber_temperature" },
];

registerBlock({
  type: "temps", label: "Temperatures", icon: "nozzle", size: 1,
  uses: (r) => present(...ROWS.flatMap((x) => [r.byKey[x.cur], x.tgt ? r.byKey[x.tgt] : undefined])),
  render: (ctx) => {
    const rows = ROWS.filter((x) => ctx.state(x.cur));
    if (!rows.length) return nothing;
    return html`<div class="tdmm-temps">${rows.map((x) => html`
      <div class="tdmm-temp">
        <ha-icon .icon=${ctx.icon(x.icon)} title=${x.label}></ha-icon>
        <span class="tdmm-temp-val">${fmtTemp(ctx.state(x.cur))}${x.tgt && ctx.state(x.tgt) ? html` <span class="tdmm-temp-target">/ ${fmtTemp(ctx.state(x.tgt))}</span>` : nothing}</span>
      </div>`)}</div>`;
  },
  styles: css`
    .tdmm-temps { display: flex; flex-wrap: wrap; gap: var(--_tdmm-gap); }
    .tdmm-temp { display: inline-flex; align-items: center; gap: 4px; background: var(--_tdmm-chip-bg); border-radius: var(--_tdmm-radius); padding: 4px var(--_tdmm-gap); }
    .tdmm-temp ha-icon { --mdc-icon-size: 18px; color: var(--_tdmm-accent); }
    .tdmm-temp-target { color: var(--_tdmm-text-secondary); }
  `,
});
