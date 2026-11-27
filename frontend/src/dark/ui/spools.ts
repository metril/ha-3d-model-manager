import { css, html, nothing, svg, type TemplateResult } from "lit";
import { isAvailable } from "../../blocks/format.ts";
import { isBlank, isEmptyColor, parseColor } from "../../blocks/filament.ts";
import type { AmsUnitEntities, DarkCtx, RenderSpools, SpoolSel } from "../contracts.ts";

export const LOW_PCT = 15;

export interface SpoolInfo {
  sel: SpoolSel;
  /** Accessible name, e.g. "AMS 1 Tray 2" or "External spool". */
  label: string;
  /** Short caption under the spool (tray number or "Ext"). */
  caption: string;
  empty: boolean;
  color?: string;
  material?: string;
  pct?: number;
  low: boolean;
  active: boolean;
  /** Detail line text. */
  detail: string;
}

const NAMES: [string, [number, number, number]][] = [
  ["Black", [24, 24, 24]], ["White", [240, 240, 240]], ["Gray", [128, 128, 128]], ["Red", [220, 40, 40]],
  ["Orange", [255, 145, 0]], ["Yellow", [250, 220, 40]], ["Green", [40, 170, 70]], ["Cyan", [0, 190, 210]],
  ["Blue", [40, 80, 220]], ["Purple", [140, 60, 190]], ["Pink", [240, 120, 170]], ["Brown", [120, 80, 40]],
];
export function colorName(hex: string | undefined): string | undefined {
  if (!hex) return undefined;
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  let best = NAMES[0]!;
  let bd = Infinity;
  for (const e of NAMES) {
    const d = e[1].reduce((s, v, i) => s + (v - c[i]!) ** 2, 0);
    if (d < bd) { bd = d; best = e; }
  }
  return best[0];
}

export function spoolInfos(ctx: DarkCtx, units: readonly AmsUnitEntities[]): SpoolInfo[] {
  const st = (id?: string) => (id ? ctx.hass.states[id] : undefined);
  const actMat = ctx.state("active_filament_material")?.state;
  const actCol = parseColor(ctx.state("active_filament_color")?.state);
  const multi = units.length > 1;
  const out: SpoolInfo[] = [];
  const build = (sel: SpoolSel, label: string, caption: string, head: string, mat?: string, col?: string, rem?: string): SpoolInfo => {
    const empty = isBlank(mat) || isEmptyColor(col);
    const color = empty ? undefined : parseColor(col);
    const remEnt = st(rem);
    const raw = isAvailable(remEnt) ? Number(remEnt!.state) : NaN;
    const pct = Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : undefined;
    const low = !empty && pct !== undefined && pct < LOW_PCT;
    const active = !empty && !!actCol && color === actCol && !!mat && mat === actMat;
    const parts = [head, empty ? "Empty" : mat, empty ? undefined : colorName(color), pct !== undefined && !empty ? `${pct} %` : undefined];
    if (low) parts.push("Low");
    return { sel, label, caption, empty, color, material: mat, pct, low, active, detail: parts.filter(Boolean).join(" · ") };
  };
  for (const u of units) {
    for (const s of u.slots) {
      const mat = st(s.material), col = st(s.color);
      out.push(build({ unit: u.unit, slot: s.slot }, multi ? `AMS ${u.unit} Tray ${s.slot}` : `Tray ${s.slot}`, String(s.slot),
        `AMS ${u.unit} · Tray ${s.slot}`, isAvailable(mat) ? mat!.state : undefined, isAvailable(col) ? col!.state : undefined, s.remaining));
    }
  }
  return out;
}

export function externalInfo(ctx: DarkCtx): SpoolInfo | undefined {
  const m = ctx.state("external_spool_material"), c = ctx.state("external_spool_color");
  if (!m && !c) return undefined;
  const mat = isAvailable(m) ? m!.state : undefined, col = isAvailable(c) ? c!.state : undefined;
  const empty = isBlank(mat) || isEmptyColor(col);
  const color = empty ? undefined : parseColor(col);
  return {
    sel: "ext", label: "External spool", caption: "Ext", empty, color, material: mat, low: false, active: false,
    detail: ["External spool", empty ? "Empty" : mat, empty ? undefined : colorName(color)].filter(Boolean).join(" · "),
  };
}

const same = (a: SpoolSel | undefined, b: SpoolSel): boolean =>
  a === b || (!!a && a !== "ext" && b !== "ext" && a.unit === b.unit && a.slot === b.slot);

