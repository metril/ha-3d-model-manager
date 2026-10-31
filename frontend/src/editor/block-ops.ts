import type { BlockEntry } from "../config.ts";

export function moveBlock(list: readonly BlockEntry[], from: number, to: number): BlockEntry[] {
  const out = list.slice();
  if (from < 0 || from >= out.length) return out;
  const t = Math.max(0, Math.min(out.length - 1, to));
  const [item] = out.splice(from, 1);
  out.splice(t, 0, item!);
  return out;
}

export function toggleHidden(list: readonly BlockEntry[], index: number): BlockEntry[] {
  return list.map((b, i) => {
    if (i !== index) return b;
    if (b.hidden) {
      const { hidden: _h, ...rest } = b;
      return rest;
    }
    return { ...b, hidden: true };
  });
}
