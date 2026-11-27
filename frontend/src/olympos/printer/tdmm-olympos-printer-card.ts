import { html, type TemplateResult } from "lit";
import type { TdmmCardConfig } from "../../config.ts";
import { stubConfigFor } from "../../entities.ts";
import type { EntityKey } from "../../entities.ts";
import type { HomeAssistant } from "../../ha-types.ts";
import { TdmmOlymposBase } from "../base.ts";
import type { OlymposCtx } from "../contracts.ts";
import { PRINTER_KEYS } from "../keys.ts";

export class TdmmOlymposPrinterCard extends TdmmOlymposBase {
  protected usesAms = true;
  protected entityKeys(): readonly EntityKey[] { return PRINTER_KEYS; }
  protected renderCard(ctx: OlymposCtx): TemplateResult {
    return html`<ha-card><div class="olympos-placeholder">Olympos printer: ${ctx.phase}</div></ha-card>`;
  }
  static getConfigElement(): HTMLElement { return document.createElement("tdmm-card-editor"); }
  static getStubConfig(hass: HomeAssistant): TdmmCardConfig { return stubConfigFor("olympos-printer", hass); }
}
