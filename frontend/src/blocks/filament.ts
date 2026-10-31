// Shared helpers for filament blocks (ams, ext). Not a registered block.
const HEX = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;
const BLANK = new Set(["", "unknown", "unavailable", "none", "empty"]);

export const isBlank = (v?: string): boolean => v === undefined || BLANK.has(v.trim().toLowerCase());

/** Parsed `#RRGGBB` (alpha dropped), or undefined when unparseable / fully transparent. */
export function parseColor(v?: string): string | undefined {
  const m = v ? HEX.exec(v.trim()) : null;
  if (!m || m[2]?.toLowerCase() === "00") return undefined;
  return `#${m[1]!.toUpperCase()}`;
}

export const isEmptyColor = (v?: string): boolean => isBlank(v) || (HEX.test(v!.trim()) && parseColor(v) === undefined);

/** Inline style for a swatch: parsed colour, grey fallback for unparseable, chip bg for empty. */
export function colorStyle(v?: string): string {
  if (isBlank(v)) return "background:var(--_tdmm-chip-bg)";
  const c = parseColor(v);
  return c ? `background:${c}` : isEmptyColor(v) ? "background:var(--_tdmm-chip-bg)" : "background:var(--_tdmm-text-secondary)";
}
