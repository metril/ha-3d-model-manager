import { LitElement, css, html, type TemplateResult } from "lit";
import type { BlockEntry } from "../config.ts";
import type { HomeAssistant } from "../ha-types.ts";
import { ICON_SETS } from "../theme/tokens.ts";
import { getBlock } from "../blocks/registry.ts";
import "../blocks/index.ts";
import { moveBlock, toggleHidden } from "./block-ops.ts";

export class TdmmBlockList extends LitElement {
  static properties = { blocks: { attribute: false }, hass: { attribute: false } };
  declare blocks: BlockEntry[];
  declare hass?: HomeAssistant;
  private dragFrom = -1;

  constructor() {
    super();
    this.blocks = [];
  }

  static styles = css`
    :host { display: block; }
    .row {
      display: flex; align-items: center; gap: 4px; padding: 4px 8px; margin-bottom: 4px;
      border: 1px solid var(--divider-color); border-radius: 8px;
      background: var(--card-background-color); color: var(--primary-text-color);
    }
    .row.hidden-block { opacity: 0.55; }
    .handle { cursor: grab; display: inline-flex; color: var(--secondary-text-color); }
    .label { flex: 1; margin-left: 4px; }
  `;

  private emit(blocks: BlockEntry[]): void {
    this.dispatchEvent(new CustomEvent("blocks-changed", { detail: { blocks }, bubbles: true, composed: true }));
  }
  private move(from: number, to: number): void { this.emit(moveBlock(this.blocks, from, to)); }

  private onDragStart(i: number, e: DragEvent): void {
    this.dragFrom = i;
    e.dataTransfer?.setData("text/plain", String(i));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }
  private onDrop(i: number, e: DragEvent): void {
    e.preventDefault();
    const raw = e.dataTransfer?.getData("text/plain");
    const from = raw !== undefined && raw !== "" ? Number(raw) : this.dragFrom;
    this.dragFrom = -1;
    if (Number.isInteger(from) && from !== i) this.move(from, i);
  }

  private row(b: BlockEntry, i: number, native: boolean): TemplateResult {
    const def = getBlock(b.type);
    const last = this.blocks.length - 1;
    return html`<div class="row ${b.hidden ? "hidden-block" : ""}"
      draggable=${native ? "true" : "false"}
      @dragstart=${native ? (e: DragEvent) => this.onDragStart(i, e) : null}
      @dragover=${native ? (e: DragEvent) => e.preventDefault() : null}
      @drop=${native ? (e: DragEvent) => this.onDrop(i, e) : null}>
      <span class="handle"><ha-icon .icon=${"mdi:drag"}></ha-icon></span>
      <ha-icon .icon=${ICON_SETS.default[def.icon]}></ha-icon>
      <span class="label">${def.label}</span>
      <ha-icon-button class="up" label="Move up" ?disabled=${i === 0} @click=${() => this.move(i, i - 1)}>
        <ha-icon .icon=${"mdi:arrow-up"}></ha-icon></ha-icon-button>
      <ha-icon-button class="down" label="Move down" ?disabled=${i === last} @click=${() => this.move(i, i + 1)}>
        <ha-icon .icon=${"mdi:arrow-down"}></ha-icon></ha-icon-button>
      <ha-icon-button class="eye" label=${b.hidden ? "Show" : "Hide"} @click=${() => this.emit(toggleHidden(this.blocks, i))}>
        <ha-icon .icon=${b.hidden ? "mdi:eye-off" : "mdi:eye"}></ha-icon></ha-icon-button>
    </div>`;
  }

  protected render(): TemplateResult {
    if (customElements.get("ha-sortable")) {
      return html`<ha-sortable handle-selector=".handle"
        @item-moved=${(e: CustomEvent<{ oldIndex: number; newIndex: number }>) => this.move(e.detail.oldIndex, e.detail.newIndex)}>
        <div>${this.blocks.map((b, i) => this.row(b, i, false))}</div></ha-sortable>`;
    }
    return html`<div>${this.blocks.map((b, i) => this.row(b, i, true))}</div>`;
  }
}
