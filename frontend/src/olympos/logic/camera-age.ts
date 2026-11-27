/**
 * Frame-age classification. Hook: 3D Model Manager may later expose a `frame_timestamp`
 * ISO attribute on the camera entity. Missing or invalid values are treated as live.
 */
export type FrameAge = { kind: "live" } | { kind: "lag"; sec: number } | { kind: "stall"; min: number };

export const LAG_S = 5;
export const STALL_S = 60;

export function frameAge(attr: unknown, now: number): FrameAge {
  const t = typeof attr === "string" || typeof attr === "number" ? (typeof attr === "number" ? attr * (attr < 1e12 ? 1000 : 1) : Date.parse(attr)) : NaN;
  if (!Number.isFinite(t)) return { kind: "live" };
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec > STALL_S) return { kind: "stall", min: Math.floor(sec / 60) };
  if (sec > LAG_S) return { kind: "lag", sec };
  return { kind: "live" };
}
