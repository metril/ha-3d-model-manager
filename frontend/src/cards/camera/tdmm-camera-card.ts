import { TdmmBaseCard } from "../../base/tdmm-base-card.ts";
import { type BlockEntry, type TdmmCardConfig } from "../../config.ts";
import type { HomeAssistant } from "../../ha-types.ts";
import { stubConfigFor } from "../../entities.ts";

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
    return stubConfigFor("camera", hass);
  }
}
