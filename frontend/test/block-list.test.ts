import { describe, expect, it } from "vitest";
import { moveBlock, toggleHidden } from "../src/editor/block-ops.ts";
import { TdmmBlockList } from "../src/editor/tdmm-block-list.ts";
import type { BlockEntry } from "../src/config.ts";

const L: BlockEntry[] = [{ type: "header" }, { type: "progress" }, { type: "job" }];
if (!customElements.get("tdmm-block-list")) customElements.define("tdmm-block-list", TdmmBlockList);

async function mount(blocks: BlockEntry[]) {
  const el = document.createElement("tdmm-block-list") as TdmmBlockList;
  el.blocks = blocks;
  document.body.append(el);
  await el.updateComplete;
  const got: BlockEntry[][] = [];
  el.addEventListener("blocks-changed", (e) => got.push((e as CustomEvent).detail.blocks));
  return { el, got };
}
const types = (l: BlockEntry[]) => l.map((b) => b.type);

describe("block-ops", () => {
  it("moveBlock moves 0→2", () => {
    expect(types(moveBlock(L, 0, 2))).toEqual(["progress", "job", "header"]);
    expect(types(L)).toEqual(["header", "progress", "job"]);
  });
  it("moveBlock clamps out of range", () => {
    expect(types(moveBlock(L, 0, 99))).toEqual(["progress", "job", "header"]);
    expect(types(moveBlock(L, 2, -5))).toEqual(["job", "header", "progress"]);
    expect(types(moveBlock(L, 9, 0))).toEqual(["header", "progress", "job"]);
  });
  it("toggleHidden toggles and removes key", () => {
    const a = toggleHidden(L, 1);
    expect(a[1]).toEqual({ type: "progress", hidden: true });
    const b = toggleHidden(a, 1);
    expect("hidden" in b[1]!).toBe(false);
  });
});

describe("tdmm-block-list", () => {
  it("up button emits reordered list", async () => {
    const { el, got } = await mount(L);
    const rows = el.shadowRoot!.querySelectorAll(".row");
    (rows[1]!.querySelector(".up") as HTMLElement).click();
    expect(types(got[0]!)).toEqual(["progress", "header", "job"]);
    expect(rows[0]!.querySelector(".up")!.hasAttribute("disabled")).toBe(true);
    expect(rows[2]!.querySelector(".down")!.hasAttribute("disabled")).toBe(true);
  });
  it("eye toggle emits hidden", async () => {
    const { el, got } = await mount(L);
    (el.shadowRoot!.querySelectorAll(".row")[2]!.querySelector(".eye") as HTMLElement).click();
    expect(got[0]![2]).toEqual({ type: "job", hidden: true });
  });
  it("native drop reorders", async () => {
    const { el, got } = await mount(L);
    const rows = el.shadowRoot!.querySelectorAll(".row");
    const store: Record<string, string> = {};
    const dataTransfer = { setData: (k: string, v: string) => { store[k] = v; }, getData: (k: string) => store[k] ?? "", effectAllowed: "" };
    const ev = (t: string) => { const e = new Event(t, { bubbles: true, cancelable: true }); Object.defineProperty(e, "dataTransfer", { value: dataTransfer }); return e; };
    rows[0]!.querySelector(".handle")!.dispatchEvent(ev("dragstart"));
    rows[2]!.dispatchEvent(ev("dragover"));
    rows[2]!.dispatchEvent(ev("drop"));
    expect(types(got[0]!)).toEqual(["progress", "job", "header"]);
  });
  // MUST stay last in this file: it defines ha-sortable globally, which switches every later render to the sortable path.
  it("uses ha-sortable when defined", async () => {
    customElements.define("ha-sortable", class extends HTMLElement {});
    const { el, got } = await mount(L);
    const s = el.shadowRoot!.querySelector("ha-sortable")!;
    expect(s).toBeTruthy();
    s.dispatchEvent(new CustomEvent("item-moved", { detail: { oldIndex: 2, newIndex: 0 } }));
    expect(types(got[0]!)).toEqual(["job", "header", "progress"]);
  });
});
