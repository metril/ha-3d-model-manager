import { html, nothing, svg, type TemplateResult } from "lit";
import type { ChartPoint, ChartRange, ChartsData, DarkCtx, RenderChartsView } from "../contracts.ts";
import { downsample, linePath, stepPath, tempMax, toPoints, type Box } from "../logic/charts.ts";
import { hasData } from "../logic/history.ts";
import { backHeader, rangePicker } from "../ui/views.ts";

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

function axes(ctx: DarkCtx, range: ChartRange, ys: readonly number[], max: number, unit: string) {
  const sub = ctx.v("text-secondary");
  return svg`
    <path d=${ys.map((v) => `M${BOX.x0} ${yOf(v, max).toFixed(1)} L${BOX.x1} ${yOf(v, max).toFixed(1)}`).join(" ")} fill="none" stroke=${ctx.v("surface-3")} stroke-width="1"/>
    ${ys.map((v) => svg`<text x=${BOX.x0 - 5} y=${yOf(v, max)} text-anchor="end" dominant-baseline="middle" font-size="11" fill=${sub}>${v}${unit}</text>`)}
    ${TICKS[range].map((t, i) => svg`<text x=${BOX.x0 + (i / 4) * (BOX.x1 - BOX.x0)} y=${BOX.y1 + 16} text-anchor=${i === 0 ? "start" : i === 4 ? "end" : "middle"} font-size="11" fill=${sub}>${t}</text>`)}`;
}

const pts = (s: readonly ChartPoint[], d: ChartsData, max: number) => downsample(toPoints(s, d.t0, d.t1, BOX, max));

function tempChart(ctx: DarkCtx, range: ChartRange, d: ChartsData): TemplateResult {
  const all = [d.nozzle, d.bed, d.nozzleTarget, d.bedTarget].flatMap((s) => s.map((p) => p.v));
  const max = tempMax(all);
  // A target of 0 means "no target": treat as a gap.
  const tgt = (s: ChartPoint[]) => s.map((p) => ({ ...p, v: p.v && p.v > 0 ? p.v : null }));
  const acc = ctx.v("accent");
  const noz = lastVal(d.nozzle), bed = lastVal(d.bed);
  const aria = `Nozzle and bed temperature over the last ${range}, nozzle ${fmt(noz, " degrees")}, bed ${fmt(bed, " degrees")}`;
  const mid = max / 2;
  return html`<div class="v-card">
    <div class="v-t">Temperatures</div>
    <div class="v-row">
      ${legend(acc, fmt(noz, "°"), "Nozzle")}${legend(BED, fmt(bed, "°"), "Bed")}
    </div>
    <svg class="v-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label=${aria}>
      ${axes(ctx, range, [0, mid, max], max, "°")}
      <path d=${stepPath(pts(tgt(d.nozzleTarget), d, max))} fill="none" stroke=${acc} stroke-width="1.5" stroke-dasharray="4 4" opacity=".7"/>
      <path d=${stepPath(pts(tgt(d.bedTarget), d, max))} fill="none" stroke=${BED} stroke-width="1.5" stroke-dasharray="4 4" opacity=".7"/>
      <path d=${linePath(pts(d.bed, d, max))} fill="none" stroke=${BED} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d=${linePath(pts(d.nozzle, d, max))} fill="none" stroke=${acc} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <div class="v-foot">Dashed lines show target temperatures.</div></div>`;
}

const legend = (color: string, value: string, label: string) => html`<div class="v-lg">
  <i style="background:${color}"></i><b>${value}</b><span>${label}</span></div>`;

function progressChart(ctx: DarkCtx, range: ChartRange, d: ChartsData): TemplateResult {
  const now = lastVal(d.progress);
  const aria = `Print progress over the last ${range}, now ${fmt(now, " percent")}`;
  return html`<div class="v-card">
    <div class="v-t">Progress</div>
    <div>${legend(ctx.v("progress"), fmt(now, "%"), "Now")}</div>
    <svg class="v-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label=${aria}>
      ${axes(ctx, range, [0, 50, 100], 100, "%")}
      <path d=${linePath(pts(d.progress, d, 100))} fill="none" stroke=${ctx.v("progress")} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg></div>`;
}

function placeholder(text: string, busy = false): TemplateResult {
  return html`<div role=${busy ? "status" : "alert"} aria-busy=${busy ? "true" : "false"}
    class="v-card ph">${text}</div>`;
}

export const renderChartsView: RenderChartsView = (ctx, state, dispatch) => {
  const sub = ctx.hass.devices[ctx.config.device_id ?? ""]?.name ?? "";
  let body: TemplateResult | typeof nothing;
  if (state.loading) body = placeholder("Loading history…", true);
  else if (state.error) body = html`${placeholder(`Could not load history: ${state.error}`)}
    <button type="button" class="v-btn pill" @click=${() => dispatch({ type: "refresh" })}>Retry</button>`;
  else if (!state.data || !hasData(state.data)) body = placeholder("No history for this range yet");
  else body = html`${tempChart(ctx, state.range, state.data)}${progressChart(ctx, state.range, state.data)}`;
  return html`<div class="v-wrap">
    ${backHeader("Charts", sub)}
    ${rangePicker(state.range, (range) => dispatch({ type: "range", range }))}
    ${body}</div>`;
};
