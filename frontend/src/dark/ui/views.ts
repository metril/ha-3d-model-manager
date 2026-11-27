import { css, html, type TemplateResult } from "lit";
import type { ChartRange } from "../contracts.ts";

export const RANGES: readonly ChartRange[] = ["1h", "6h", "24h"];

/** Back button + title. Fires a bubbling, composed `tdmm-back` event for the card to handle. */
export function backHeader(title: string, subtitle: string): TemplateResult {
  const back = (e: Event) => (e.currentTarget as HTMLElement).dispatchEvent(new CustomEvent("tdmm-back", { bubbles: true, composed: true }));
  return html`<div class="v-head">
    <button type="button" class="v-back" aria-label="Back" @click=${back}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
    <div class="v-ht"><div class="v-h1">${title}</div><div class="v-sub">${subtitle}</div></div></div>`;
}

export function rangePicker(range: ChartRange, onPick: (r: ChartRange) => void): TemplateResult {
  return html`<div role="group" aria-label="Time range" class="v-range">
    ${RANGES.map((r) => html`<button type="button" aria-pressed=${r === range ? "true" : "false"} @click=${() => onPick(r)}>${r}</button>`)}</div>`;
}

export const viewStyles = css`
  .v-wrap { padding: 12px; display: flex; flex-direction: column; gap: 12px; color: var(--_tdmm-text); background: var(--_tdmm-surface-1); }
  .v-card { background: var(--_tdmm-surface-2); border-radius: 20px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .v-card.ph { height: 300px; align-items: center; justify-content: center; font-size: 13px; color: var(--_tdmm-text-secondary); text-align: center; }
  .v-t { font-size: 13px; font-weight: 600; }
  .v-head { display: flex; align-items: flex-start; gap: 12px; }
  .v-back { width: 44px; height: 44px; flex: none; border: 0; border-radius: 22px; background: var(--_tdmm-surface-3); color: var(--_tdmm-text); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
  .v-ht { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding-top: 2px; }
  .v-h1 { font-size: 20px; font-weight: 700; line-height: 28px; color: var(--_tdmm-text); }
  .v-sub { font-size: 12px; color: var(--_tdmm-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .v-range { display: flex; gap: 8px; }
  .v-range button { flex: 1; height: 44px; border: 0; border-radius: 22px; font-weight: 600; font-size: 13px; font-family: inherit; cursor: pointer; background: var(--_tdmm-chip-bg); color: var(--_tdmm-text); }
  .v-range button[aria-pressed="true"] { background: color-mix(in srgb, var(--_tdmm-accent) 16%, transparent); color: var(--_tdmm-accent); }
  .v-btn { border: 0; font-weight: 600; font-size: 13px; font-family: inherit; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; background: var(--_tdmm-chip-bg); color: var(--_tdmm-text); }
  .v-btn.pill { height: 44px; border-radius: 22px; display: block; }
  .v-btn:disabled { opacity: 0.4; }
  .v-btn ha-icon { --mdc-icon-size: 18px; }
  .v-g2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .v-list { display: flex; flex-direction: column; gap: 10px; }
  .v-tile { background: var(--_tdmm-surface-3); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .v-tv { font-size: 15px; font-weight: 600; line-height: 20px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .v-tv.big { font-size: 20px; font-weight: 700; line-height: 26px; }
  .v-tl { font-size: 11px; color: var(--_tdmm-text-secondary); }
  .v-selw { position: relative; display: block; min-width: 0; height: 48px; }
  .v-selw.dim { opacity: 0.4; }
  .v-selw ha-icon { position: absolute; left: 12px; top: 14px; --mdc-icon-size: 20px; color: var(--_tdmm-text-secondary); pointer-events: none; }
  .v-sel { border: 0; appearance: none; font-weight: 600; font-size: 13px; font-family: inherit; margin: 0; width: 100%; height: 48px; box-sizing: border-box; padding: 0 12px 0 40px; border-radius: 14px; cursor: pointer; background: var(--_tdmm-chip-bg); color: var(--_tdmm-text); }
  .v-note { display: flex; align-items: center; gap: 8px; height: 16px; font-size: 12px; line-height: 16px; color: var(--_tdmm-text-secondary); white-space: nowrap; overflow: hidden; }
  .v-note ha-icon { --mdc-icon-size: 16px; }
  .v-svg { display: block; }
  .v-row { display: flex; flex-wrap: wrap; gap: 6px 20px; }
  .v-lg { display: flex; align-items: center; gap: 8px; }
  .v-lg i { width: 16px; height: 3px; border-radius: 2px; }
  .v-lg b { font-size: 24px; font-weight: 700; line-height: 30px; font-variant-numeric: tabular-nums; }
  .v-lg span { font-size: 11px; opacity: 0.7; }
  .v-foot { font-size: 11px; color: var(--_tdmm-text-secondary); }
`;
