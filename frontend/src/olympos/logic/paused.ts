/** Seconds since the print_state entity last changed (used while paused). 0 when unknown. */
export function pausedSeconds(e: { last_changed?: string } | undefined, now: number): number {
  const t = e?.last_changed ? Date.parse(e.last_changed) : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 1000)) : 0;
}
