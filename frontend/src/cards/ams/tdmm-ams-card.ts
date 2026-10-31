import { TdmmBaseCard } from "../../base/tdmm-base-card.ts";
import { CARD_TYPES, type BlockEntry, type TdmmCardConfig } from "../../config.ts";
import type { HomeAssistant } from "../../ha-types.ts";

export class TdmmAmsCard extends TdmmBaseCard {
  protected visibleBlocks(): BlockEntry[] {
    return (this.config?.blocks ?? []).filter((b) => !b.hidden);
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("tdmm-card-editor");
  }

  static getStubConfig(hass: HomeAssistant): TdmmCardConfig {
    const hit = Object.values(hass?.entities ?? {}).find(
      (e) => e.platform === "tdmm" && e.translation_key === "online" && e.entity_id.startsWith("binary_sensor.") && e.device_id,
    );
    return { type: CARD_TYPES.ams, device_id: hit?.device_id ?? "" };
  }
}
