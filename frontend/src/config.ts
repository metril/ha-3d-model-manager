import type { ThemeConfig } from "./theme/tokens.ts";

export type BlockType =
  | "header" | "progress" | "temps" | "job" | "hms" | "actions" | "fans"
  | "light" | "speed" | "ams" | "ext" | "camera";
export interface BlockEntry { type: BlockType; hidden?: boolean }
export type TabId = "status" | "control" | "filament";
export type CardKind = "printer" | "progress" | "ams" | "camera";

export const CARD_TYPES: Record<CardKind, string> = {
  printer: "custom:tdmm-printer-card",
  progress: "custom:tdmm-progress-card",
  ams: "custom:tdmm-ams-card",
  camera: "custom:tdmm-camera-card",
};

export interface TdmmCardConfig {
  type: string;
  device_id: string;
  tabs?: Partial<Record<TabId, BlockEntry[]>>;
  blocks?: BlockEntry[];
  theme?: ThemeConfig;
  hide_tabs?: TabId[];
  default_tab?: TabId;
  camera_view?: "auto" | "live";
}

export interface NormalizedConfig extends Required<Pick<TdmmCardConfig, "type" | "device_id">> {
  kind: CardKind;
  tabs: Record<TabId, BlockEntry[]>;
  blocks: BlockEntry[];
  theme: ThemeConfig;
  hide_tabs: TabId[];
  default_tab: TabId;
  camera_view: "auto" | "live";
}

const entries = (...types: BlockType[]): BlockEntry[] => types.map((type) => ({ type }));

export const CARD_DEFAULTS = {
  tabs: {
    status: entries("header", "progress", "temps", "job", "hms"),
    control: entries("actions", "temps", "fans", "light", "speed"),
    filament: entries("ams", "ext"),
  } as Record<TabId, BlockEntry[]>,
  blocks: {
    printer: [] as BlockEntry[],
    progress: entries("header", "progress", "job"),
    ams: entries("ams", "ext"),
    camera: entries("camera", "progress"),
  } as Record<CardKind, BlockEntry[]>,
  default_tab: "status" as TabId,
  hide_tabs: [] as TabId[],
  camera_view: "auto" as "auto" | "live",
  theme: {} as ThemeConfig,
  // theme-level defaults dropped by the serializer
  theme_keys: { density: "normal", icon_set: "default" } as Record<string, unknown>,
};

const TAB_IDS: readonly TabId[] = ["status", "control", "filament"];
const BLOCK_TYPES: readonly string[] = [
  "header", "progress", "temps", "job", "hms", "actions", "fans", "light", "speed", "ams", "ext", "camera",
];

export function kindFromType(type: string): CardKind {
  for (const k of Object.keys(CARD_TYPES) as CardKind[]) if (CARD_TYPES[k] === type) return k;
  throw new Error(`Unknown card type: ${type}`);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function normalizeList(raw: unknown, defaults: BlockEntry[], where: string): BlockEntry[] {
  const out: BlockEntry[] = [];
  const seen = new Set<string>();
  if (raw !== undefined && !Array.isArray(raw)) console.warn(`tdmm: ${where} must be a list; using defaults`);
  const list = Array.isArray(raw) ? raw : raw === undefined ? defaults : [];
  for (const item of list) {
    const type = isObj(item) ? item.type : undefined;
    if (typeof type !== "string" || !BLOCK_TYPES.includes(type)) {
      console.warn(`tdmm: dropping unknown block type in ${where}:`, type);
      continue;
    }
    if (seen.has(type)) continue;
    seen.add(type);
    const e: BlockEntry = { type: type as BlockType };
    if ((item as Record<string, unknown>).hidden === true) e.hidden = true;
    out.push(e);
  }
  if (Array.isArray(raw)) for (const d of defaults) if (!seen.has(d.type)) out.push({ type: d.type });
  return out;
}

export function normalizeConfig(raw: unknown): NormalizedConfig {
  const r = isObj(raw) ? raw : {};
  if (typeof r.device_id !== "string" || r.device_id === "") throw new Error("device_id is required");
  const type = typeof r.type === "string" ? r.type : CARD_TYPES.printer;
  const kind = kindFromType(type);

  const rawTabs = isObj(r.tabs) ? r.tabs : {};
  for (const k of Object.keys(rawTabs)) {
    if (!TAB_IDS.includes(k as TabId)) console.warn(`tdmm: dropping unknown tab "${k}"`);
  }
  const tabs = {} as Record<TabId, BlockEntry[]>;
  for (const t of TAB_IDS) tabs[t] = normalizeList(rawTabs[t], CARD_DEFAULTS.tabs[t], `tabs.${t}`);

  const blocks = normalizeList(r.blocks, CARD_DEFAULTS.blocks[kind], "blocks");
  const hide: TabId[] = [];
  if (Array.isArray(r.hide_tabs)) {
    for (const t of r.hide_tabs) if (TAB_IDS.includes(t as TabId) && !hide.includes(t as TabId)) hide.push(t as TabId);
  }
  const default_tab = TAB_IDS.includes(r.default_tab as TabId) ? (r.default_tab as TabId) : CARD_DEFAULTS.default_tab;
  const camera_view = r.camera_view === "live" ? "live" : "auto";
  const theme: ThemeConfig = isObj(r.theme) ? { ...(r.theme as ThemeConfig) } : {};
  return { type, device_id: r.device_id, kind, tabs, blocks, theme, hide_tabs: hide, default_tab, camera_view };
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function serList(list: BlockEntry[]): BlockEntry[] {
  return list.map((b) => (b.hidden === true ? { type: b.type, hidden: true } : { type: b.type }));
}

export function serializeConfig(cfg: NormalizedConfig): TdmmCardConfig {
  const out: TdmmCardConfig = { type: cfg.type, device_id: cfg.device_id };
  if (cfg.kind === "printer") {
    const tabs: Partial<Record<TabId, BlockEntry[]>> = {};
    for (const t of TAB_IDS) {
      const l = serList(cfg.tabs[t]);
      if (!deepEqual(l, CARD_DEFAULTS.tabs[t])) tabs[t] = l;
    }
    if (Object.keys(tabs).length) out.tabs = tabs;
    if (cfg.hide_tabs.length) out.hide_tabs = [...cfg.hide_tabs];
    if (cfg.default_tab !== CARD_DEFAULTS.default_tab) out.default_tab = cfg.default_tab;
  } else {
    const l = serList(cfg.blocks);
    if (!deepEqual(l, CARD_DEFAULTS.blocks[cfg.kind])) out.blocks = l;
  }
  if (cfg.kind === "camera" && cfg.camera_view !== CARD_DEFAULTS.camera_view) out.camera_view = cfg.camera_view;
  const theme: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cfg.theme)) {
    if (v === undefined || v === "") continue;
    if (k in CARD_DEFAULTS.theme_keys && deepEqual(v, CARD_DEFAULTS.theme_keys[k])) continue;
    theme[k] = v;
  }
  if (Object.keys(theme).length) out.theme = theme as ThemeConfig;
  return out;
}
