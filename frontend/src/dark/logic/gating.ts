export type Phase = "printing" | "paused" | "idle" | "finished" | "failed" | "offline";

/** Inputs are raw entity state strings (undefined when the entity is missing). */
export function printerPhase(s: { print_state?: string; online?: string }): Phase {
  if (s.online === "off" || s.online === "unavailable" || s.print_state === "unavailable" || s.print_state === undefined) return "offline";
  switch (s.print_state) {
    case "running": case "prepare": case "slicing": return "printing";
    case "pause": return "paused";
    case "finish": return "finished";
    case "failed": return "failed";
    default: return "idle";
  }
}

export const isActive = (p: Phase): boolean => p === "printing" || p === "paused";

export interface Chips { stage: boolean; paused: boolean; hms: boolean }
export function chips(phase: Phase, hms: boolean): Chips {
  return { stage: isActive(phase), paused: phase === "paused", hms };
}

/** Show a target temperature only while active and when it differs from current by more than 3 degrees. */
export function showTarget(cur: number | undefined, tgt: number | undefined, phase: Phase): boolean {
  if (!isActive(phase) || cur === undefined || tgt === undefined || !Number.isFinite(cur) || !Number.isFinite(tgt)) return false;
  return tgt > 0 && Math.abs(tgt - cur) > 3;
}

export type CameraMode = "live" | "last" | "hidden";
export function cameraMode(phase: Phase, hasEntity: boolean): CameraMode {
  if (!hasEntity) return "hidden";
  if (phase === "printing" || phase === "paused" || phase === "failed") return "live";
  return phase === "finished" ? "last" : "hidden";
}

export interface Controls { pause: boolean; resume: boolean; stop: boolean; home: boolean; speed: boolean }
export function controlsEnabled(phase: Phase): Controls {
  const idleLike = phase === "idle" || phase === "finished" || phase === "failed";
  return { pause: phase === "printing", resume: phase === "paused", stop: isActive(phase), home: idleLike, speed: idleLike };
}