export function spoolSvg(color: string | undefined): TemplateResult {
  return color === undefined
    ? svg`<svg width="44" height="30" viewBox="0 0 44 30" fill="none" aria-hidden="true" style="opacity:.5"><rect x="1" y="1" width="42" height="28" rx="6" stroke="currentColor" stroke-dasharray="3 3"/></svg>`
    : svg`<svg width="44" height="30" viewBox="0 0 44 30" aria-hidden="true"><rect x="0" y="0" width="5" height="30" rx="2" fill="#39414e"/><rect x="39" y="0" width="5" height="30" rx="2" fill="#39414e"/><rect x="5" y="3" width="34" height="24" fill="${color}" stroke="rgba(255,255,255,.2)"/><path d="M5 9h34M5 15h34M5 21h34" stroke="rgba(0,0,0,.16)"/></svg>`;
}

export const spoolStyles = css`
.olp-spools{display:flex;align-items:flex-start;flex-wrap:wrap;gap:0}
.olp-spool{min-width:52px;min-height:64px;padding:6px 4px 4px;border:0;border-radius:14px;background:transparent;color:var(--_tdmm-text-secondary);display:flex;flex-direction:column;align-items:center;gap:4px;font:500 11px var(--_tdmm-font-family,Roboto,sans-serif);cursor:pointer}
.olp-spool[aria-pressed="true"]{background:var(--_tdmm-surface-3)}
.olp-spool:focus-visible{outline:2px solid var(--_tdmm-accent);outline-offset:1px}
.olp-spool.gap{margin-left:12px}
.olp-spool.empty{opacity:.7}
.olp-spool .pct{font-variant-numeric:tabular-nums}
.olp-spool.low .pct{color:var(--_tdmm-warn)}
.olp-spool .ul{height:3px;width:32px;border-radius:2px;background:transparent}
.olp-spool.active .ul{background:var(--_tdmm-accent)}
.olp-detail{font-size:12px;color:var(--_tdmm-text);padding:0 4px;min-height:16px;line-height:16px}
`;

export function spoolButton(i: SpoolInfo, selected: SpoolSel | undefined, onPick: (s: SpoolSel | undefined) => void, gap = false): TemplateResult {
  const on = same(selected, i.sel);
  const cap = i.empty ? i.caption : i.pct !== undefined ? `${i.pct}%` : i.caption;
  return html`<button type="button" class="olp-spool ${i.empty ? "empty" : ""} ${i.low ? "low" : ""} ${i.active ? "active" : ""} ${gap ? "gap" : ""}"
    aria-label="${i.label}${i.empty ? ", empty" : i.pct !== undefined ? `, ${i.pct} percent` : ""}${i.low ? ", low" : ""}" aria-pressed=${on ? "true" : "false"}
    @click=${() => onPick(on ? undefined : i.sel)}>
    ${spoolSvg(i.color)}<span class="pct">${i.empty ? i.caption : cap}</span><span class="ul"></span>
  </button>`;
}

/** Spool buttons for one unit (plus the external spool when `ext` given). */
export function renderSpoolRow(
  _ctx: DarkCtx, infos: readonly SpoolInfo[], selected: SpoolSel | undefined, onPick: (s: SpoolSel | undefined) => void, ext?: SpoolInfo,
): TemplateResult {
  return html`<div class="olp-spools" role="group" aria-label="Spools">${infos.map((i) => spoolButton(i, selected, onPick))}${ext ? spoolButton(ext, selected, onPick, true) : nothing}</div>`;
}

export const renderDetail = (infos: readonly SpoolInfo[], selected: SpoolSel | undefined): TemplateResult => {
  const cur = selected === undefined ? undefined : infos.find((i) => same(selected, i.sel));
  return html`<div class="olp-detail" aria-live="polite">${cur?.detail ?? ""}</div>`;
};

/** Spool rows for every unit (external spool after the last) plus one shared detail line. */
export const renderSpools: RenderSpools = (ctx, units, selected, onPick) => {
  const all = spoolInfos(ctx, units);
  const ext = externalInfo(ctx);
  const detailPool = ext ? [...all, ext] : all;
  return html`<div class="olp-spools-wrap">
    ${units.map((u, n) => renderSpoolRow(ctx, all.filter((i) => i.sel !== "ext" && i.sel.unit === u.unit), selected, onPick, n === units.length - 1 ? ext : undefined))}
    ${units.length === 0 && ext ? renderSpoolRow(ctx, [], selected, onPick, ext) : nothing}
    ${renderDetail(detailPool, selected)}
  </div>`;
};
