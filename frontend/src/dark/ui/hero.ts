import { css, html, nothing, type TemplateResult } from "lit";
import { fmtInt, fmtRemaining, isAvailable } from "../../blocks/format.ts";
import type { HassEntity } from "../../ha-types.ts";
import type { DarkCtx, Phase } from "../contracts.ts";
import { fmtClock, fmtEta } from "../logic/format.ts";
import { isActive } from "../logic/gating.ts";

const num = (s?: HassEntity): number | undefined => {
  if (!isAvailable(s) || (s as HassEntity).state.trim() === "") return undefined;
  const n = Number((s as HassEntity).state);
  return Number.isFinite(n) ? n : undefined;
};

export interface HeroView { big: string; size: number; l1: string; l2: string; l3: string; pct: number; bar: boolean }

export function heroView(ctx: DarkCtx, pausedFor: string): HeroView {
  const p: Phase = ctx.phase;
  const progress = num(ctx.state("progress"));
  const pct = Math.max(0, Math.min(100, Math.round(progress ?? 0)));
  const cur = num(ctx.state("current_layer"));
  const tot = num(ctx.state("total_layers"));
  const layers = cur !== undefined && tot !== undefined ? `${fmtInt(ctx.state("current_layer"))} / ${fmtInt(ctx.state("total_layers"))} layers` : "";
  const model = ctx.state("current_model");
  const job = isAvailable(model) && model?.state !== "none" ? (model as HassEntity).state : "";
  const locale = ctx.hass.locale.language;
  const changed = fmtClock(ctx.state("print_state")?.last_changed, locale);
  const rem = isAvailable(ctx.state("remaining_time")) ? fmtRemaining(ctx.state("remaining_time")) : "";
  if (isActive(p)) {
    const eta = fmtEta(ctx.state("end_time")?.state, ctx.now, locale);
    const left = rem ? `${rem} left` : "";
    const l2 = p === "paused" ? [`Paused ${pausedFor}`, left].filter(Boolean).join(" · ") : [left, eta ? `ETA ${eta}` : ""].filter(Boolean).join(" · ");
    return { big: `${pct}%`, size: 52, l1: layers, l2, l3: job, pct, bar: true };
  }
  switch (p) {
    case "finished": return { big: "Done", size: 40, l1: layers, l2: changed ? `Finished ${changed}` : "Finished", l3: job, pct: 100, bar: true };
    case "failed": {
      const err = ctx.state("print_error");
      const why = isAvailable(err) && err?.state !== "none" ? (err as HassEntity).state.replace(/_/g, " ") : "";
      return { big: "Failed", size: 40, l1: cur !== undefined && tot !== undefined ? `Stopped at layer ${cur} / ${tot}` : "", l2: [why, changed].filter(Boolean).join(" · "), l3: job, pct, bar: true };
    }
    case "offline": return { big: "Offline", size: 40, l1: fmtClock(ctx.state("online")?.last_changed, locale) ? `Last seen ${fmtClock(ctx.state("online")?.last_changed, locale)}` : "", l2: "", l3: "", pct: 0, bar: false };
    default: return { big: "Idle", size: 40, l1: "Ready to print", l2: "", l3: "", pct: 0, bar: false };
  }
}

export function renderHero(ctx: DarkCtx, pausedFor: string): TemplateResult {
  const h = heroView(ctx, pausedFor);
  const pic = ctx.state("print_thumbnail")?.attributes.entity_picture;
  const color = ctx.phase === "failed" ? "var(--_tdmm-fault)" : ctx.phase === "offline" ? "var(--_tdmm-text-secondary)" : "var(--_tdmm-text)";
  const bar = ctx.phase === "failed" ? "var(--_tdmm-fault)" : ctx.phase === "paused" ? "var(--_tdmm-warn)" : "var(--_tdmm-progress)";
  return html`<section class="o-card o-hero">
    <div class="o-hero-row">
      <div class="o-thumb">${typeof pic === "string" && pic && ctx.phase !== "offline"
        ? html`<img src=${pic} alt="Model preview" loading="lazy" />`
        : html`<ha-icon icon=${ctx.icon("nozzle")} aria-hidden="true"></ha-icon>`}</div>
      <div class="o-hero-text">
        <div class="o-big" style="font-size:${h.size}px;color:${color}">${h.big}</div>
        <div class="o-l1">${h.l1}</div>
        <div class="o-l2">${h.l2}</div>
        <div class="o-l2">${h.l3}</div>
      </div>
    </div>
    ${h.bar ? html`<div class="o-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${h.pct} aria-label="Print progress"><div style="width:${h.pct}%;background:${bar}"></div></div>` : nothing}
  </section>`;
}

export const heroStyles = css`
  .o-card { background: var(--_tdmm-surface-2); border-radius: 20px; padding: 12px; box-sizing: border-box; }
  .o-hero { display: flex; flex-direction: column; gap: 12px; }
  .o-hero-row { display: flex; gap: 12px; align-items: stretch; }
  .o-thumb { width: clamp(120px, 44%, 220px); flex: none; aspect-ratio: 1; background: var(--_tdmm-deep); border-radius: 16px; display: flex; align-items: center; justify-content: center; color: var(--_tdmm-text-secondary); overflow: hidden; --mdc-icon-size: 48px; }
  .o-thumb img { width: 100%; height: 100%; object-fit: contain; }
  .o-hero-text { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
  .o-big { font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
  .o-l1 { font-size: 13px; font-weight: 500; font-variant-numeric: tabular-nums; }
  .o-l2 { font-size: 12px; color: var(--_tdmm-text-secondary); overflow-wrap: anywhere; }
  .o-bar { height: 10px; border-radius: 5px; background: var(--_tdmm-surface-3); overflow: hidden; }
  .o-bar > div { height: 100%; border-radius: 5px; }
`;
