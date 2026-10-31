import { css, html, nothing } from "lit";
import { registerBlock } from "./registry.ts";
import { fmtInt, fmtPercent, fmtRemaining, isAvailable, present } from "./format.ts";

registerBlock({
  type: "progress", label: "Progress", icon: "layers", size: 2,
  uses: (r) => present(r.byKey.progress, r.byKey.remaining_time, r.byKey.current_layer, r.byKey.total_layers),
  render: (ctx) => {
    const p = ctx.state("progress");
    const rem = ctx.state("remaining_time");
    const cur = ctx.state("current_layer");
    const tot = ctx.state("total_layers");
    if (!p && !rem && !cur && !tot) return nothing;
    const pct = isAvailable(p) ? Math.max(0, Math.min(100, Number(p!.state) || 0)) : 0;
    return html`<div class="tdmm-progress">
      <div class="tdmm-bar"><div class="tdmm-bar-fill" style="width:${pct}%"></div></div>
      <div class="tdmm-progress-row">
        <span class="tdmm-progress-pct">${fmtPercent(p)}</span>
        <span class="tdmm-progress-meta"><ha-icon .icon=${ctx.icon("clock")}></ha-icon>${fmtRemaining(rem)}</span>
        <span class="tdmm-progress-meta"><ha-icon .icon=${ctx.icon("layers")}></ha-icon>${`${fmtInt(cur)}/${fmtInt(tot)}`}</span>
      </div>
    </div>`;
  },
  styles: css`
    .tdmm-progress { display: flex; flex-direction: column; gap: var(--_tdmm-gap); }
    .tdmm-bar { height: 8px; border-radius: var(--_tdmm-radius); background: var(--_tdmm-chip-bg); overflow: hidden; }
    .tdmm-bar-fill { height: 100%; background: var(--_tdmm-progress); }
    .tdmm-progress-row { display: flex; align-items: center; gap: var(--_tdmm-gap); flex-wrap: wrap; }
    .tdmm-progress-pct { font-weight: 600; flex: 1; }
    .tdmm-progress-meta { display: inline-flex; align-items: center; gap: 4px; color: var(--_tdmm-text-secondary); }
    .tdmm-progress-meta ha-icon { --mdc-icon-size: 16px; }
  `,
});
