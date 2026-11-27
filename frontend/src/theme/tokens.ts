export type TokenName =
  | "accent" | "progress" | "text" | "text-secondary" | "bg" | "on-accent" | "chip-bg"
  | "radius" | "gap" | "font-family" | "font-size" | "icon-size"
  | "surface-0" | "surface-1" | "surface-2" | "surface-3" | "deep" | "warn" | "fault" | "tile-accent";

export interface TokenDef {
  name: TokenName;
  fallback: string;
  description: string;
  kind: "color" | "length" | "font";
}

export const TOKENS: readonly TokenDef[] = [
  { name: "accent", fallback: "var(--primary-color)", description: "Accent color for active controls and highlights.", kind: "color" },
  { name: "progress", fallback: "var(--primary-color)", description: "Progress bar fill color.", kind: "color" },
  { name: "text", fallback: "var(--primary-text-color)", description: "Primary text color.", kind: "color" },
  { name: "text-secondary", fallback: "var(--secondary-text-color)", description: "Secondary text and label color.", kind: "color" },
  { name: "bg", fallback: "var(--ha-card-background, var(--card-background-color))", description: "Card background.", kind: "color" },
  { name: "on-accent", fallback: "var(--tdmm-on-accent-auto, var(--text-primary-color, var(--_tdmm-bg)))", description: "Text and icons on accent fills. Defaults to black or white, whichever contrasts more with the accent.", kind: "color" },
  { name: "chip-bg", fallback: "var(--secondary-background-color)", description: "Background of chips, tiles and bars.", kind: "color" },
  { name: "radius", fallback: "var(--ha-card-border-radius, 12px)", description: "Corner radius.", kind: "length" },
  { name: "gap", fallback: "8px", description: "Spacing between blocks and items.", kind: "length" },
  { name: "font-family", fallback: "var(--ha-font-family-body, inherit)", description: "Font family.", kind: "font" },
  { name: "font-size", fallback: "var(--ha-font-size-m, 14px)", description: "Base font size.", kind: "length" },
  { name: "icon-size", fallback: "24px", description: "Icon size.", kind: "length" },
  { name: "surface-0", fallback: "var(--primary-background-color)", description: "Dark cards: page-level surface.", kind: "color" },
  { name: "surface-1", fallback: "var(--card-background-color)", description: "Dark cards: sheet surface.", kind: "color" },
  { name: "surface-2", fallback: "var(--secondary-background-color)", description: "Dark cards: raised card surface.", kind: "color" },
  { name: "surface-3", fallback: "var(--divider-color)", description: "Dark cards: wells and inset areas.", kind: "color" },
  { name: "deep", fallback: "var(--primary-background-color)", description: "Dark cards: deepest background (camera, overlays).", kind: "color" },
  { name: "warn", fallback: "var(--warning-color)", description: "Warning color (paused, low filament).", kind: "color" },
  { name: "fault", fallback: "var(--error-color)", description: "Fault color (failed, alerts).", kind: "color" },
  { name: "tile-accent", fallback: "var(--orange-color, var(--warning-color))", description: "Printer tile card identity color.", kind: "color" },
];

/** `preset` values replace the HA fallbacks (chain: card theme var, user `--tdmm-*`, preset, HA fallback). */
export function tokenCss(preset?: Partial<Record<TokenName, string>>): string {
  return `:host{${TOKENS.map((t) => `--_tdmm-${t.name}: var(--tdmm-${t.name}, ${preset?.[t.name] ?? t.fallback});`).join("")}}`;
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function parseColor(input: string): [number, number, number] | undefined {
  const s = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1]!;
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return undefined;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return undefined;
}

/** Pick #000000 or #ffffff, whichever has the higher WCAG contrast against `color`. */
export function pickOnAccent(color: string): string | undefined {
  const rgb = parseColor(color);
  if (!rgb) return undefined;
  const l = luminance(rgb);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? "#000000" : "#ffffff";
}

export type Density = "compact" | "normal" | "comfortable";
export const DENSITY_GAP: Record<Density, string> = { compact: "4px", normal: "8px", comfortable: "12px" };

export type IconSet = "default" | "outline";
export type IconName =
  | "printer" | "nozzle" | "bed" | "chamber" | "fan" | "light" | "pause" | "play" | "stop"
  | "home" | "alert" | "clock" | "layers" | "speed" | "wifi" | "spool" | "humidity" | "camera";

