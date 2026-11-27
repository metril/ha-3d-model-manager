import type { ThemeConfig, TokenName } from "./tokens.ts";

export type PaletteName = NonNullable<ThemeConfig["palette"]>;
export const PALETTE_NAMES: readonly PaletteName[] = ["home", "vivid", "mocha"];

export const OLYMPOS_TOKENS = [
  "accent", "progress", "text", "text-secondary", "bg", "chip-bg",
  "surface-0", "surface-1", "surface-2", "surface-3", "deep", "warn", "fault", "tile-accent",
] as const satisfies readonly TokenName[];
export type OlymposToken = (typeof OLYMPOS_TOKENS)[number];
export type Palette = Readonly<Record<OlymposToken, string>>;

export const DEFAULT_ACCENT = "#00AE42";
export const TILE_ACCENT = "rgb(255,145,0)";

interface Raw { page: string; sheet: string; card: string; well: string; chip: string; text: string; sub: string; deep: string; warn: string; red: string }
const RAW: Record<PaletteName, Raw> = {
  home: { page: "#070a0d", sheet: "#10141a", card: "#161a21", well: "#1f2530", chip: "#242b37", text: "#DDDDDD", sub: "#9E9E9E", deep: "#0e1012", warn: "rgb(255,215,64)", red: "rgb(255,102,102)" },
  vivid: { page: "#05070a", sheet: "#0a0d12", card: "#181d26", well: "#232a36", chip: "#2b3341", text: "#E6E6E6", sub: "#A8A8A8", deep: "#0b0d10", warn: "rgb(255,215,64)", red: "rgb(255,102,102)" },
  mocha: { page: "#11111b", sheet: "#1e1e2e", card: "#313244", well: "#45475a", chip: "#585b70", text: "#cdd6f4", sub: "#a6adc8", deep: "#181825", warn: "#f9e2af", red: "#f38ba8" },
};

const build = (r: Raw): Palette => ({
  accent: DEFAULT_ACCENT, progress: DEFAULT_ACCENT, text: r.text, "text-secondary": r.sub, bg: r.card, "chip-bg": r.chip,
  "surface-0": r.page, "surface-1": r.sheet, "surface-2": r.card, "surface-3": r.well, deep: r.deep,
  warn: r.warn, fault: r.red, "tile-accent": TILE_ACCENT,
});

export const PALETTES: Readonly<Record<PaletteName, Palette>> = {
  home: build(RAW.home), vivid: build(RAW.vivid), mocha: build(RAW.mocha),
};

/** Preset token values (used as the fallback layer in `tokenCss`). Unknown names fall back to `home`. */
export function presetVars(palette: string | undefined): Palette {
  return PALETTES[palette as PaletteName] ?? PALETTES.home;
}
