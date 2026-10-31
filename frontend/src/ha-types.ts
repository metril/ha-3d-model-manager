export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface EntityRegistryDisplayEntry {
  entity_id: string;
  device_id?: string;
  platform?: string;
  translation_key?: string;
  hidden?: boolean;
}

export interface DeviceRegistryEntry {
  id: string;
  name?: string;
  model?: string;
  via_device_id?: string | null;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  entities: Record<string, EntityRegistryDisplayEntry>;
  devices: Record<string, DeviceRegistryEntry>;
  locale: { language: string };
  themes: { darkMode: boolean };
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
  localize?(key: string): string;
}
