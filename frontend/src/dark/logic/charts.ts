import type { ChartPoint } from "../contracts.ts";

export interface Box { x0: number; x1: number; y0: number; y1: number }
/** y is null for a gap. */
export interface XY { x: number; y: number | null }

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const f1 = (n: number) => n.toFixed(1);

/** Map series to box coordinates; the last known value is extended to t1. y grows downward (y1 = baseline). */
export function toPoints(series: readonly ChartPoint[], t0: number, t1: number, box: Box, yMax: number): XY[] {
  const span = Math.max(1, t1 - t0);
  const out: XY[] = series.map((p) => ({
    x: box.x0 + clamp((p.t - t0) / span, 0, 1) * (box.x1 - box.x0),
    y: p.v === null ? null : box.y1 - clamp(p.v / yMax, 0, 1) * (box.y1 - box.y0),
  }));
  const last = out[out.length - 1];
  if (last && last.y !== null && last.x < box.x1) out.push({ x: box.x1, y: last.y });
  return out;
}

/** Bucket-reduce to at most n points; a bucket holding any gap stays a gap so gaps are preserved. */
export function downsample<T extends { y: number | null }>(points: readonly T[], n = 120): T[] {
  if (points.length <= n) return [...points];
  const out: T[] = [];
  const size = points.length / n;
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * size);
    const b = Math.max(a + 1, Math.floor((i + 1) * size));
    const bucket = points.slice(a, b);
    out.push(bucket.find((p) => p.y === null) ?? bucket[bucket.length - 1]!);
  }
  return out;
}

/** Polyline path; a null y breaks the line. */
export function linePath(points: readonly XY[]): string {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (p.y === null) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${f1(p.x)} ${f1(p.y)} `;
    pen = true;
  }
  return d.trim();
}

/** Step path for target series: hold each value until the next point; gaps break it. */
export function stepPath(points: readonly XY[], xEnd?: number): string {
  let d = "";
  points.forEach((p, i) => {
    if (p.y === null) return;
    const next = points[i + 1];
    d += `M${f1(p.x)} ${f1(p.y)} L${f1(next ? next.x : (xEnd ?? p.x))} ${f1(p.y)} `;
  });
  return d.trim();
}

/** Axis maximum for temperatures: multiple of 50, at least 100. */
export function tempMax(values: readonly (number | null)[]): number {
  const m = Math.max(0, ...values.filter((v): v is number => v !== null));
  return Math.max(100, Math.ceil(m / 50) * 50);
}
