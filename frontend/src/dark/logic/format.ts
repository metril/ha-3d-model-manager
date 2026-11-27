/** Pure formatting helpers for the pop-up printer card. */

/** "42 s", "12 min", "1 h 05 min". */
export function fmtPausedFor(sec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
}

/** Local clock time of an ISO end time, or "" when missing/invalid or already in the past. */
export function fmtEta(end: string | undefined, now: number, locale?: string): string {
  const t = end ? Date.parse(end) : NaN;
  if (!Number.isFinite(t) || t < now - 60_000) return "";
  return new Date(t).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

/** Local clock time for any ISO timestamp, "" when invalid. */
export function fmtClock(iso: string | undefined, locale?: string): string {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? new Date(t).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }) : "";
}

/**
 * Minutes of printing already done, derived from progress (0..1) and remaining minutes:
 * elapsed = p / (1 - p) * remaining. Undefined when it cannot be estimated.
 */
export function timeLost(progress: number, remainingMin: number): number | undefined {
  if (!Number.isFinite(progress) || !Number.isFinite(remainingMin) || progress <= 0 || progress >= 1 || remainingMin < 0) return undefined;
  return Math.round((progress / (1 - progress)) * remainingMin);
}

/** "2 h 01 min" / "45 min". */
export function fmtMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
}

export const SPOOL_LOW_PCT = 15;
export const spoolLow = (pct: number | undefined): boolean => pct !== undefined && Number.isFinite(pct) && pct >= 0 && pct < SPOOL_LOW_PCT;
