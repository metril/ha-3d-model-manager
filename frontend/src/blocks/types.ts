import type { CSSResult, TemplateResult, nothing } from "lit";
import type { EntityKey, ResolvedEntities } from "../entities.ts";
import type { HassEntity, HomeAssistant } from "../ha-types.ts";
import type { NormalizedConfig } from "../config.ts";
import type { ICON_SETS } from "../theme/tokens.ts";

export type { BlockType } from "../config.ts";
import type { BlockType, TabId } from "../config.ts";

export type IconName = keyof (typeof ICON_SETS)["default"];

export interface BlockContext {
  hass: HomeAssistant;
  resolved: ResolvedEntities;
  config: NormalizedConfig;
  icon(name: IconName): string;
  state(key: EntityKey): HassEntity | undefined;
  call(domain: string, service: string, data: Record<string, unknown>): Promise<unknown>;
  tab?: TabId;
}

export interface BlockDef {
  type: BlockType;
  label: string;
  icon: IconName;
  size: number;
  uses(r: ResolvedEntities): string[];
  render(ctx: BlockContext): TemplateResult | typeof nothing;
  styles?: CSSResult;
}
