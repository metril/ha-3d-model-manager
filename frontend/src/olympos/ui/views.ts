import { html, type TemplateResult } from "lit";
import type { ChartRange, OlymposCtx } from "../contracts.ts";

export const RANGES: readonly ChartRange[] = ["1h", "6h", "24h"];

/** Back button + title. Fires a bubbling, composed `tdmm-back` event for the card to handle. */
export function backHeader(ctx: OlymposCtx, title: string, subtitle: string): TemplateResult {
  const back = (e: Event) => (e.currentTarget as HTMLElement).dispatchEvent(new CustomEvent("tdmm-back", { bubbles: true, composed: true }));
  return html`<div style="display:flex;align-items:flex-start;gap:12px">
    <button type="button" aria-label="Back" @click=${back}
      style="width:44px;height:44px;flex:none;border:0;border-radius:22px;background:${ctx.v("surface-3")};color:${ctx.v("text")};display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;padding-top:2px">
      <div style="font-size:20px;font-weight:700;line-height:28px;color:${ctx.v("text")}">${title}</div>
      <div style="font-size:12px;color:${ctx.v("text-secondary")};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${subtitle}</div>
    </div></div>`;
}

export function rangePicker(ctx: OlymposCtx, range: ChartRange, onPick: (r: ChartRange) => void): TemplateResult {
  return html`<div role="group" aria-label="Time range" style="display:flex;gap:8px">
    ${RANGES.map((r) => {
      const on = r === range;
      return html`<button type="button" aria-pressed=${on ? "true" : "false"} @click=${() => onPick(r)}
        style="flex:1;height:44px;border:0;border-radius:22px;font:600 13px inherit;cursor:pointer;background:${on ? `color-mix(in srgb, ${ctx.v("accent")} 16%, transparent)` : ctx.v("chip-bg")};color:${on ? ctx.v("accent") : ctx.v("text")}">${r}</button>`;
    })}</div>`;
}

export const cardStyle = (ctx: OlymposCtx): string =>
  `background:${ctx.v("surface-2")};border-radius:20px;padding:12px;display:flex;flex-direction:column;gap:10px`;
