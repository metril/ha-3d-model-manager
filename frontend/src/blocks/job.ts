import { css, html, nothing } from "lit";
import { registerBlock } from "./registry.ts";
import { fmtEnum, fmtText, present } from "./format.ts";

registerBlock({
  type: "job", label: "Current job", icon: "printer", size: 2,
  uses: (r) => present(r.byKey.print_thumbnail, r.byKey.current_model, r.byKey.stage),
  render: (ctx) => {
    const thumb = ctx.state("print_thumbnail");
    const model = ctx.state("current_model");
    const stage = ctx.state("stage");
    if (!thumb && !model && !stage) return nothing;
    const pic = thumb?.attributes.entity_picture;
    return html`<div class="tdmm-job">
      ${typeof pic === "string" && pic ? html`<img class="tdmm-job-thumb" src=${pic} alt="Print preview" />` : nothing}
      <div class="tdmm-job-info">
        <span class="tdmm-job-name">${fmtText(model)}</span>
        ${stage ? html`<span class="tdmm-job-stage">${fmtEnum(ctx.hass, stage)}</span>` : nothing}
      </div>
    </div>`;
  },
  styles: css`
    .tdmm-job { display: flex; align-items: center; gap: var(--_tdmm-gap); }
    .tdmm-job-thumb { width: 72px; height: 72px; object-fit: cover; border-radius: var(--_tdmm-radius); background: var(--_tdmm-chip-bg); }
    .tdmm-job-info { display: flex; flex-direction: column; min-width: 0; }
    .tdmm-job-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tdmm-job-stage { color: var(--_tdmm-text-secondary); text-transform: capitalize; }
  `,
});
