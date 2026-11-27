import { css, html, type TemplateResult } from "lit";
import type { HoldState, OlymposCtx } from "../contracts.ts";
import { fmtMinutes, timeLost } from "../logic/format.ts";
import { controlsEnabled } from "../logic/gating.ts";
import { holdProgress } from "../logic/hold.ts";

export interface ControlProps {
  hold: HoldState;
  pausedFor: string;
  onPause(): void;
  onResume(): void;
  onHoldDown(): void;
  onHoldUp(): void;
  onCancel(): void;
  onConfirm(): void;
}

/** Fixed-height consequence line text. */
export function consequence(ctx: OlymposCtx, hold: HoldState): string {
  if (hold.kind === "holding") return "Keep holding…";
  if (hold.kind !== "armed") return "";
  const model = ctx.state("current_model")?.state;
  const job = model && model !== "none" && model !== "unavailable" && model !== "unknown" ? model : "the print";
  const pct = Number(ctx.state("progress")?.state);
  const lost = timeLost(pct / 100, Number(ctx.state("remaining_time")?.state));
  const at = Number.isFinite(pct) ? ` at ${Math.round(pct)}%` : "";
  return `Stops ${job}${at}${lost !== undefined ? ` · ${fmtMinutes(lost)} of printing lost` : ""}`;
}

export function renderControlBar(ctx: OlymposCtx, p: ControlProps): TemplateResult {
  const en = controlsEnabled(ctx.phase);
  const paused = ctx.phase === "paused";
  const armed = p.hold.kind === "armed";
  const fill = holdProgress(p.hold, ctx.now);
  const onKey = (e: KeyboardEvent) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); p.onHoldDown(); } };
  const onKeyUp = (e: KeyboardEvent) => { if (e.key === " " || e.key === "Enter") p.onHoldUp(); };
  return html`<section class="o-card o-ctl ${ctx.phase === "offline" ? "off" : ""}" aria-label="Print controls">
    ${armed ? html`<div class="o-ctl-row two">
      <button type="button" class="o-btn" @click=${p.onCancel}>Cancel</button>
      <button type="button" class="o-btn danger" @click=${p.onConfirm}>Confirm stop</button>
    </div>` : html`<div class="o-ctl-row">
      <button type="button" class="o-btn pause" ?disabled=${!(en.pause || en.resume)} @click=${paused ? p.onResume : p.onPause}>
        <ha-icon icon=${ctx.icon(paused ? "play" : "pause")} aria-hidden="true"></ha-icon>
        <span class="o-btn-l"><span>${paused ? "Resume" : "Pause"}</span>${paused ? html`<span class="o-btn-s">Paused ${p.pausedFor}</span>` : ""}</span>
      </button>
      <button type="button" class="o-btn stop" aria-label="Hold to stop print" ?disabled=${!en.stop}
        @pointerdown=${p.onHoldDown} @pointerup=${p.onHoldUp} @pointerleave=${p.onHoldUp} @pointercancel=${p.onHoldUp}
        @keydown=${onKey} @keyup=${onKeyUp} @contextmenu=${(e: Event) => e.preventDefault()}>
        <span class="o-fill" style="height:${Math.round(fill * 100)}%"></span>
        <ha-icon icon=${ctx.icon("stop")} aria-hidden="true"></ha-icon>
      </button>
    </div>`}
    <div class="o-hint ${armed ? "armed" : ""}" role="status" aria-live="polite">${consequence(ctx, p.hold)}</div>
  </section>`;
}

export const controlStyles = css`
  .o-ctl { display: flex; flex-direction: column; gap: 6px; padding: 8px 8px 10px; }
  .o-ctl.off { opacity: 0.4; }
  .o-ctl-row { display: grid; grid-template-columns: minmax(0, 1fr) 48px; gap: 8px; }
  .o-ctl-row.two { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .o-btn { position: relative; overflow: hidden; border: 0; margin: 0; cursor: pointer; height: 48px; min-width: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; font: 600 13px/16px inherit; font-family: inherit; background: var(--_tdmm-chip-bg); color: var(--_tdmm-text); }
  .o-btn.pause { background: color-mix(in srgb, var(--_tdmm-accent) 16%, transparent); color: var(--_tdmm-accent); }
  .o-btn.stop { touch-action: none; user-select: none; -webkit-user-select: none; color: var(--_tdmm-fault); background: color-mix(in srgb, var(--_tdmm-fault) 16%, transparent); }
  .o-btn.danger { background: var(--_tdmm-fault); color: var(--_tdmm-deep); }
  .o-btn:disabled { opacity: 0.4; cursor: default; }
  .o-btn-l { display: flex; flex-direction: column; align-items: flex-start; line-height: 16px; }
  .o-btn-s { font-size: 11px; font-weight: 500; line-height: 14px; color: var(--_tdmm-warn); }
  .o-fill { position: absolute; left: 0; right: 0; bottom: 0; background: color-mix(in srgb, var(--_tdmm-fault) 45%, transparent); pointer-events: none; }
  .o-btn ha-icon { position: relative; }
  .o-hint { height: 16px; line-height: 16px; padding: 0 4px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--_tdmm-text-secondary); }
  .o-hint.armed { color: var(--_tdmm-fault); }
`;
