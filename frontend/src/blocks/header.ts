import { css, html, nothing } from "lit";
import { registerBlock } from "./registry.ts";
import { fmtEnum, fmtText, present } from "./format.ts";

registerBlock({
  type: "header", label: "Header", icon: "printer", size: 1,
  uses: (r) => present(r.byKey.current_model, r.byKey.print_state),
  render: (ctx) => {
    const model = ctx.state("current_model");
    const st = ctx.state("print_state");
    if (!model && !st) return nothing;
    return html`<div class="tdmm-header">
      <ha-icon .icon=${ctx.icon("printer")}></ha-icon>
      <span class="tdmm-header-name">${fmtText(model)}</span>
      <span class="tdmm-chip">${fmtEnum(ctx.hass, st)}</span>
    </div>`;
  },
  styles: css`
    .tdmm-header { display: flex; align-items: center; gap: var(--_tdmm-gap); }
    .tdmm-header ha-icon { --mdc-icon-size: var(--_tdmm-icon-size); color: var(--_tdmm-accent); }
    .tdmm-header-name { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tdmm-chip { background: var(--_tdmm-chip-bg); color: var(--_tdmm-text-secondary); border-radius: var(--_tdmm-radius); padding: 2px var(--_tdmm-gap); text-transform: capitalize; }
  `,
});
