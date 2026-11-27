import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { fmtPercent, fmtTemp, isAvailable } from "../../blocks/format.ts";
import type { TdmmCardConfig } from "../../config.ts";
import { stubConfigFor } from "../../entities.ts";
import type { EntityKey } from "../../entities.ts";
import type { HomeAssistant } from "../../ha-types.ts";
import { TdmmOlymposBase } from "../base.ts";
import type { OlymposCtx, SpoolSel } from "../contracts.ts";
import { AMS_KEYS } from "../keys.ts";
import { externalInfo, renderDetail, renderSpoolRow, spoolInfos, spoolStyles } from "../ui/spools.ts";

export class TdmmOlymposAmsCard extends TdmmOlymposBase {
  protected usesAms = true;
  private sel?: SpoolSel;

  static get styles(): CSSResultGroup {
    return [
      ...(super.styles as CSSResultGroup[]),
      spoolStyles,
      css`
        .olp-ams { padding: 12px; display: flex; flex-direction: column; gap: 8px; color: var(--_tdmm-text); font-family: var(--_tdmm-font-family); }
        .olp-unit-head { display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 13px; font-weight: 600; }
        .olp-unit-head .grow { flex: 1; }
        .olp-chip { display: inline-flex; align-items: center; gap: 2px; height: 22px; padding: 0 8px; border-radius: 11px; background: var(--_tdmm-chip-bg); color: var(--_tdmm-text-secondary); font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums; }
        .olp-chip ha-icon { --mdc-icon-size: 14px; }
        .olp-empty { padding: 4px; color: var(--_tdmm-text-secondary); font-size: 12px; }
      `,
    ];
  }

  protected entityKeys(): readonly EntityKey[] { return AMS_KEYS; }

  private pick = (s: SpoolSel | undefined): void => { this.sel = s; this.requestUpdate(); };

  protected renderCard(ctx: OlymposCtx): TemplateResult {
    const units = ctx.resolved.ams;
    const infos = spoolInfos(ctx, units);
    const ext = externalInfo(ctx);
    const st = (id?: string) => (id ? ctx.hass.states[id] : undefined);
    const pool = ext ? [...infos, ext] : infos;
    return html`<ha-card><div class="olp-ams">
      ${units.length === 0 && !ext ? html`<div class="olp-empty">No AMS found</div>` : nothing}
      ${units.map((u, n) => html`<div class="olp-unit">
        <div class="olp-unit-head"><span class="grow">AMS ${u.unit}</span>
          ${isAvailable(st(u.humidity)) ? html`<span class="olp-chip" aria-label="Humidity ${fmtPercent(st(u.humidity)).replace("%", " %")}"><ha-icon .icon=${ctx.icon("humidity")}></ha-icon>${fmtPercent(st(u.humidity))}</span>` : nothing}
          ${isAvailable(st(u.temperature)) ? html`<span class="olp-chip" aria-label="Temperature ${fmtTemp(st(u.temperature))}">${fmtTemp(st(u.temperature))}</span>` : nothing}
        </div>
        ${renderSpoolRow(ctx, infos.filter((i) => i.sel !== "ext" && i.sel.unit === u.unit), this.sel, this.pick, n === units.length - 1 ? ext : undefined)}
      </div>`)}
      ${units.length === 0 && ext ? renderSpoolRow(ctx, [], this.sel, this.pick, ext) : nothing}
      ${renderDetail(pool, this.sel)}
    </div></ha-card>`;
  }

  static getConfigElement(): HTMLElement { return document.createElement("tdmm-card-editor"); }
  static getStubConfig(hass: HomeAssistant): TdmmCardConfig { return stubConfigFor("olympos-ams", hass); }
}
