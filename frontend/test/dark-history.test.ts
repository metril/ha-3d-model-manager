import { describe, expect, it } from "vitest";
import { downsample, linePath, stepPath, tempMax, toPoints } from "../src/dark/logic/charts.ts";
import { buildHistoryMsg, hasData, isFresh, parseHistory } from "../src/dark/logic/history.ts";

describe("history", () => {
  it("builds a minimal message", () => {
    const m = buildHistoryMsg(["sensor.a"], "6h", 10 * 3_600_000);
    expect(m).toMatchObject({ type: "history/history_during_period", minimal_response: true, no_attributes: true, significant_changes_only: true });
    expect(Date.parse(m.end_time) - Date.parse(m.start_time)).toBe(6 * 3_600_000);
  });
  it("parses compressed entries with gaps", () => {
    const d = parseHistory({ n: [{ s: "20", lu: 100 }, { s: "unavailable", lu: 200 }, { s: "30", lu: 300 }] }, { nozzle: "n", bed: "x" }, 0, 400_000);
    expect(d.nozzle.map((p) => p.v)).toEqual([20, null, 30]);
    expect(d.nozzle[0]!.t).toBe(100_000);
    expect(d.bed).toEqual([]);
    expect(hasData(d)).toBe(true);
    expect(hasData(parseHistory({}, {}, 0, 1))).toBe(false);
  });
  it("cache freshness", () => {
    expect(isFresh(0, 59_999)).toBe(true);
    expect(isFresh(0, 60_000)).toBe(false);
    expect(isFresh(undefined, 0)).toBe(false);
  });
});

describe("charts math", () => {
  const box = { x0: 0, x1: 100, y0: 0, y1: 100 };
  it("maps, extends to t1 and breaks on gaps", () => {
    const p = toPoints([{ t: 0, v: 50 }, { t: 50, v: null }, { t: 60, v: 100 }], 0, 100, box, 100);
    expect(p[0]).toEqual({ x: 0, y: 50 });
    expect(p[1]!.y).toBeNull();
    expect(p[p.length - 1]).toEqual({ x: 100, y: 0 });
    expect(linePath(p).match(/M/g)).toHaveLength(2);
    expect(stepPath([{ x: 0, y: 10 }, { x: 5, y: null }, { x: 8, y: 20 }], 10)).toBe("M0.0 10.0 L5.0 10.0 M8.0 20.0 L10.0 20.0");
  });
  it("downsamples to <=120 keeping gaps", () => {
    const pts = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i === 500 ? null : i }));
    const d = downsample(pts, 120);
    expect(d.length).toBe(120);
    expect(d.some((p) => p.y === null)).toBe(true);
    expect(downsample(pts.slice(0, 10), 120)).toHaveLength(10);
  });
  it("temp axis", () => {
    expect(tempMax([null, 20])).toBe(100);
    expect(tempMax([220])).toBe(250);
  });
});
