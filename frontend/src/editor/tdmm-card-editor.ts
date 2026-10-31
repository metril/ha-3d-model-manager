import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import {
  CARD_DEFAULTS, normalizeConfig, serializeConfig,
  type BlockEntry, type NormalizedConfig, type TabId, type TdmmCardConfig,
} from "../config.ts";
import type { HomeAssistant } from "../ha-types.ts";
import type { ThemeConfig } from "../theme/tokens.ts";
import { ensureHaElements } from "./load-ha.ts";
import { editorSchema } from "./schema.ts";
import "./tdmm-block-list.ts";

const TABS: TabId[] = ["status", "control", "filament"];
const COLOR_KEYS = ["accent", "progress", "text", "text_secondary", "bg", "chip_bg"] as const;
const LABELS: Record<string, string> = {
  device_id: "Printer", default_tab: "Default tab", hide_tabs: "Hidden tabs", camera_view: "Camera view",
  theme: "Appearance", accent: "Accent color", progress: "Progress color", text: "Text color",
  text_secondary: "Secondary text color", bg: "Background color", chip_bg: "Chip background",
  radius: "Corner radius", font_size: "Font size", icon_size: "Icon size", font_family: "Font family",
  density: "Density", icon_set: "Icon set",
};

function validColor(v: unknown): boolean {
  if (typeof v !== "string") return false;
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return true;
  return CSS.supports("color", v);
}

function cleanTheme(raw: unknown): ThemeConfig {
  const t: Record<string, unknown> = {};
  if (typeof raw === "object" && raw !== null) {
    for (const [k, v] of Object.entries(raw)) {
      if (v === undefined || v === null || v === "" || (typeof v === "number" && Number.isNaN(v))) continue;
      if ((COLOR_KEYS as readonly string[]).includes(k) && !validColor(v)) continue;
      t[k] = v;
    }
  }
  return t as ThemeConfig;
}

export class TdmmCardEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    _cfg: { state: true },
    _tab: { state: true },
    _unavailable: { state: true },
  };
  declare hass?: HomeAssistant;
  declare _cfg?: NormalizedConfig;
  declare _tab: TabId;
  declare _unavailable: boolean;

  constructor() {
    super();
    this._tab = "status";
    this._unavailable = false;
  }

  static styles = css`
    :host { display: block; }
    .tabs { display: flex; gap: 4px; margin: 12px 0 8px; }
    button.tab {
      flex: 1; padding: 8px; cursor: pointer; font: inherit;
      border: 1px solid var(--divider-color); border-radius: 8px;
      background: var(--card-background-color); color: var(--primary-text-color);
    }
    button.tab.active { background: var(--primary-color); color: var(--text-primary-color); border-color: var(--primary-color); }
    .warn { color: var(--error-color); padding: 8px 0; }
  `;

  setConfig(cfg: TdmmCardConfig): void {
    this._cfg = normalizeConfig(cfg);
  }

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await ensureHaElements();
    this._unavailable = !customElements.get("ha-form");
  }

  private fire(): void {
    if (!this._cfg) return;
    const config = serializeConfig(this._cfg);
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  private onForm(e: CustomEvent<{ value: Record<string, unknown> }>): void {
    e.stopPropagation();
    const c = this._cfg;
    if (!c) return;
    const v = e.detail.value;
    const next: NormalizedConfig = { ...c, theme: cleanTheme(v.theme) };
    if (typeof v.device_id === "string") next.device_id = v.device_id;
    if (c.kind === "printer") {
      if (TABS.includes(v.default_tab as TabId)) next.default_tab = v.default_tab as TabId;
      if (Array.isArray(v.hide_tabs)) next.hide_tabs = v.hide_tabs.filter((t): t is TabId => TABS.includes(t as TabId));
    }
    if (c.kind === "camera") next.camera_view = v.camera_view === "live" ? "live" : "auto";
    this._cfg = next;
    this.fire();
  }

  private onBlocks(e: CustomEvent<{ blocks: BlockEntry[] }>): void {
    e.stopPropagation();
    const c = this._cfg;
    if (!c) return;
    this._cfg = c.kind === "printer"
      ? { ...c, tabs: { ...c.tabs, [this._tab]: e.detail.blocks } }
      : { ...c, blocks: e.detail.blocks };
    this.fire();
  }

  protected render(): TemplateResult | typeof nothing {
    const c = this._cfg;
    if (!c) return nothing;
    if (this._unavailable) return html`<div class="warn">Visual editor unavailable, use YAML</div>`;
    const data = {
      device_id: c.device_id,
      default_tab: c.default_tab,
      hide_tabs: c.hide_tabs,
      camera_view: c.camera_view,
      theme: { density: CARD_DEFAULTS.theme_keys.density, icon_set: CARD_DEFAULTS.theme_keys.icon_set, ...c.theme },
    };
    const printer = c.kind === "printer";
    return html`
      <ha-form .hass=${this.hass} .data=${data} .schema=${editorSchema(c.kind)}
        .computeLabel=${(s: { name: string }) => LABELS[s.name] ?? s.name}
        @value-changed=${(e: CustomEvent<{ value: Record<string, unknown> }>) => this.onForm(e)}></ha-form>
      ${printer ? html`<div class="tabs">${TABS.map((t) => html`
        <button class="tab ${t === this._tab ? "active" : ""}" @click=${() => { this._tab = t; }}>${t[0]!.toUpperCase() + t.slice(1)}</button>`)}</div>` : nothing}
      <tdmm-block-list .hass=${this.hass} .blocks=${printer ? c.tabs[this._tab] : c.blocks}
        @blocks-changed=${(e: CustomEvent<{ blocks: BlockEntry[] }>) => this.onBlocks(e)}></tdmm-block-list>`;
  }
}
