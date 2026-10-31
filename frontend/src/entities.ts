import { CARD_TYPES, type CardKind, type TdmmCardConfig } from "./config.ts";
import type { HomeAssistant } from "./ha-types.js";

export type EntityKey =
  | "print_state" | "progress" | "remaining_time" | "end_time" | "current_layer" | "total_layers"
  | "nozzle_temperature" | "bed_temperature" | "chamber_temperature"
  | "nozzle_target_temperature" | "bed_target_temperature"
  | "stage" | "speed_profile" | "wifi_signal" | "current_model" | "print_error"
  | "active_filament_material" | "active_filament_color" | "firmware_version"
  | "nozzle_type" | "nozzle_diameter" | "external_spool_material" | "external_spool_color"
  | "online" | "door_open" | "printing" | "hms_active"
  | "camera" | "print_thumbnail" | "chamber_light"
  | "part_fan" | "aux_fan" | "chamber_fan"
  | "pause" | "resume" | "stop" | "home" | "clear_hms";

export type Domain =
  | "sensor" | "binary_sensor" | "number" | "select" | "camera" | "image" | "light" | "fan" | "button";

export const ENTITY_KEYS: Readonly<Record<EntityKey, readonly Domain[]>> = {
  print_state: ["sensor"],
  progress: ["sensor"],
  remaining_time: ["sensor"],
  end_time: ["sensor"],
  current_layer: ["sensor"],
  total_layers: ["sensor"],
  nozzle_temperature: ["sensor"],
  bed_temperature: ["sensor"],
  chamber_temperature: ["sensor"],
  nozzle_target_temperature: ["number", "sensor"],
  bed_target_temperature: ["number", "sensor"],
  stage: ["sensor"],
  speed_profile: ["select", "sensor"],
  wifi_signal: ["sensor"],
  current_model: ["sensor"],
  print_error: ["sensor"],
  active_filament_material: ["sensor"],
  active_filament_color: ["sensor"],
  firmware_version: ["sensor"],
  nozzle_type: ["sensor"],
  nozzle_diameter: ["sensor"],
  external_spool_material: ["sensor"],
  external_spool_color: ["sensor"],
  online: ["binary_sensor"],
  door_open: ["binary_sensor"],
  printing: ["binary_sensor"],
  hms_active: ["binary_sensor"],
  camera: ["camera"],
  print_thumbnail: ["image"],
  chamber_light: ["light"],
  part_fan: ["fan"],
  aux_fan: ["fan"],
  chamber_fan: ["fan"],
  pause: ["button"],
  resume: ["button"],
  stop: ["button"],
  home: ["button"],
  clear_hms: ["button"],
};

export interface AmsSlotEntities {
  slot: number;
  material?: string;
  color?: string;
  remaining?: string;
}

export interface AmsUnitEntities {
  unit: number;
  humidity?: string;
  temperature?: string;
  slots: AmsSlotEntities[];
}

export interface ResolvedEntities {
  deviceFound: boolean;
  byKey: Partial<Record<EntityKey, string>>;
  ams: AmsUnitEntities[];
  /** Tray/unit entities lacking ams_unit attributes (unavailable): re-resolve when their state changes. */
  unresolved: string[];
}

const PLATFORM = "tdmm";
const TRAY_FIELD = { tray_material: "material", tray_color: "color", tray_remaining: "remaining" } as const;
const UNIT_FIELD = { ams_humidity: "humidity", ams_temperature: "temperature" } as const;

const isKey = (k: string): k is EntityKey => Object.prototype.hasOwnProperty.call(ENTITY_KEYS, k);
const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

export function resolveEntities(hass: HomeAssistant, deviceId: string): ResolvedEntities {
  const result: ResolvedEntities = { deviceFound: !!hass.devices?.[deviceId], byKey: {}, ams: [], unresolved: [] };
  if (!result.deviceFound) return result;

  const children = new Set<string>();
  for (const d of Object.values(hass.devices)) if (d.via_device_id === deviceId) children.add(d.id);

  // candidates[key][domain] = first entity_id seen (sorted for determinism)
  const candidates: Partial<Record<EntityKey, Partial<Record<Domain, string>>>> = {};
  const units = new Map<number, AmsUnitEntities>();
  const unitOf = (n: number): AmsUnitEntities => {
    let u = units.get(n);
    if (!u) units.set(n, (u = { unit: n, slots: [] }));
    return u;
  };

  const entries = Object.values(hass.entities ?? {})
    .filter((e) => e.platform === PLATFORM && e.device_id && (e.device_id === deviceId || children.has(e.device_id)))
    .sort((a, b) => (a.entity_id < b.entity_id ? -1 : a.entity_id > b.entity_id ? 1 : 0));

  for (const e of entries) {
    const tk = e.translation_key;
    if (!tk) continue;
    const domain = e.entity_id.split(".")[0] as Domain;
    if (isKey(tk)) {
      if (e.device_id !== deviceId) continue;
      const slotMap = (candidates[tk] ??= {});
      slotMap[domain] ??= e.entity_id;
      continue;
    }
    const attrs = hass.states[e.entity_id]?.attributes;
    const unitNo = num(attrs?.ams_unit);
    if (unitNo === undefined) {
      if (Object.hasOwn(TRAY_FIELD, tk) || Object.hasOwn(UNIT_FIELD, tk)) result.unresolved.push(e.entity_id);
      continue;
    }
    if (Object.hasOwn(TRAY_FIELD, tk)) {
      const slotNo = num(attrs?.slot);
      if (slotNo === undefined) {
        result.unresolved.push(e.entity_id);
        continue;
      }
      const u = unitOf(unitNo);
      let s = u.slots.find((x) => x.slot === slotNo);
      if (!s) u.slots.push((s = { slot: slotNo }));
      s[TRAY_FIELD[tk as keyof typeof TRAY_FIELD]] = e.entity_id;
    } else if (Object.hasOwn(UNIT_FIELD, tk)) {
      unitOf(unitNo)[UNIT_FIELD[tk as keyof typeof UNIT_FIELD]] = e.entity_id;
    }
  }

  for (const key of Object.keys(ENTITY_KEYS) as EntityKey[]) {
    const found = candidates[key];
    if (!found) continue;
    for (const d of ENTITY_KEYS[key]) {
      if (found[d]) {
        result.byKey[key] = found[d];
        break;
      }
    }
  }

  result.ams = [...units.values()].sort((a, b) => a.unit - b.unit);
  for (const u of result.ams) u.slots.sort((a, b) => a.slot - b.slot);
  return result;
}

export function allEntityIds(r: ResolvedEntities): string[] {
  const ids: string[] = [...Object.values(r.byKey), ...r.unresolved];
  for (const u of r.ams) {
    if (u.humidity) ids.push(u.humidity);
    if (u.temperature) ids.push(u.temperature);
    for (const s of u.slots) for (const id of [s.material, s.color, s.remaining]) if (id) ids.push(id);
  }
  return ids;
}

/** Stub config for the card picker: first tdmm printer device found. */
export function stubConfigFor(kind: CardKind, hass: HomeAssistant | undefined): TdmmCardConfig {
  const hit = Object.values(hass?.entities ?? {}).find(
    (e) => e.platform === "tdmm" && e.translation_key === "online" && e.entity_id.startsWith("binary_sensor.") && e.device_id,
  );
  return { type: CARD_TYPES[kind], device_id: hit?.device_id ?? "" };
}
