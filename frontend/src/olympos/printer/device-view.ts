import { html, nothing, type TemplateResult } from "lit";
import type { EntityKey } from "../../entities.ts";
import type { OlymposCtx, RenderDeviceView } from "../contracts.ts";
import { isActive } from "../logic/gating.ts";
import { backHeader } from "../ui/views.ts";

const SPEEDS = ["silent", "standard", "sport", "ludicrous"];
const title = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const valid = (s?: string) => (s && s !== "unknown" && s !== "unavailable" ? s : undefined);

export function speedNote(phase: OlymposCtx["phase"]): string {
  return isActive(phase) ? "Locked while printing — change it before the next job" : phase === "offline" ? "Printer offline" : "Applies to the next print";
}

const tile = (label: string, v: string, big = true) => html`<div class="v-tile"><div class="v-tv ${big ? "big" : ""}">${v}</div><div class="v-tl">${label}</div></div>`;

const section = (name: string, body: TemplateResult) => html`<div class="v-card"><div class="v-t">${name}</div>${body}</div>`;

export const renderDeviceView: RenderDeviceView = (ctx) => {
  const off = ctx.phase === "offline";
  const active = isActive(ctx.phase);
  const sp = ctx.state("speed_profile");
  const spId = ctx.resolved.byKey.speed_profile;
  const opts = Array.isArray(sp?.attributes.options) ? (sp!.attributes.options as string[]) : SPEEDS;
  const cur = valid(sp?.state);
  const selDis = active || off || !sp || sp.entity_id.split(".")[0] !== "select";
  const st = (k: EntityKey) => valid(ctx.state(k)?.state);
  const wifi = st("wifi_signal");
  const door = st("door_open");
  const hms = st("hms_active");
  const dash = "—";
  const status: [string, string][] = [
    ["Wi-Fi", off || !wifi ? dash : `${wifi} dBm`],
    ["Online", off ? "No" : "Yes"],
    ["Door", off || !door ? dash : door === "on" ? "Open" : "Closed"],
    ["HMS", off || !hms ? dash : hms === "on" ? "Active" : "None"],
  ];
  const nt = st("nozzle_type"), nd = st("nozzle_diameter");
  const model = ctx.hass.devices[ctx.config.device_id ?? ""]?.model;
  const hw: [string, string][] = [
    ["Firmware", st("firmware_version") ?? dash],
    ["Nozzle", [nt ? title(nt) : undefined, nd ? `${nd} mm` : undefined].filter(Boolean).join(" · ") || dash],
    ["Model", model ?? dash],
  ];
  const btn = (label: string, icon: string, disabled: boolean, onClick: () => void) =>
    html`<button type="button" class="v-btn" ?disabled=${disabled} @click=${onClick}><ha-icon .icon=${icon}></ha-icon>${label}</button>`;
  const sel = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    if (spId) void ctx.callService("select", "select_option", { entity_id: spId, option: value });
  };
  return html`<div class="v-wrap">
    ${backHeader("Device", model ?? "")}
    ${section("Settings", html`
      <label class="v-selw ${selDis ? "dim" : ""}">
        <ha-icon .icon=${ctx.icon("speed")}></ha-icon>
        <select class="v-sel" aria-label="Print speed" ?disabled=${selDis} @change=${sel}>
          ${opts.map((o) => html`<option value=${o} ?selected=${o === cur}>Speed · ${title(o)}</option>`)}
        </select></label>
      <div class="v-note">${active ? html`<ha-icon icon="mdi:lock"></ha-icon>` : nothing}<span>${speedNote(ctx.phase)}</span></div>`)}
    ${section("Status", html`<div class="v-g2">${status.map(([l, v]) => tile(l, v))}</div>`)}
    ${section("Hardware", html`<div class="v-list">${hw.map(([l, v]) => tile(l, v, false))}</div>`)}
    ${section("Maintenance", html`<div class="v-g2">
      ${btn("Home axes", ctx.icon("home"), active || off, () => void ctx.press("home"))}
      ${btn("Dismiss alert", ctx.icon("alert"), off, () => void ctx.press("clear_hms"))}</div>`)}
  </div>`;
};
