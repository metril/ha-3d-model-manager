import type { CSSResult } from "lit";
import type { BlockDef, BlockType } from "./types.ts";

const blocks = new Map<BlockType, BlockDef>();

export function registerBlock(def: BlockDef): void {
  blocks.set(def.type, def);
}

export function getBlock(type: BlockType): BlockDef {
  const def = blocks.get(type);
  if (!def) throw new Error(`tdmm: block "${type}" is not registered`);
  return def;
}

export function allBlocks(): BlockDef[] {
  return [...blocks.values()];
}

export function blockStyles(): CSSResult[] {
  return allBlocks().flatMap((b) => (b.styles ? [b.styles] : []));
}
