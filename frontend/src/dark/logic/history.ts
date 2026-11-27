import type { ChartPoint, ChartRange, ChartsData } from "../contracts.ts";

export const RANGE_MS: Record<ChartRange, number> = { "1h": 3_600_000, "6h": 21_600_000, "24h": 86_400_000 };
export const CACHE_MS = 60_000;

export interface HistoryMsg {
  type: "history/history_during_period";
  start_time: string;
  end_time: string;
  entity_ids: string[];
  minimal_response: true;
  no_attributes: true;
  significant_changes_only: true;
}

export function buildHistoryMsg(ids: readonly string[], range: ChartRange, now: number): HistoryMsg {
  return {
    type: "history/history_during_period",
    start_time: new Date(now - RANGE_MS[range]).toISOString(),
    end_time: new Date(now).toISOString(),
    entity_ids: [...ids],
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: true,
  };
}

/** Compressed entry: `s` state, `lu`/`lc` epoch seconds (may be absent on repeated entries). */
export interface HistoryEntry { s?: string; state?: string; lu?: number; lc?: number; last_updated?: string | number; last_changed?: string | number }
export type HistoryResponse = Record<string, HistoryEntry[]>;

const toMs = (e: HistoryEntry): number | undefined => {
  const raw = e.lu ?? e.lc ?? e.last_updated ?? e.last_changed;
  if (typeof raw === "number") return raw * 1000;
  if (typeof raw === "string") { const t = Date.parse(raw); return Number.isFinite(t) ? t : undefined; }
  return undefined;
};

export function parseSeries(entries: HistoryEntry[] | undefined, t0: number): ChartPoint[] {
  const out: ChartPoint[] = [];
  let last = t0;
  for (const e of entries ?? []) {
    const s = e.s ?? e.state;
    const n = typeof s === "string" && s.trim() !== "" ? Number(s) : NaN;
    // The first entry carries no timestamp in some payloads: anchor it at the range start.
    const t = Math.max(toMs(e) ?? last, last);
    last = t;
    out.push({ t, v: Number.isFinite(n) ? n : null });
  }
  return out;
}

export interface SeriesIds { nozzle?: string; bed?: string; nozzleTarget?: string; bedTarget?: string; progress?: string }

export function parseHistory(resp: HistoryResponse | null | undefined, ids: SeriesIds, t0: number, t1: number): ChartsData {
  const get = (id?: string) => (id ? parseSeries(resp?.[id], t0) : []);
  return {
    t0, t1,
    nozzle: get(ids.nozzle), bed: get(ids.bed),
    nozzleTarget: get(ids.nozzleTarget), bedTarget: get(ids.bedTarget),
    progress: get(ids.progress),
  };
}

export const hasData = (d: ChartsData | undefined): boolean =>
  !!d && [d.nozzle, d.bed, d.progress].some((s) => s.some((p) => p.v !== null));

/** Cache entry is fresh when fetched within CACHE_MS. */
export const isFresh = (fetchedAt: number | undefined, now: number): boolean => fetchedAt !== undefined && now - fetchedAt < CACHE_MS;
