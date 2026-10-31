import { css, html, nothing } from "lit";
import { registerBlock } from "./registry.ts";
import { fmtText, isAvailable, present } from "./format.ts";
import { colorStyle } from "./filament.ts";

registerBlock({
  type: "ext", label: "External spool", icon: "spool", size: 1,
  uses: (r) => present(r.byKey.external_spool_material, r.byKey.external_spool_color),
  render: (ctx) => {
    const mat = ctx.state("external_spool_material");
    const col = ctx.state("external_spool_color");
    if (!mat && !col) return nothing;
    return html`<div class="tdmm-ext"><span class="tdmm-spool-chip">
      <span class="tdmm-swatch" style=${colorStyle(isAvailable(col) ? col!.state : undefined)}></span>
      <span class="tdmm-spool-name">External</span><strong>${fmtText(mat)}</strong></span></div>`;
  },
  styles: css`
    .tdmm-spool-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--_tdmm-chip-bg); border-radius: var(--_tdmm-radius); padding: 4px var(--_tdmm-gap); }
    .tdmm-swatch { width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--_tdmm-text-secondary); flex: none; }
    .tdmm-spool-name { color: var(--_tdmm-text-secondary); }
  `,
});
