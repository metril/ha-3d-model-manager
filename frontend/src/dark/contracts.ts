/** Shared contracts for the dark cards. Types only: implementations live in the owners' files. */
import type { TemplateResult } from "lit";
import type { NormalizedConfig } from "../config.ts";
import type { AmsUnitEntities, EntityKey, ResolvedEntities } from "../entities.ts";
import type { HassEntity, HomeAssistant } from "../ha-types.ts";
import type { DarkToken, Palette } from "../theme/dark.ts";
import type { IconName } from "../theme/tokens.ts";
import type { Phase } from "./logic/gating.ts";

export type { Phase, DarkToken, Palette, AmsUnitEntities };

export interface DarkCtx {
  hass: HomeAssistant;
  config: NormalizedConfig;
  resolved: ResolvedEntities;
  phase: Phase;
  /** Raw palette values (not user-overridden). Prefer `v()` for styling. */
  palette: Palette;
  /** CSS reference for a token, honoring user/theme overrides, e.g. `var(--_tdmm-surface-2)`. */
  v(token: DarkToken): string;
  /** Entity state for a resolved key. */
  state(key: EntityKey): HassEntity | undefined;
  /** `button.press` on a resolved button key; no-op when unresolved. */
  press(key: EntityKey): Promise<unknown>;
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
  icon(name: IconName): string;
  /** Epoch ms at render time. */
  now: number;
}

/** Stop-button hold machine state (reducer lives in logic/hold.ts). */
export type HoldState =
  | { kind: "idle" }
  | { kind: "holding"; t0: number }
  | { kind: "armed"; t: number };

export type ChartRange = "1h" | "6h" | "24h";
export interface ChartPoint { t: number; v: number | null }
export interface ChartsData {
  t0: number;
  t1: number;
  nozzle: ChartPoint[];
  bed: ChartPoint[];
  nozzleTarget: ChartPoint[];
  bedTarget: ChartPoint[];
  progress: ChartPoint[];
}
export interface ChartsState { range: ChartRange; data?: ChartsData; loading: boolean; error?: string }
export type ChartsAction = { type: "range"; range: ChartRange } | { type: "refresh" };

/** Selected spool: `unit` is the AMS unit number; "ext" is the external spool. */
export type SpoolSel = { unit: number; slot: number } | "ext";

export type RenderChartsView = (ctx: DarkCtx, state: ChartsState, dispatch: (a: ChartsAction) => void) => TemplateResult;
export type RenderDeviceView = (ctx: DarkCtx) => TemplateResult;
export type RenderSpools = (
  ctx: DarkCtx, units: readonly AmsUnitEntities[], selected: SpoolSel | undefined, onPick: (s: SpoolSel | undefined) => void,
) => TemplateResult;
