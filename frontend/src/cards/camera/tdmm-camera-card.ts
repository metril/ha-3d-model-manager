import { TdmmBaseCard } from "../../base/tdmm-base-card.ts";
import { CARD_TYPES, type BlockEntry, type TdmmCardConfig } from "../../config.ts";
import type { HomeAssistant } from "../../ha-types.ts";

export class TdmmCameraCard extends TdmmBaseCard {
  protected visibleBlocks(): BlockEntry[] {
    return (this.config?.blocks ?? []).filter((b) => !b.hidden);
  }

  getGridOptions(): { columns: number; rows?: number | "auto"; min_columns: number; min_rows?: number } {
    return { columns: 12, rows: "auto", min_columns: 6, min_rows: 3 };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("tdmm-card-editor");
  }

  static getStubConfig(hass: HomeAssistant): TdmmCardConfig {
    const hit = Object.values(hass?.entities ?? {}).find(
      (e) => e.platform === "tdmm" && e.translation_key === "online" && e.entity_id.startsWith("binary_sensor.") && e.device_id,
    );
    return { type: CARD_TYPES.camera, device_id: hit?.device_id ?? "" };
  }
}