export const ICON_SETS: Record<IconSet, Record<IconName, string>> = {
  default: {
    printer: "mdi:printer-3d", nozzle: "mdi:printer-3d-nozzle", bed: "mdi:radiator", chamber: "mdi:thermometer",
    fan: "mdi:fan", light: "mdi:lightbulb", pause: "mdi:pause", play: "mdi:play", stop: "mdi:stop",
    home: "mdi:home", alert: "mdi:alert", clock: "mdi:clock", layers: "mdi:layers", speed: "mdi:speedometer",
    wifi: "mdi:wifi", spool: "mdi:printer-3d-nozzle", humidity: "mdi:water-percent", camera: "mdi:camera",
  },
  outline: {
    printer: "mdi:printer-3d-nozzle-outline", nozzle: "mdi:printer-3d-nozzle-outline", bed: "mdi:radiator", chamber: "mdi:thermometer",
    fan: "mdi:fan", light: "mdi:lightbulb-outline", pause: "mdi:pause-circle-outline", play: "mdi:play-circle-outline",
    stop: "mdi:stop-circle-outline", home: "mdi:home-outline", alert: "mdi:alert-outline", clock: "mdi:clock-outline",
    layers: "mdi:layers-outline", speed: "mdi:speedometer", wifi: "mdi:wifi", spool: "mdi:printer-3d-nozzle-outline",
    humidity: "mdi:water-percent", camera: "mdi:camera-outline",
  },
};

export interface ThemeConfig {
  accent?: string;
  progress?: string;
  text?: string;
  text_secondary?: string;
  bg?: string;
  on_accent?: string;
  chip_bg?: string;
  radius?: number;
  font_family?: string;
  font_size?: number;
  icon_size?: number;
  density?: Density;
  icon_set?: IconSet;
  preset?: "dark";
  palette?: "default" | "vivid" | "mocha";
  warn?: string;
  fault?: string;
  tile_accent?: string;
}

export function themeStyleVars(theme: ThemeConfig | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!theme) return out;
  const str = (k: string, v: string | undefined) => { if (v !== undefined) out[`--tdmm-${k}`] = v; };
  const px = (k: string, v: number | undefined) => { if (v !== undefined) out[`--tdmm-${k}`] = `${v}px`; };
  str("accent", theme.accent);
  str("progress", theme.progress);
  str("text", theme.text);
  str("text-secondary", theme.text_secondary);
  str("bg", theme.bg);
  str("on-accent", theme.on_accent);
  str("warn", theme.warn);
  str("fault", theme.fault);
  str("tile-accent", theme.tile_accent);
  str("chip-bg", theme.chip_bg);
  px("radius", theme.radius);
  str("font-family", theme.font_family);
  px("font-size", theme.font_size);
  px("icon-size", theme.icon_size);
  if (theme.density && theme.density !== "normal") out["--tdmm-gap"] = DENSITY_GAP[theme.density];
  return out;
}

export function renderThemingMarkdown(): string {
  const rows = TOKENS.map((t) => `| \`--tdmm-${t.name}\` | \`${t.fallback}\` | ${t.description} |`).join("\n");
  const yamlLines = TOKENS.filter((t) => t.kind === "color").map((t) => `      --tdmm-${t.name}: "#ff6600"`);
  const keys = [
    "accent", "progress", "text", "text_secondary", "bg", "on_accent", "chip_bg", "radius", "font_family",
    "font_size", "icon_size", "density", "icon_set", "preset", "palette", "warn", "fault", "tile_accent",
  ].map((k) => `- \`${k}\``).join("\n");
  const dens = (Object.keys(DENSITY_GAP) as Density[]).map((d) => `| \`${d}\` | \`${DENSITY_GAP[d]}\` |`).join("\n");
  const icons = (Object.keys(ICON_SETS.default) as IconName[])
    .map((n) => `| \`${n}\` | \`${ICON_SETS.default[n]}\` | \`${ICON_SETS.outline[n]}\` |`).join("\n");
  return `# Theming the tdmm cards

> Generated by \`npm run docs\` in \`frontend/\`. Do not edit by hand.

## Precedence

1. Per-card \`theme\` override in the card config (applied as inline \`--tdmm-*\` variables on the card).
2. \`--tdmm-*\` variables defined in your Home Assistant theme.
3. Home Assistant's own CSS variables (the defaults below).

Every token defaults to a Home Assistant variable, so cards follow light and dark themes automatically.

## Variables

| Variable | Default | Description |
| --- | --- | --- |
${rows}

## Home Assistant theme example

\`\`\`yaml
my-theme:
  modes:
    light:
${yamlLines.join("\n")}
    dark:
${yamlLines.join("\n")}
\`\`\`

## Per-card \`theme\` keys

\`\`\`yaml
type: custom:tdmm-printer-card
device_id: <device id>
theme:
  accent: "#ff6600"
  radius: 8
  density: compact
\`\`\`

Supported keys (numbers are pixels):

${keys}

## Density

| Density | Gap |
| --- | --- |
${dens}

## Icon sets

| Icon | default | outline |
| --- | --- | --- |
${icons}
`;
}
