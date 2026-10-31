import { TdmmBaseCard } from "../../base/tdmm-base-card.ts";
import { type BlockEntry, type TdmmCardConfig } from "../../config.ts";
import type { HomeAssistant } from "../../ha-types.ts";
import { stubConfigFor } from "../../entities.ts";

export class TdmmAmsCard extends TdmmBaseCard {
  protected visibleBlocks(): BlockEntry[] {
    return (this.config?.blocks ?? []).filter((b) => !b.hidden);
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("tdmm-card-editor");
  }

  static getStubConfig(hass: HomeAssistant): TdmmCardConfig {
    return stubConfigFor("ams", hass);
  }
}
