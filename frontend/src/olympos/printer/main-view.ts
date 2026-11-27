import { css, html, type TemplateResult } from "lit";
import type { OlymposCtx, SpoolSel } from "../contracts.ts";
import { renderSpools } from "../ui/spools.ts";
import { renderCamera } from "../ui/camera.ts";
import { renderControlBar, type ControlProps } from "../ui/control-bar.ts";
import { renderHeader, type HeaderProps } from "../ui/header.ts";
import { renderHero } from "../ui/hero.ts";
import { renderTiles } from "../ui/tiles.ts";

export interface MainProps extends HeaderProps, ControlProps {
  wide: boolean;
  selected: SpoolSel | undefined;
  onPick(s: SpoolSel | undefined): void;
}

/** Wide (>= 700px): hero + camera left; tiles, spools, controls right. Narrow: single column stack. */
export function renderMainView(ctx: OlymposCtx, p: MainProps): TemplateResult {
  const hero = renderHero(ctx, p.pausedFor);
  const cam = renderCamera(ctx);
  const tiles = renderTiles(ctx);
  const spools = renderSpools(ctx, ctx.resolved.ams, p.selected, p.onPick);
  const ctl = renderControlBar(ctx, p);
  return html`<div class="o-main ${p.wide ? "wide" : ""}">
    ${renderHeader(ctx, p)}
    ${p.wide
      ? html`<div class="o-cols"><div class="o-col">${hero}${cam}</div><div class="o-col">${tiles}${spools}${ctl}</div></div>`
      : html`${hero}${cam}${tiles}${spools}${ctl}`}
  </div>`;
}

export const mainStyles = css`
  .o-main { display: flex; flex-direction: column; gap: 12px; padding: 12px; background: var(--_tdmm-surface-1); color: var(--_tdmm-text); }
  .o-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; align-items: start; }
  .o-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
`;
