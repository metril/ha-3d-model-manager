/**
 * Seconds the print has been paused. Prefers the print_state `paused_at` attribute (3DMM >= 0.26),
 * falling back to the entity's last_changed. 0 when unknown.
 */
export function pausedSeconds(
  e: { last_changed?: string; attributes?: Record<string, unknown> } | undefined,
  now: number,
): number {
  const at = e?.attributes?.paused_at;
  let t = typeof at === "string" ? Date.parse(at) : NaN;
  if (!Number.isFinite(t)) t = e?.last_changed ? Date.parse(e.last_changed) : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 1000)) : 0;
}
