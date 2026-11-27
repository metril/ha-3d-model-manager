import { css, html, type CSSResultGroup, type PropertyValues, type TemplateResult } from "lit";
import type { TdmmCardConfig } from "../../config.ts";
import { stubConfigFor } from "../../entities.ts";
import type { EntityKey } from "../../entities.ts";
import type { HomeAssistant } from "../../ha-types.ts";
import { TdmmOlymposBase } from "../base.ts";
import type { ChartRange, ChartsAction, ChartsState, HoldState, OlymposCtx, SpoolSel } from "../contracts.ts";
import { PRINTER_KEYS } from "../keys.ts";
import { fmtPausedFor } from "../logic/format.ts";
import { isActive } from "../logic/gating.ts";
import { buildHistoryMsg, isFresh, parseHistory, type HistoryResponse } from "../logic/history.ts";
import { ARM_MS, IDLE, step, type HoldEvent } from "../logic/hold.ts";
import { pausedSeconds } from "../logic/paused.ts";
import { controlStyles } from "../ui/control-bar.ts";
import { headerStyles } from "../ui/header.ts";
import { heroStyles } from "../ui/hero.ts";
import { spoolStyles } from "../ui/spools.ts";
import { tilesStyles } from "../ui/tiles.ts";
import { viewStyles } from "../ui/views.ts";
import { renderChartsView } from "./charts-view.ts";
import { renderDeviceView } from "./device-view.ts";
import { mainStyles, renderMainView } from "./main-view.ts";

type View = "main" | "charts" | "device";
export const WIDE_PX = 700;

export class TdmmOlymposPrinterCard extends TdmmOlymposBase {
  protected usesAms = true;
  static properties = { view: { state: true }, hold: { state: true }, charts: { state: true }, selected: { state: true }, wide: { state: true }, _t: { state: true } };
  private view: View = "main";
  private hold: HoldState = IDLE;
  private charts: ChartsState = { range: "1h", loading: false };
  private selected: SpoolSel | undefined;
  private wide = false;
  private _t = 0;
  private ro?: ResizeObserver;
  private pausedTimer?: ReturnType<typeof setInterval>;
  private holdTimer?: ReturnType<typeof setInterval>;
  private armTimer?: ReturnType<typeof setTimeout>;
  private fetchedAt = new Map<ChartRange, number>();
  private fetchSeq = 0;

  protected entityKeys(): readonly EntityKey[] { return PRINTER_KEYS; }

