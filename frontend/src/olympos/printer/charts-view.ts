import { html, nothing, svg, type TemplateResult } from "lit";
import type { ChartPoint, ChartRange, ChartsData, OlymposCtx, RenderChartsView } from "../contracts.ts";
import { downsample, linePath, stepPath, tempMax, toPoints, type Box } from "../logic/charts.ts";
import { hasData } from "../logic/history.ts";
import { backHeader, cardStyle, rangePicker } from "../ui/views.ts";

const W = 342, H = 190;
const BOX: Box = { x0: 36, x1: 334, y0: 10, y1: 160 };
const BED = "#6EA5FF";
const TICKS: Record<ChartRange, string[]> = {
  "1h": ["-60m", "-45m", "-30m", "-15m", "now"],
  "6h": ["-6h", "-4.5h", "-3h", "-1.5h", "now"],
  "24h": ["-24h", "-18h", "-12h", "-6h", "now"],
};
const lastVal = (s: readonly ChartPoint[]): number | undefined => {
  for (let i = s.length - 1; i >= 0; i--) { const v = s[i]!.v; if (v !== null) return v; }
  return undefined;
};
const fmt = (n: number | undefined, unit: string) => (n === undefined ? "—" : `${Math.round(n)}${unit}`);
const yOf = (v: number, max: number) => BOX.y1 - (v / max) * (BOX.y1 - BOX.y0);

function axes(ctx: OlymposCtx, range: ChartRange, ys: readonly number[], max: number, unit: string) {
  const sub = ctx.v("text-secondary");
  return svg`
    <path d=${ys.map((v) => `M${BOX.x0} ${yOf(v, max).toFixed(1)} L${BOX.x1} ${yOf(v, max).toFixed(1)}`).join(" ")} fill="none" stroke=${ctx.v("surface-3")} stroke-width="1"/>
    ${ys.map((v) => svg`<text x=${BOX.x0 - 5} y=${yOf(v, max)} text-anchor="end" dominant-baseline="middle" font-size="11" fill=${sub}>${v}${unit}</text>`)}
    ${TICKS[range].map((t, i) => svg`<text x=${BOX.x0 + (i / 4) * (BOX.x1 - BOX.x0)} y=${BOX.y1 + 16} text-anchor=${i === 0 ? "start" : i === 4 ? "end" : "middle"} font-size="11" fill=${sub}>${t}</text>`)}`;
}

const pts = (s: readonly ChartPoint[], d: ChartsData, max: number) => downsample(toPoints(s, d.t0, d.t1, BOX, max));

function tempChart(ctx: OlymposCtx, range: ChartRange, d: ChartsData): TemplateResult {
  const all = [d.nozzle, d.bed, d.nozzleTarget, d.bedTarget].flatMap((s) => s.map((p) => p.v));
  const max = tempMax(all);
  // A target of 0 means "no target": treat as a gap.
  const tgt = (s: ChartPoint[]) => s.map((p) => ({ ...p, v: p.v && p.v > 0 ? p.v : null }));
  const acc = ctx.v("accent");
  const noz = lastVal(d.nozzle), bed = lastVal(d.bed);
  const aria = `Nozzle and bed temperature over the last ${range}, nozzle ${fmt(noz, " degrees")}, bed ${fmt(bed, " degrees")}`;
  const mid = max / 2;
  return html`<div style=${cardStyle(ctx)}>
    <div style="font-size:13px;font-weight:600">Temperatures</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px 20px">
      ${legend(acc, fmt(noz, "°"), "Nozzle")}${legend(BED, fmt(bed, "°"), "Bed")}
    </div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block" role="img" aria-label=${aria}>
      ${axes(ctx, range, [0, mid, max], max, "°")}
      <path d=${stepPath(pts(tgt(d.nozzleTarget), d, max))} fill="none" stroke=${acc} stroke-width="1.5" stroke-dasharray="4 4" opacity=".7"/>
      <path d=${stepPath(pts(tgt(d.bedTarget), d, max))} fill="none" stroke=${BED} stroke-width="1.5" stroke-dasharray="4 4" opacity=".7"/>
      <path d=${linePath(pts(d.bed, d, max))} fill="none" stroke=${BED} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d=${linePath(pts(d.nozzle, d, max))} fill="none" stroke=${acc} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <div style="font-size:11px;color:${ctx.v("text-secondary")}">Dashed lines show target temperatures.</div></div>`;
}

const legend = (color: string, value: string, label: string) => html`<div style="display:flex;align-items:center;gap:8px">
  <span style="width:16px;height:3px;border-radius:2px;background:${color}"></span>
  <span style="font-size:24px;font-weight:700;line-height:30px;font-variant-numeric:tabular-nums">${value}</span>
  <span style="font-size:11px;opacity:.7">${label}</span></div>`;

function progressChart(ctx: OlymposCtx, range: ChartRange, d: ChartsData): TemplateResult {
  const now = lastVal(d.progress);
  const aria = `Print progress over the last ${range}, now ${fmt(now, " percent")}`;
  return html`<div style=${cardStyle(ctx)}>
    <div style="font-size:13px;font-weight:600">Progress</div>
    <div style="display:flex;align-items:center;gap:8px">${legend(ctx.v("progress"), fmt(now, "%"), "Now")}</div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block" role="img" aria-label=${aria}>
      ${axes(ctx, range, [0, 50, 100], 100, "%")}
      <path d=${linePath(pts(d.progress, d, 100))} fill="none" stroke=${ctx.v("progress")} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg></div>`;
}

function placeholder(ctx: OlymposCtx, text: string, busy = false): TemplateResult {
  return html`<div role=${busy ? "status" : "alert"} aria-busy=${busy ? "true" : "false"}
    style="${cardStyle(ctx)};height:300px;align-items:center;justify-content:center;font-size:13px;color:${ctx.v("text-secondary")};text-align:center">${text}</div>`;
}

export const renderChartsView: RenderChartsView = (ctx, state, dispatch) => {
  const sub = ctx.hass.devices[ctx.config.device_id ?? ""]?.name ?? "";
  let body: TemplateResult | typeof nothing;
  if (state.loading) body = placeholder(ctx, "Loading history…", true);
  else if (state.error) body = html`${placeholder(ctx, `Could not load history: ${state.error}`)}
    <button type="button" @click=${() => dispatch({ type: "refresh" })} style="height:44px;border:0;border-radius:22px;background:${ctx.v("chip-bg")};color:${ctx.v("text")};font:600 13px inherit;cursor:pointer">Retry</button>`;
  else if (!state.data || !hasData(state.data)) body = placeholder(ctx, "No history for this range yet");
  else body = html`${tempChart(ctx, state.range, state.data)}${progressChart(ctx, state.range, state.data)}`;
  return html`<div style="padding:12px;display:flex;flex-direction:column;gap:12px;color:${ctx.v("text")};background:${ctx.v("surface-1")}">
    ${backHeader(ctx, "Charts", sub)}
    ${rangePicker(ctx, state.range, (range) => dispatch({ type: "range", range }))}
    ${body}</div>`;
};
