import { html, type TemplateResult } from "lit";
import type { TdmmCardConfig } from "../../config.ts";
import { stubConfigFor } from "../../entities.ts";
import type { EntityKey } from "../../entities.ts";
import type { HomeAssistant } from "../../ha-types.ts";
import { TdmmOlymposBase } from "../base.ts";
import type { OlymposCtx } from "../contracts.ts";
import { TILE_KEYS } from "../keys.ts";

export class TdmmOlymposTileCard extends TdmmOlymposBase {
  protected entityKeys(): readonly EntityKey[] { return TILE_KEYS; }
  protected renderCard(ctx: OlymposCtx): TemplateResult {
    return html`<ha-card><div class="olympos-placeholder">Olympos tile: ${ctx.phase}</div></ha-card>`;
  }
  getCardSize(): number { return 1; }
  static getConfigElement(): HTMLElement { return document.createElement("tdmm-card-editor"); }
  static getStubConfig(hass: HomeAssistant): TdmmCardConfig { return stubConfigFor("olympos-tile", hass); }
}
