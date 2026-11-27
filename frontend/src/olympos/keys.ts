import type { EntityKey } from "../entities.ts";

export const PRINTER_KEYS: readonly EntityKey[] = [
  "print_state", "progress", "remaining_time", "end_time", "current_layer", "total_layers",
  "nozzle_temperature", "bed_temperature", "chamber_temperature", "nozzle_target_temperature", "bed_target_temperature",
  "stage", "speed_profile", "wifi_signal", "current_model", "print_error", "firmware_version", "nozzle_type", "nozzle_diameter",
  "external_spool_material", "external_spool_color", "online", "door_open", "hms_active",
  "camera", "print_thumbnail", "chamber_light", "part_fan", "aux_fan", "chamber_fan",
  "pause", "resume", "stop", "home", "clear_hms",
];
export const TILE_KEYS: readonly EntityKey[] = [
  "print_state", "progress", "remaining_time", "current_layer", "total_layers", "current_model", "print_error", "hms_active", "online",
];
export const AMS_KEYS: readonly EntityKey[] = ["online", "external_spool_material", "external_spool_color"];
