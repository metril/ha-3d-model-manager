import { vi } from "vitest";
import { ENTITY_KEYS, type EntityKey } from "../../src/entities.js";
import type { DeviceRegistryEntry, EntityRegistryDisplayEntry, HassEntity, HomeAssistant } from "../../src/ha-types.js";

export interface MakeHassOpts {
  states?: Partial<Record<string, Partial<HassEntity>>>;
  omit?: EntityKey[];
  amsUnits?: number;
  dark?: boolean;
}

const STATES: Partial<Record<EntityKey, string>> = {
  print_state: "running", progress: "42", remaining_time: "60", end_time: "2026-10-30T18:00:00+00:00",
  current_layer: "120", total_layers: "300", nozzle_temperature: "220", bed_temperature: "60",
  chamber_temperature: "35", nozzle_target_temperature: "220", bed_target_temperature: "60",
  stage: "printing", speed_profile: "standard", wifi_signal: "-55", current_model: "Benchy",
  print_error: "none", active_filament_material: "PLA", active_filament_color: "#FF0000FF",
  firmware_version: "01.08.00.00", nozzle_type: "hardened_steel", nozzle_diameter: "0.4",
  external_spool_material: "PETG", external_spool_color: "#00FF00FF",
  online: "on", door_open: "off", printing: "on", hms_active: "off",
  camera: "idle", print_thumbnail: "2026-10-30T10:00:00+00:00", chamber_light: "on",
  part_fan: "on", aux_fan: "off", chamber_fan: "off",
  pause: "unknown", resume: "unknown", stop: "unknown", home: "unknown", clear_hms: "unknown",
};

const TRAYS = [
  { material: "PLA", color: "#FF0000FF", remaining: "80" },
  { material: "PETG", color: "#00FF00FF", remaining: "55" },
  { material: "ABS", color: "#0000FFFF", remaining: "20" },
  { material: "empty", color: "#00000000", remaining: "0" },
];

const now = "2026-10-30T10:00:00+00:00";

export function makeHass(opts: MakeHassOpts = {}): HomeAssistant {
  const omit = new Set(opts.omit ?? []);
  const states: Record<string, HassEntity> = {};
  const entities: Record<string, EntityRegistryDisplayEntry> = {};
  const devices: Record<string, DeviceRegistryEntry> = {
    dev_p1: { id: "dev_p1", name: "X1C Garage", model: "X1C", via_device_id: null },
  };

  const add = (entity_id: string, device_id: string, translation_key: string, state: string, attributes: Record<string, unknown> = {}) => {
    entities[entity_id] = { entity_id, device_id, platform: "tdmm", translation_key };
    states[entity_id] = { entity_id, state, attributes, last_changed: now, last_updated: now };
  };

  const addKey = (key: EntityKey, domain: string) => {
    const attributes: Record<string, unknown> = key === "remaining_time" ? { unit_of_measurement: "min" } : {};
    add(`${domain}.x1c_garage_${key}_renamed`, "dev_p1", key, STATES[key] ?? "unknown", attributes);
  };

  for (const key of Object.keys(ENTITY_KEYS) as EntityKey[]) {
    if (omit.has(key)) continue;
    const prefs = ENTITY_KEYS[key];
    // register the lowest-preference domain first so tests prove preference order, not registry order
    for (const domain of [...prefs].reverse()) addKey(key, domain);
  }

  const units = opts.amsUnits ?? 1;
  for (let u = 1; u <= units; u++) {
    const dev = `dev_ams${u}`;
    devices[dev] = { id: dev, name: `AMS ${u}`, model: "AMS", via_device_id: "dev_p1" };
    add(`sensor.ams_${u}_hum_renamed`, dev, "ams_humidity", "4", { ams_unit: u });
    add(`sensor.ams_${u}_temp_renamed`, dev, "ams_temperature", "28", { ams_unit: u });
    TRAYS.forEach((t, i) => {
      const slot = i + 1;
      add(`sensor.ams_${u}_t${slot}_mat_renamed`, dev, "tray_material", t.material, { ams_unit: u, slot });
      add(`sensor.ams_${u}_t${slot}_col_renamed`, dev, "tray_color", t.color, { ams_unit: u, slot });
      add(`sensor.ams_${u}_t${slot}_rem_renamed`, dev, "tray_remaining", t.remaining, { ams_unit: u, slot });
    });
  }

  for (const [id, patch] of Object.entries(opts.states ?? {})) {
    const base = states[id] ?? { entity_id: id, state: "unknown", attributes: {}, last_changed: now, last_updated: now };
    states[id] = { ...base, ...patch, attributes: { ...base.attributes, ...(patch?.attributes ?? {}) } };
  }

  return {
    states, entities, devices,
    locale: { language: "en" },
    themes: { darkMode: opts.dark ?? false },
    callService: vi.fn(async () => undefined),
  };
}
