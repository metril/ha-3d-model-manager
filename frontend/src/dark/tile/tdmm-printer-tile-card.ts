import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { isAvailable } from "../../blocks/format.ts";
import type { TdmmCardConfig } from "../../config.ts";
import { stubConfigFor } from "../../entities.ts";
import type { EntityKey } from "../../entities.ts";
import type { HomeAssistant } from "../../ha-types.ts";
import { TdmmDarkBase } from "../base.ts";
import type { DarkCtx, Phase } from "../contracts.ts";
import { TILE_KEYS } from "../keys.ts";

const num = (s?: { state: string }): number | undefined => {
  if (!s || s.state === "" || s.state === "unknown" || s.state === "unavailable") return undefined;
  const n = Number(s.state);
  return Number.isFinite(n) ? n : undefined;
};

const BADGE: Record<Phase, string | undefined> = {
  printing: "Printing", paused: "Paused", idle: undefined, finished: "Done", failed: "Failed", offline: "Offline",
};

export interface TileView { stateLine: string; badge?: string; pct?: number; job?: string; hms: boolean }

export function tileView(ctx: DarkCtx): TileView {
  const pct = num(ctx.state("progress"));
  const rem = ctx.state("remaining_time");
  const remN = num(rem);
  const unit = rem?.attributes.unit_of_measurement as string | undefined;
  const mins = remN === undefined ? undefined : Math.max(0, Math.round(unit === "s" ? remN / 60 : unit === "h" ? remN * 60 : remN));
  const remTxt = mins === undefined ? undefined : mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
  const pctTxt = pct === undefined ? undefined : `${Math.round(pct)}%`;
  const layer = num(ctx.state("current_layer"));
  let stateLine: string;
  switch (ctx.phase) {
    case "printing": stateLine = [pctTxt, remTxt].filter(Boolean).join(" · ") || "Printing"; break;
    case "paused": stateLine = ["Paused", pctTxt].filter(Boolean).join(" · "); break;
    case "failed": stateLine = layer !== undefined ? `Failed · layer ${layer}` : "Failed"; break;
    case "finished": stateLine = "Done"; break;
    case "offline": stateLine = "Offline"; break;
    default: stateLine = "Idle";
  }
  const model = ctx.state("current_model");
  return {
    stateLine, badge: BADGE[ctx.phase], pct: pct === undefined ? undefined : Math.max(0, Math.min(100, pct)),
    job: isAvailable(model) && model!.state && model!.state !== "none" ? model!.state : undefined,
    hms: ctx.state("hms_active")?.state === "on",
  };
}

export class TdmmPrinterTileCard extends TdmmDarkBase {
  static get styles(): CSSResultGroup {
    return [
      ...(super.styles as CSSResultGroup[]),
      css`
        ha-card { background: transparent; }
        .tile { all: unset; box-sizing: border-box; position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;
          width: 100%; min-height: 112px; padding: 12px; border-radius: 20px; background: var(--_tdmm-surface-2); color: var(--_tdmm-text);
          font-family: var(--_tdmm-font-family); overflow: hidden; cursor: pointer; }
        .tile:focus-visible { outline: 2px solid var(--_tdmm-accent); outline-offset: 2px; }
        .tile.wide { min-height: 132px; }
        .tile.offline { opacity: 0.6; }
        .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .well { width: 44px; height: 44px; border-radius: 22px; background: color-mix(in srgb, var(--_tdmm-tile-accent) 16%, transparent); color: var(--_tdmm-tile-accent); display: flex; align-items: center; justify-content: center; flex: none; }
        .tile.failed .well { background: color-mix(in srgb, var(--_tdmm-fault) 16%, transparent); color: var(--_tdmm-fault); }
        .badges { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
        .badge { height: 20px; padding: 0 8px; display: inline-flex; align-items: center; border-radius: 10px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,.08); color: var(--_tdmm-text); }
        .badge.fault { background: color-mix(in srgb, var(--_tdmm-fault) 20%, transparent); color: var(--_tdmm-fault); }
        .name { font-size: 13px; font-weight: 600; }
        .line { font-size: 12px; color: var(--_tdmm-text-secondary); font-variant-numeric: tabular-nums; }
        .tile.failed .line { color: var(--_tdmm-fault); }
        .job { font-size: 12px; color: var(--_tdmm-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bar { height: 4px; border-radius: 2px; background: var(--_tdmm-surface-3); overflow: hidden; margin-top: 6px; }
        .bar > span { display: block; height: 100%; background: var(--_tdmm-progress); }
        .tile.failed .bar > span { background: var(--_tdmm-fault); }
        .cue { position: absolute; left: 12px; right: 12px; bottom: 0; height: 3px; border-radius: 2px 2px 0 0; background: linear-gradient(90deg, rgba(221,221,221,.05), rgba(221,221,221,.28), rgba(221,221,221,.05)); }
      `,
    ];
  }

  protected entityKeys(): readonly EntityKey[] { return TILE_KEYS; }

  private tap = (): void => {
    const cfg = this.config!;
    const entity = this.resolved.byKey.print_state;
    const tap_action = cfg.tap_action.action === "more-info" ? { ...cfg.tap_action, entity: cfg.tap_action.entity ?? entity } : cfg.tap_action;
    this.dispatchEvent(new CustomEvent("hass-action", {
      bubbles: true, composed: true, detail: { config: { entity, tap_action }, action: "tap" },
    }));
  };

  protected renderCard(ctx: DarkCtx): TemplateResult {
    const wide = ctx.config.variant === "wide";
    const v = tileView(ctx);
    const name = ctx.config.name || ctx.hass.devices?.[ctx.config.device_id]?.name || "Printer";
    const failed = ctx.phase === "failed";
    const label = `${name}, ${v.stateLine}${v.hms ? ", HMS alert" : ""}`;
    return html`<ha-card><button type="button" class="tile ${wide ? "wide" : "compact"} ${failed ? "failed" : ""} ${ctx.phase === "offline" ? "offline" : ""}"
      aria-label=${label} @click=${this.tap}>
      <div class="top"><span class="well" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v5H6zM8 8l4 9 4-9M12 17v4"/></svg></span>
        <span class="badges">${v.badge ? html`<span class="badge ${failed ? "fault" : ""}">${v.badge}</span>` : nothing}${wide && v.hms ? html`<span class="badge fault">HMS</span>` : nothing}</span></div>
      <div><div class="name">${name}</div><div class="line">${v.stateLine}</div>
        ${wide ? html`${v.job ? html`<div class="job">${v.job}</div>` : nothing}${v.pct !== undefined ? html`<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(v.pct)} aria-label="Progress"><span style="width:${v.pct}%"></span></div>` : nothing}` : nothing}</div>
      <span class="cue" aria-hidden="true"></span>
    </button></ha-card>`;
  }

  getCardSize(): number { return 1; }
  static getConfigElement(): HTMLElement { return document.createElement("tdmm-card-editor"); }
  static getStubConfig(hass: HomeAssistant): TdmmCardConfig { return stubConfigFor("printer-tile", hass); }
}