  static get styles(): CSSResultGroup {
    return [
      ...(super.styles as CSSResultGroup[]),
      headerStyles, heroStyles, tilesStyles, controlStyles, mainStyles, spoolStyles, viewStyles,
      css`:host { container-type: normal; } ha-card { background: var(--_tdmm-surface-1); }`,
    ];
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.requestUpdate(); // restart paused ticker (willUpdate) after reconnect
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver((es) => { const w = es[0]?.contentRect.width ?? this.clientWidth; this.wide = w >= WIDE_PX; });
      this.ro.observe(this);
    }
    this.addEventListener("tdmm-back", this.onBack);
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
    this.removeEventListener("tdmm-back", this.onBack);
    this.stopPausedTick();
    this.stopHold();
    this.leaveCharts();
    this.view = "main";
  }

  private onBack = (): void => { this.setView("main"); };

  private setView(v: View): void {
    if (v !== "charts") this.leaveCharts();
    this.view = v;
    if (v === "charts") void this.loadCharts(this.charts.range);
  }
  private leaveCharts(): void {
    this.fetchedAt.clear();
    this.fetchSeq++;
    this.charts = { range: this.charts.range, loading: false };
  }

  private async loadCharts(range: ChartRange): Promise<void> {
    const hass = this.hass as HomeAssistant & { callWS?: (m: unknown) => Promise<HistoryResponse> };
    const now = Date.now();
    if (isFresh(this.fetchedAt.get(range), now) && this.charts.data && this.charts.range === range) return;
    const by = this.resolved.byKey;
    const ids = { nozzle: by.nozzle_temperature, bed: by.bed_temperature, nozzleTarget: by.nozzle_target_temperature, bedTarget: by.bed_target_temperature, progress: by.progress };
    const list = Object.values(ids).filter((x): x is string => !!x);
    const seq = ++this.fetchSeq;
    this.charts = { range, loading: true };
    try {
      if (!hass.callWS || !list.length) throw new Error("unavailable");
      const msg = buildHistoryMsg(list, range, now);
      const resp = await hass.callWS(msg);
      if (seq !== this.fetchSeq) return;
      this.fetchedAt.set(range, now);
      this.charts = { range, loading: false, data: parseHistory(resp, ids, Date.parse(msg.start_time), now) };
    } catch (e) {
      if (seq !== this.fetchSeq) return;
      this.charts = { range, loading: false, error: e instanceof Error ? e.message : "Failed to load history" };
    }
  }
  private dispatchCharts = (a: ChartsAction): void => {
    if (a.type === "range") void this.loadCharts(a.range);
    else { this.fetchedAt.clear(); void this.loadCharts(this.charts.range); }
  };

  // paused duration: 1s tick only while paused
  private startPausedTick(): void { if (!this.pausedTimer) this.pausedTimer = setInterval(() => { this._t++; }, 1000); }
  private stopPausedTick(): void { clearInterval(this.pausedTimer); this.pausedTimer = undefined; }

  // hold-to-stop
  private send(ev: HoldEvent): void {
    const prev = this.hold;
    this.hold = step(prev, ev, Date.now());
    if (this.hold.kind === "holding" && this.holdTimer === undefined) this.holdTimer = setInterval(this.frame, 40);
    if (this.hold.kind === "armed" && prev.kind !== "armed") this.armTimer = setTimeout(() => this.send("timeout"), ARM_MS);
    if (this.hold.kind !== "armed") { clearTimeout(this.armTimer); this.armTimer = undefined; }
  }
  private frame = (): void => {
    if (this.hold.kind === "holding") { this.send("tick"); this.requestUpdate(); } // fill is derived from ctx.now each render
    if (this.hold.kind !== "holding") { clearInterval(this.holdTimer); this.holdTimer = undefined; }
  };
  private stopHold(): void {
    clearInterval(this.holdTimer);
    this.holdTimer = undefined;
    clearTimeout(this.armTimer);
    this.armTimer = undefined;
    this.hold = IDLE;
  }
  private onConfirm = (): void => {
    if (this.hold.kind !== "armed") return;
    this.send("confirm");
    void this.buildCtx().press("stop");
  };

  protected willUpdate(c: PropertyValues): void {
    super.willUpdate(c);
    if (!this.config || !this.hass) return;
    const phase = this.buildCtx().phase;
    if (phase === "paused") this.startPausedTick(); else this.stopPausedTick();
    if (!isActive(phase) && this.hold.kind !== "idle") this.stopHold();
  }

  private wasArmed = false;
  protected updated(): void {
    super.updated();
    const armed = this.hold.kind === "armed";
    if (armed && !this.wasArmed) this.renderRoot.querySelector<HTMLElement>(".o-ctl-row.two .o-btn")?.focus();
    this.wasArmed = armed;
  }

  protected renderCard(ctx: OlymposCtx): TemplateResult {
    let body: TemplateResult;
    if (this.view === "charts") body = renderChartsView(ctx, this.charts, this.dispatchCharts);
    else if (this.view === "device") body = renderDeviceView(ctx);
    else {
      const paused = ctx.phase === "paused" ? fmtPausedFor(pausedSeconds(ctx.state("print_state"), ctx.now)) : "";
      body = renderMainView(ctx, {
        wide: this.wide, pausedFor: paused, hold: this.hold, selected: this.selected,
        onView: (v) => this.setView(v), onPick: (s) => { this.selected = s; },
        onPause: () => { void ctx.press("pause"); }, onResume: () => { void ctx.press("resume"); },
        onHoldDown: () => this.send("down"), onHoldUp: () => this.send("up"),
        onCancel: () => this.send("cancel"), onConfirm: this.onConfirm,
      });
    }
    return html`<ha-card>${body}</ha-card>`;
  }

  getCardSize(): number { return this.wide ? 6 : 10; }
  static getConfigElement(): HTMLElement { return document.createElement("tdmm-card-editor"); }
  static getStubConfig(hass: HomeAssistant): TdmmCardConfig { return stubConfigFor("olympos-printer", hass); }
}
