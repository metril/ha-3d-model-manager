import type { HoldState } from "../contracts.ts";

export const HOLD_MS = 1500;
export const ARM_MS = 6000;

export type HoldEvent = "down" | "up" | "tick" | "cancel" | "confirm" | "timeout";
export const IDLE: HoldState = { kind: "idle" };

/** Reducer for the hold-to-stop machine: idle -> holding -> armed -> idle. Confirm side effects belong to the caller. */
export function step(s: HoldState, ev: HoldEvent, now: number): HoldState {
  switch (s.kind) {
    case "idle":
      return ev === "down" ? { kind: "holding", t0: now } : s;
    case "holding":
      if (ev === "up" || ev === "cancel") return IDLE;
      if (ev === "tick" && now - s.t0 >= HOLD_MS) return { kind: "armed", t: now };
      return s;
    case "armed":
      if (ev === "cancel" || ev === "confirm" || ev === "timeout") return IDLE;
      if (ev === "tick" && now - s.t >= ARM_MS) return IDLE;
      return s;
  }
}

/** Hold fill, 0..1. */
export const holdProgress = (s: HoldState, now: number): number => (s.kind === "holding" ? Math.min(1, Math.max(0, (now - s.t0) / HOLD_MS)) : 0);
