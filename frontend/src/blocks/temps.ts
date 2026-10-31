import { css, html, nothing } from "lit";
import type { IconName } from "./types.ts";
import type { EntityKey } from "../entities.ts";
import { registerBlock } from "./registry.ts";
import { fmtTemp, isAvailable, present } from "./format.ts";

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
    const editable = ctx.tab === "control";
    const target = (x: (typeof ROWS)[number]) => {
      const id = x.tgt ? ctx.resolved.byKey[x.tgt] : undefined;
      const st = x.tgt ? ctx.state(x.tgt) : undefined;
      if (!id || !st) return nothing;
      if (editable && id.startsWith("number.")) {
        const onChange = (e: Event) => {
          const v = Number((e.target as HTMLInputElement).value);
          if (Number.isFinite(v)) void ctx.call("number", "set_value", { entity_id: id, value: v });
        };
        return html` <span class="tdmm-temp-target">/ <input class="tdmm-temp-input" type="number" aria-label=${`${x.label} target`}
          .value=${isAvailable(st) ? String(Math.round(Number(st.state))) : ""} ?disabled=${!isAvailable(st)} @change=${onChange} /></span>`;
      }
      return html` <span class="tdmm-temp-target">/ ${fmtTemp(st)}</span>`;
    };
    return html`<div class="tdmm-temps">${rows.map((x) => html`
      <div class="tdmm-temp">
        <ha-icon .icon=${ctx.icon(x.icon)} title=${x.label}></ha-icon>
        <span class="tdmm-temp-val">${fmtTemp(ctx.state(x.cur))}${target(x)}</span>
      </div>`)}</div>`;
  },
  styles: css`
    .tdmm-temps { display: flex; flex-wrap: wrap; gap: var(--_tdmm-gap); }
    .tdmm-temp { display: inline-flex; align-items: center; gap: 4px; background: var(--_tdmm-chip-bg); border-radius: var(--_tdmm-radius); padding: 4px var(--_tdmm-gap); }
    .tdmm-temp ha-icon { --mdc-icon-size: 18px; color: var(--_tdmm-accent); }
    .tdmm-temp-target { color: var(--_tdmm-text-secondary); }
    .tdmm-temp-input { width: 4.5em; font: inherit; color: var(--_tdmm-text); background: transparent; border: 1px solid var(--_tdmm-text-secondary); border-radius: var(--_tdmm-radius); padding: 2px 4px; }
  `,
});
