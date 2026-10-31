export type TokenName =
  | "accent" | "progress" | "text" | "text-secondary" | "bg" | "chip-bg"
  | "radius" | "gap" | "font-family" | "font-size" | "icon-size";

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
  { name: "chip-bg", fallback: "var(--secondary-background-color)", description: "Background of chips, tiles and bars.", kind: "color" },
  { name: "radius", fallback: "var(--ha-card-border-radius, 12px)", description: "Corner radius.", kind: "length" },
  { name: "gap", fallback: "8px", description: "Spacing between blocks and items.", kind: "length" },
  { name: "font-family", fallback: "var(--ha-font-family-body, inherit)", description: "Font family.", kind: "font" },
  { name: "font-size", fallback: "var(--ha-font-size-m, 14px)", description: "Base font size.", kind: "length" },
  { name: "icon-size", fallback: "24px", description: "Icon size.", kind: "length" },
];

export function tokenCss(): string {
  return `:host{${TOKENS.map((t) => `--_tdmm-${t.name}: var(--tdmm-${t.name}, ${t.fallback});`).join("")}}`;
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
  chip_bg?: string;
  radius?: number;
  font_family?: string;
  font_size?: number;
  icon_size?: number;
  density?: Density;
  icon_set?: IconSet;
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
    "accent", "progress", "text", "text_secondary", "bg", "chip_bg", "radius", "font_family",
    "font_size", "icon_size", "density", "icon_set",
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
