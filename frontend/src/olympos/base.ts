import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { TdmmBaseCard } from "../base/tdmm-base-card.ts";
import type { BlockEntry } from "../config.ts";
import type { EntityKey } from "../entities.ts";
import { ICON_SETS, tokenCss } from "../theme/tokens.ts";
import { OLYMPOS_TOKENS, presetVars } from "../theme/olympos.ts";
import type { OlymposCtx } from "./contracts.ts";
import { printerPhase } from "./logic/gating.ts";

/**
 * Base for Olympos cards. Subclasses provide `entityKeys()` and `renderCard(ctx)`.
 * Palette is applied as the preset layer of the token chain (card theme > user --tdmm-* > preset > HA).
 */
export abstract class TdmmOlymposBase extends TdmmBaseCard {
  /** Entity keys the card reads; used for hass diffing. */
  protected abstract entityKeys(): readonly EntityKey[];
  protected abstract renderCard(ctx: OlymposCtx): TemplateResult;
  /** Set true for cards that read AMS tray/unit entities. */
  protected usesAms = false;

  static get styles(): CSSResultGroup {
    return [
      ...(super.styles as CSSResultGroup[]),
      css`
        :host { color-scheme: dark; }
        ha-card { padding: 0; overflow: hidden; background: var(--_tdmm-surface-2); }
      `,
    ];
  }

  protected visibleBlocks(): BlockEntry[] {
    return [];
  }

  protected computeUsedIds(): string[] {
    const ids: string[] = [];
    for (const k of this.entityKeys()) {
      const id = this.resolved.byKey[k];
      if (id) ids.push(id);
    }
    if (this.usesAms) {
      for (const u of this.resolved.ams) {
        if (u.humidity) ids.push(u.humidity);
        if (u.temperature) ids.push(u.temperature);
        for (const s of u.slots) for (const id of [s.material, s.color, s.remaining]) if (id) ids.push(id);
      }
    }
    return ids;
  }

  getCardSize(): number {
    return 4;
  }

  protected buildCtx(): OlymposCtx {
    const config = this.config!;
    const hass = this.hass;
    const resolved = this.resolved;
    const state = (key: EntityKey) => {
      const id = resolved.byKey[key];
      return id ? hass.states[id] : undefined;
    };
    return {
      hass, config, resolved,
      phase: printerPhase({ print_state: state("print_state")?.state, online: state("online")?.state }),
      palette: presetVars(config.theme.palette),
      v: (t) => `var(--_tdmm-${t})`,
      state,
      press: (key) => {
        const id = resolved.byKey[key];
        return id ? hass.callService("button", "press", { entity_id: id }) : Promise.resolve();
      },
      callService: (d, s, data) => hass.callService(d, s, data),
      icon: (name) => ICON_SETS[config.theme.icon_set ?? "default"][name],
      now: Date.now(),
    };
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.config || !this.hass) return nothing;
    if (!this.config.device_id) return this.renderPlaceholder();
    if (!this.resolved.deviceFound) return html`<ha-card>${this.renderNotFound()}</ha-card>`;
    const preset = presetVars(this.config.theme.palette);
    const vars = Object.fromEntries(OLYMPOS_TOKENS.map((t) => [t, preset[t]]));
    return html`<style>${tokenCss(vars)}</style>${this.renderCard(this.buildCtx())}`;
  }
}
