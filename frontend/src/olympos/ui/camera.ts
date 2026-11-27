import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { defineOnce } from "../../register.ts";
import type { HassEntity, HomeAssistant } from "../../ha-types.ts";
import type { OlymposCtx } from "../contracts.ts";
import { frameAge } from "../logic/camera-age.ts";
import { cameraMode, type CameraMode } from "../logic/gating.ts";

export const START_CAP_MS = 10_000;
const AGE_TICK_MS = 5_000;

export interface CameraChip { label: string; tone: "live" | "warn" | "stall" | "muted"; }

/** Pure chip decision for the camera overlay. */
export function cameraChip(mode: CameraMode, starting: boolean, ts: unknown, now: number): CameraChip {
  if (mode === "last") return { label: "Last frame", tone: "muted" };
  if (starting) return { label: "Camera starting…", tone: "muted" };
  const a = frameAge(ts, now);
  if (a.kind === "lag") return { label: `${a.sec} s old`, tone: "warn" };
  if (a.kind === "stall") return { label: `Stalled · ${a.min} min`, tone: "stall" };
  return { label: "Live", tone: "live" };
}

/** Camera panel: live stream only while in viewport and tab visible; tap to enlarge. */
export class TdmmOlymposCamera extends LitElement {
  static properties = {
    hass: { attribute: false }, entity: { attribute: false }, mode: {}, lightOff: { type: Boolean }, ready: { state: true },
    inView: { state: true }, docVisible: { state: true }, enlarged: { state: true }, _tick: { state: true },
  };
  hass?: HomeAssistant;
  entity?: HassEntity;
  mode: CameraMode = "live";
  lightOff = false;
  private ready = false;
  private inView = true;
  private docVisible = true;
  private enlarged = false;
  private _tick = 0;
  private io?: IntersectionObserver;
  private capTimer?: ReturnType<typeof setTimeout>;
  private ageTimer?: ReturnType<typeof setInterval>;

  connectedCallback(): void {
    super.connectedCallback();
    this.docVisible = document.visibilityState !== "hidden";
    document.addEventListener("visibilitychange", this.onVis);
    if (typeof IntersectionObserver !== "undefined") {
      this.io = new IntersectionObserver((es) => { this.inView = es.some((e) => e.isIntersecting); });
      this.io.observe(this);
    }
    this.ageTimer = setInterval(() => { this._tick++; }, AGE_TICK_MS);
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("visibilitychange", this.onVis);
    window.removeEventListener("keydown", this.onKey);
    this.io?.disconnect();
    clearTimeout(this.capTimer);
    clearInterval(this.ageTimer);
  }
  private onVis = (): void => { this.docVisible = document.visibilityState !== "hidden"; };
  private onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") this.close(); };

  private get streaming(): boolean { return this.mode === "live" && this.inView && this.docVisible; }

