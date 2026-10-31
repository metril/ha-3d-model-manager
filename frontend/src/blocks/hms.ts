import { css, html, nothing } from "lit";
import { registerBlock } from "./registry.ts";
import { fmtText, present } from "./format.ts";

registerBlock({
  type: "hms", label: "HMS alert", icon: "alert", size: 1,
  uses: (r) => present(r.byKey.hms_active, r.byKey.print_error),
  render: (ctx) => {
    if (ctx.state("hms_active")?.state !== "on") return nothing;
    return html`<div class="tdmm-hms">
      <ha-icon .icon=${ctx.icon("alert")}></ha-icon>
      <span>${fmtText(ctx.state("print_error"))}</span>
    </div>`;
  },
  styles: css`
    .tdmm-hms { display: flex; align-items: center; gap: var(--_tdmm-gap); padding: var(--_tdmm-gap); border-radius: var(--_tdmm-radius); background: var(--_tdmm-chip-bg); color: var(--_tdmm-text); border-left: 4px solid var(--_tdmm-accent); }
    .tdmm-hms ha-icon { --mdc-icon-size: var(--_tdmm-icon-size); color: var(--_tdmm-accent); }
  `,
});
