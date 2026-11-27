import { css, html, nothing, type TemplateResult } from "lit";
import { fmtEnum, isAvailable } from "../../blocks/format.ts";
import type { OlymposCtx } from "../contracts.ts";
import { chips } from "../logic/gating.ts";

export interface HeaderProps {
  /** Formatted paused duration (e.g. "12 min"); only used while paused. */
  pausedFor: string;
  onView(view: "charts" | "device"): void;
}

const pretty = (s: string): string => {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function stageLabel(ctx: OlymposCtx, pausedFor: string): string {
  if (ctx.phase === "paused") return `Paused · ${pausedFor}`;
  const st = ctx.state("stage");
  return isAvailable(st) ? pretty(fmtEnum(ctx.hass, st)) : "Printing";
}

export function renderHeader(ctx: OlymposCtx, p: HeaderProps): TemplateResult {
  const id = ctx.resolved.byKey.chamber_light;
  const light = ctx.state("chamber_light");
  const offline = ctx.phase === "offline";
  const lightOn = light?.state === "on" && !offline;
  const c = chips(ctx.phase, ctx.state("hms_active")?.state === "on");
  const name = ctx.hass.devices[ctx.config.device_id ?? ""]?.name ?? "Printer";
  const toggle = () => { if (id) void ctx.callService(id.split(".")[0] as string, "toggle", { entity_id: id }); };
  return html`<header class="o-header">
    <div class="o-title">
      <div class="o-name">${name}</div>
      <div class="o-chips">
        ${c.stage ? html`<span class="o-chip ${c.paused ? "warn" : "acc"}">${stageLabel(ctx, p.pausedFor)}</span>` : nothing}
        ${c.hms ? html`<span class="o-chip fault">HMS</span>` : nothing}
      </div>
    </div>
    <button type="button" class="o-round" aria-label="Charts" @click=${() => p.onView("charts")}><ha-icon icon="mdi:chart-line"></ha-icon></button>
    <button type="button" class="o-round" aria-label="Device" @click=${() => p.onView("device")}><ha-icon icon="mdi:cog-outline"></ha-icon></button>
    ${id ? html`<button type="button" class="o-pill ${lightOn ? "on" : ""}" aria-pressed=${lightOn ? "true" : "false"} aria-label="Chamber light"
      ?disabled=${offline || !isAvailable(light)} @click=${toggle}><ha-icon icon=${ctx.icon("light")}></ha-icon>Light</button>` : nothing}
  </header>`;
}

export const headerStyles = css`
  .o-header { display: flex; align-items: flex-start; gap: 8px; }
  .o-title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; padding-top: 2px; }
  .o-name { font-size: 20px; font-weight: 700; line-height: 28px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .o-chips { display: flex; flex-wrap: wrap; gap: 6px; min-height: 24px; }
  .o-chip { height: 24px; padding: 0 10px; display: inline-flex; align-items: center; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .o-chip.acc { background: color-mix(in srgb, var(--_tdmm-accent) 16%, transparent); color: var(--_tdmm-accent); }
  .o-chip.warn { background: color-mix(in srgb, var(--_tdmm-warn) 16%, transparent); color: var(--_tdmm-warn); }
  .o-chip.fault { background: color-mix(in srgb, var(--_tdmm-fault) 16%, transparent); color: var(--_tdmm-fault); }
  .o-round, .o-pill { flex: none; border: 0; cursor: pointer; background: var(--_tdmm-surface-3); color: var(--_tdmm-text); font: inherit; }
  .o-round { width: 44px; height: 44px; border-radius: 22px; display: flex; align-items: center; justify-content: center; padding: 0; }
  .o-pill { height: 44px; padding: 0 14px; border-radius: 22px; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; }
  .o-pill.on { background: color-mix(in srgb, var(--_tdmm-accent) 16%, transparent); color: var(--_tdmm-accent); }
  .o-pill:disabled { opacity: 0.4; cursor: default; }
  button:focus-visible { outline: 2px solid var(--_tdmm-accent); outline-offset: 2px; }
`;
