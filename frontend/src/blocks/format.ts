import type { HassEntity } from "../ha-types.ts";

const DASH = "—";

export function isAvailable(s?: HassEntity): boolean {
  return !!s && s.state !== "unavailable" && s.state !== "unknown";
}

const numeric = (s?: HassEntity): number | undefined => {
  if (!isAvailable(s) || (s as HassEntity).state.trim() === "") return undefined;
  const n = Number((s as HassEntity).state);
  return Number.isFinite(n) ? n : undefined;
};

export function fmtDuration(value: number, unit?: string): string {
  const minutes = Math.floor(unit === "s" ? value / 60 : unit === "h" ? value * 60 : value);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function fmtTemp(s?: HassEntity): string {
  const n = numeric(s);
  return n === undefined ? DASH : `${Math.round(n)} °C`;
}

export function fmtPercent(s?: HassEntity): string {
  const n = numeric(s);
  return n === undefined ? DASH : `${Math.round(n)}%`;
}

export function fmtRemaining(s?: HassEntity): string {
  const n = numeric(s);
  return n === undefined ? DASH : fmtDuration(n, s?.attributes.unit_of_measurement as string | undefined);
}

export function fmtText(s?: HassEntity): string {
  return isAvailable(s) ? (s as HassEntity).state : DASH;
}

export function fmtInt(s?: HassEntity): string {
  const n = numeric(s);
  return n === undefined ? DASH : String(Math.round(n));
}

export const present = (...ids: (string | undefined)[]): string[] => ids.filter((x): x is string => !!x);
