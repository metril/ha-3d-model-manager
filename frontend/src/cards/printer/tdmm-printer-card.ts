import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { TdmmBaseCard } from "../../base/tdmm-base-card.ts";
import { type BlockEntry, type TabId, type TdmmCardConfig } from "../../config.ts";
import { stubConfigFor } from "../../entities.ts";
import type { HomeAssistant } from "../../ha-types.ts";
import type { BlockContext } from "../../blocks/types.ts";

const TABS: readonly { id: TabId; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "control", label: "Control" },
  { id: "filament", label: "Filament" },
];

export class TdmmPrinterCard extends TdmmBaseCard {
  static properties = { activeTab: { state: true } };
  declare activeTab: TabId;

  static get styles(): CSSResultGroup {
    return [
      super.styles,
      css`
        .tdmm-tabs { display: flex; gap: calc(var(--_tdmm-gap) / 2); margin-bottom: var(--_tdmm-gap); }
        .tdmm-tab {
          flex: 1; cursor: pointer; border: none; border-radius: var(--_tdmm-radius);
          padding: calc(var(--_tdmm-gap) / 2) var(--_tdmm-gap);
          background: var(--_tdmm-chip-bg); color: var(--_tdmm-text-secondary);
          font-family: inherit; font-size: inherit;
        }
        .tdmm-tab.active { background: var(--_tdmm-accent); color: var(--_tdmm-bg); }
      `,
    ];
  }

  constructor() {
    super();
    this.activeTab = "status";
  }

  private shownTabs(): TabId[] {
    const hide = this.config?.hide_tabs ?? [];
    const shown = TABS.map((t) => t.id).filter((t) => !hide.includes(t));
    return shown.length ? shown : ["status"];
  }

  setConfig(raw: unknown): void {
    super.setConfig(raw);
    const shown = this.shownTabs();
    const want = this.config!.default_tab;
    this.activeTab = shown.includes(want) ? want : (shown[0] ?? "status");
    this.refresh();
  }

  protected visibleBlocks(): BlockEntry[] {
    if (!this.config) return [];
    return this.config.tabs[this.activeTab].filter((b) => !b.hidden);
  }

  protected buildBlockContext(): BlockContext {
    return { ...super.buildBlockContext(), tab: this.activeTab };
  }

  private selectTab(id: TabId): void {
    if (id === this.activeTab) return;
    this.activeTab = id;
    this.refresh();
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.config || !this.hass) return nothing;
    if (!this.config.device_id) return this.renderPlaceholder();
    if (!this.resolved.deviceFound) return html`<ha-card>${this.renderNotFound()}</ha-card>`;
    const shown = this.shownTabs();
    return html`<ha-card>
      ${shown.length > 1
        ? html`<div class="tdmm-tabs" role="tablist">${TABS.filter((t) => shown.includes(t.id)).map((t) => html`
            <button class="tdmm-tab ${t.id === this.activeTab ? "active" : ""}" role="tab" data-tab=${t.id}
              aria-selected=${t.id === this.activeTab} @click=${() => this.selectTab(t.id)}>${t.label}</button>`)}</div>`
        : nothing}
      <div class="tdmm-blocks">${this.renderBlocks(this.visibleBlocks())}</div>
    </ha-card>`;
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("tdmm-card-editor");
  }

  static getStubConfig(hass: HomeAssistant): TdmmCardConfig {
    return stubConfigFor("printer", hass);
  }
}
