import type { HomeAssistant, HassEntity } from "../ha-types.ts";

export interface HassSnapshot {
  states: Record<string, HassEntity>;
  entities: HomeAssistant["entities"];
  devices: HomeAssistant["devices"];
  language: string;
}

export function hassChanged(prev: HomeAssistant | undefined, next: HomeAssistant, ids: readonly string[]): boolean {
  if (!prev) return true;
  if (prev.entities !== next.entities || prev.devices !== next.devices) return true;
  if (prev.locale?.language !== next.locale?.language) return true;
  for (const id of ids) if (prev.states[id] !== next.states[id]) return true;
  return false;
}
