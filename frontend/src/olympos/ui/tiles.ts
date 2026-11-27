import { css, html, type TemplateResult } from "lit";
import { isAvailable } from "../../blocks/format.ts";
import type { HassEntity } from "../../ha-types.ts";
import type { EntityKey } from "../../entities.ts";
import type { OlymposCtx } from "../contracts.ts";
import { showTarget } from "../logic/gating.ts";

const num = (s?: HassEntity): number | undefined => {
  if (!isAvailable(s) || (s as HassEntity).state.trim() === "") return undefined;
  const n = Number((s as HassEntity).state);
  return Number.isFinite(n) ? n : undefined;
};
const deg = (n: number | undefined): string => (n === undefined ? "—" : `${Math.round(n)}°`);

export interface Tile { label: string; value: string; target: string }

export function tileData(ctx: OlymposCtx): Tile[] {
  const t = (cur: EntityKey, tgt?: EntityKey): { value: string; target: string } => {
    const c = num(ctx.state(cur));
    const g = tgt ? num(ctx.state(tgt)) : undefined;
    return { value: deg(c), target: showTarget(c, g, ctx.phase) ? `→ ${Math.round(g as number)}°` : "" };
  };
  const fan = ctx.state("part_fan");
  const pctAttr = fan?.attributes.percentage;
  const fanV = !isAvailable(fan) || ctx.phase === "offline" ? "—" : typeof pctAttr === "number" ? `${Math.round(pctAttr)}%` : num(fan) !== undefined ? `${Math.round(num(fan) as number)}%` : fan?.state === "on" ? "On" : "0%";
  return [
    { label: "Nozzle", ...t("nozzle_temperature", "nozzle_target_temperature") },
    { label: "Bed", ...t("bed_temperature", "bed_target_temperature") },
    { label: "Fan", value: fanV, target: "" },
    { label: "Chamber", ...t("chamber_temperature") },
  ];
}

export function renderTiles(ctx: OlymposCtx): TemplateResult {
  return html`<div class="o-tiles">${tileData(ctx).map((t) => html`<div class="o-card o-tile">
    <div class="o-tv">${t.value}</div><div class="o-tl">${t.label}</div><div class="o-tl o-tt">${t.target}</div></div>`)}</div>`;
}

export const tilesStyles = css`
  .o-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .o-tile { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .o-tv { font-size: 24px; font-weight: 700; line-height: 30px; font-variant-numeric: tabular-nums; }
  .o-tl { font-size: 11px; color: var(--_tdmm-text-secondary); }
  .o-tt { min-height: 14px; font-variant-numeric: tabular-nums; }
  @media (max-width: 380px) { .o-tv { font-size: 20px; } }
`;