  protected willUpdate(c: PropertyValues): void {
    if (c.has("inView") || c.has("docVisible") || c.has("mode")) {
      // (re)start the "Camera starting…" window whenever the stream (re)mounts
      if (this.streaming) { if (!this.capTimer) this.armCap(); } else { this.ready = false; clearTimeout(this.capTimer); this.capTimer = undefined; }
    }
  }
  private armCap(): void {
    this.ready = false;
    this.capTimer = setTimeout(() => { this.ready = true; this.capTimer = undefined; }, START_CAP_MS);
  }
  private onReady = (): void => { this.ready = true; clearTimeout(this.capTimer); this.capTimer = undefined; };
  private open = (): void => { this.enlarged = true; window.addEventListener("keydown", this.onKey); void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(".close")?.focus()); };
  private close = (): void => { this.enlarged = false; window.removeEventListener("keydown", this.onKey); };

  private media(): TemplateResult | typeof nothing {
    const e = this.entity;
    if (!e) return nothing;
    if (this.mode === "live" && this.streaming) {
      return html`<ha-camera-stream .hass=${this.hass} .stateObj=${e} muted playsinline @load=${this.onReady} @playing=${this.onReady} @loadeddata=${this.onReady}></ha-camera-stream>`;
    }
    const pic = e.attributes.entity_picture;
    if (this.mode === "last" && typeof pic === "string" && pic) return html`<img src=${pic} alt="Last camera frame" @load=${this.onReady} />`;
    return nothing;
  }

  private panel(big: boolean): TemplateResult {
    const starting = this.mode === "live" && this.streaming && !this.ready;
    const chip = cameraChip(this.mode, starting, this.entity?.attributes.frame_timestamp, Date.now());
    const media = this.media();
    return html`<div class="frame ${big ? "big" : ""}">
      <div class="media">${media === nothing ? html`<div class="ph"><ha-icon icon="mdi:camera-outline"></ha-icon></div>` : media}</div>
      <span class="chip ${chip.tone}">${chip.tone === "live" ? html`<i class="dot"></i>` : nothing}${chip.label}</span>
      ${this.lightOff && this.mode === "live" ? html`<span class="hint">Light is off</span>` : nothing}
    </div>`;
  }

  protected render(): TemplateResult {
    void this._tick;
    if (this.enlarged) {
      return html`<div class="ph-fill"></div>
        <div class="ov" role="dialog" aria-modal="true" aria-label="Camera" @click=${this.close}>
          <div class="ov-in" @click=${(e: Event) => e.stopPropagation()}>${this.panel(true)}
            <button type="button" class="close" aria-label="Close camera" @click=${this.close}><ha-icon icon="mdi:close"></ha-icon></button></div>
        </div>`;
    }
    return html`<button type="button" class="tap" aria-label="Enlarge camera" @click=${this.open}>${this.panel(false)}</button>`;
  }

  static styles = css`
    :host { display: block; }
    .tap { display: block; width: 100%; margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit; cursor: pointer; border-radius: 20px; }
    .tap:focus-visible, .close:focus-visible { outline: 2px solid var(--_tdmm-accent); outline-offset: 2px; }
    .frame { position: relative; aspect-ratio: 16 / 9; background: var(--_tdmm-deep); border-radius: 20px; overflow: hidden; color: var(--_tdmm-text-secondary); }
    .frame.big { width: 100%; max-height: 100%; }
    .media, .ph { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; --mdc-icon-size: 40px; }
    .media > * { width: 100%; height: 100%; object-fit: contain; }
    .ph { position: static; width: 100%; height: 100%; }
    .chip, .hint { position: absolute; left: 12px; height: 24px; padding: 0 10px; display: inline-flex; align-items: center; gap: 6px; border-radius: 12px; font-size: 11px; font-weight: 600; background: var(--_tdmm-surface-2); color: var(--_tdmm-text); }
    .chip { top: 12px; }
    .chip.muted { color: var(--_tdmm-text-secondary); }
    .chip.warn .dot { background: var(--_tdmm-warn); }
    .chip.stall { background: color-mix(in srgb, var(--_tdmm-warn) 16%, var(--_tdmm-surface-2)); color: var(--_tdmm-warn); }
    .hint { bottom: 12px; font-weight: 500; color: var(--_tdmm-text-secondary); background: color-mix(in srgb, var(--_tdmm-surface-2) 85%, transparent); }
    .dot { width: 6px; height: 6px; border-radius: 3px; background: var(--_tdmm-accent); }
    .ph-fill { aspect-ratio: 16 / 9; }
    .ov { position: fixed; inset: 0; z-index: 100; background: rgba(0, 0, 0, 0.92); display: flex; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box; }
    .ov-in { position: relative; width: 100%; max-width: 1280px; }
    .close { position: absolute; right: 12px; top: 12px; width: 44px; height: 44px; border: 0; border-radius: 22px; background: var(--_tdmm-surface-2); color: var(--_tdmm-text); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
  `;
}

defineOnce("tdmm-olympos-camera", TdmmOlymposCamera);

export function renderCamera(ctx: OlymposCtx): TemplateResult | typeof nothing {
  const mode = cameraMode(ctx.phase, !!ctx.resolved.byKey.camera);
  const entity = ctx.state("camera");
  if (mode === "hidden" || !entity) return nothing;
  return html`<tdmm-olympos-camera .hass=${ctx.hass} .entity=${entity} .mode=${mode} .lightOff=${ctx.state("chamber_light")?.state === "off"}></tdmm-olympos-camera>`;
}
