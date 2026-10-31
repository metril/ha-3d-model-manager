import "../blocks/index.ts";
import { LitElement, css, html, nothing, unsafeCSS, type CSSResultGroup, type TemplateResult } from "lit";
import { normalizeConfig, type BlockEntry, type NormalizedConfig } from "../config.ts";
import { resolveEntities, type EntityKey, type ResolvedEntities } from "../entities.ts";
import type { HomeAssistant } from "../ha-types.ts";
import { ICON_SETS, themeStyleVars, tokenCss } from "../theme/tokens.ts";
import { blockStyles, getBlock } from "../blocks/registry.ts";
import type { BlockContext, IconName } from "../blocks/types.ts";
import { hassChanged } from "./diff.ts";

export type BlockConfig = BlockEntry;

const EMPTY: ResolvedEntities = { deviceFound: false, byKey: {}, ams: [] };

export abstract class TdmmBaseCard extends LitElement {
  protected config?: NormalizedConfig;
  protected resolved: ResolvedEntities = EMPTY;
  protected usedIds: string[] = [];
  private _hass?: HomeAssistant;
  private _themeProps: string[] = [];

  static get styles(): CSSResultGroup {
    return [
      unsafeCSS(tokenCss()),
      css`
        :host { display: block; }
        ha-card {
          background: var(--_tdmm-bg);
          border-radius: var(--_tdmm-radius);
          color: var(--_tdmm-text);
          font-family: var(--_tdmm-font-family);
          font-size: var(--_tdmm-font-size);
          padding: var(--_tdmm-gap);
          box-sizing: border-box;
        }
        .tdmm-blocks { display: flex; flex-direction: column; gap: var(--_tdmm-gap); }
      `,
      ...blockStyles(),
    ];
  }

  setConfig(raw: unknown): void {
    this.config = normalizeConfig(raw);
    this.refresh();
    this.applyTheme();
    this.requestUpdate();
  }

  set hass(h: HomeAssistant) {
    const old = this._hass;
    this._hass = h;
    if (!old || old.entities !== h.entities || old.devices !== h.devices) this.refresh();
    if (hassChanged(old, h, this.usedIds)) this.requestUpdate();
  }
  get hass(): HomeAssistant {
    return this._hass as HomeAssistant;
  }

  protected refresh(): void {
    this.resolved = this._hass && this.config ? resolveEntities(this._hass, this.config.device_id) : EMPTY;
    this.usedIds = this.config ? this.computeUsedIds().filter(Boolean) : [];
  }

  protected abstract visibleBlocks(): BlockEntry[];

  protected computeUsedIds(): string[] {
    const ids = new Set<string>();
    for (const b of this.visibleBlocks()) {
      try {
        for (const id of getBlock(b.type).uses(this.resolved)) ids.add(id);
      } catch { /* unregistered block */ }
    }
    return [...ids];
  }

  getCardSize(): number {
    let n = 0;
    for (const b of this.config ? this.visibleBlocks() : []) {
      if (b.hidden) continue;
      try { n += getBlock(b.type).size; } catch { /* unregistered block */ }
    }
    return Math.max(1, n);
  }

  getGridOptions(): { columns: number; rows?: number | "auto"; min_columns: number; min_rows?: number } {
    return { columns: 12, rows: "auto", min_columns: 6 };
  }

  protected applyTheme(): void {
    for (const p of this._themeProps) this.style.removeProperty(p);
    const vars = themeStyleVars(this.config?.theme);
    this._themeProps = Object.keys(vars);
    for (const [k, v] of Object.entries(vars)) this.style.setProperty(k, v);
  }

  protected buildBlockContext(): BlockContext {
    const config = this.config as NormalizedConfig;
    const hass = this.hass;
    const resolved = this.resolved;
    return {
      hass, resolved, config,
      icon: (name: IconName) => ICON_SETS[config.theme.icon_set ?? "default"][name],
      state: (key: EntityKey) => {
        const id = resolved.byKey[key];
        return id ? hass.states[id] : undefined;
      },
      call: (d, s, data) => hass.callService(d, s, data),
      tab: undefined,
    };
  }

  protected renderBlocks(blocks: BlockConfig[]): TemplateResult {
    const ctx = this.buildBlockContext();
    const out: TemplateResult[] = [];
    for (const b of blocks) {
      if (b.hidden) continue;
      let r;
      try { r = getBlock(b.type).render(ctx); } catch (e) {
        console.warn(`tdmm: skipping block "${b.type}"`, e);
        continue;
      }
      if (r !== nothing) out.push(r);
    }
    return html`${out}`;
  }

  protected renderNotFound(): TemplateResult {
    return html`<ha-alert alert-type="warning">Printer not found</ha-alert>`;
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.config || !this._hass) return nothing;
    if (!this.resolved.deviceFound) return html`<ha-card>${this.renderNotFound()}</ha-card>`;
    return html`<ha-card><div class="tdmm-blocks">${this.renderBlocks(this.visibleBlocks())}</div></ha-card>`;
  }
}
