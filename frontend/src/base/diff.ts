import type { HomeAssistant } from "../ha-types.ts";

export function hassChanged(prev: HomeAssistant | undefined, next: HomeAssistant, ids: readonly string[]): boolean {
  if (!prev) return true;
  if (prev.entities !== next.entities || prev.devices !== next.devices) return true;
  if (prev.locale?.language !== next.locale?.language) return true;
  if (prev.themes?.darkMode !== next.themes?.darkMode || prev.selectedTheme?.theme !== next.selectedTheme?.theme) return true;
  for (const id of ids) if (prev.states[id] !== next.states[id]) return true;
  return false;
}
