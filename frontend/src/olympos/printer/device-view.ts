import { html, nothing, type TemplateResult } from "lit";
import type { EntityKey } from "../../entities.ts";
import type { OlymposCtx, RenderDeviceView } from "../contracts.ts";
import { isActive } from "../logic/gating.ts";
import { backHeader, cardStyle } from "../ui/views.ts";

const SPEEDS = ["silent", "standard", "sport", "ludicrous"];
const title = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const valid = (s?: string) => (s && s !== "unknown" && s !== "unavailable" ? s : undefined);

export function speedNote(phase: OlymposCtx["phase"]): string {
  return isActive(phase) ? "Locked while printing — change it before the next job" : phase === "offline" ? "Printer offline" : "Applies to the next print";
}

const tile = (ctx: OlymposCtx, label: string, v: string, big = true) => html`<div style="background:${ctx.v("surface-3")};border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:2px;min-width:0">
  <div style="font-size:${big ? 20 : 15}px;font-weight:${big ? 700 : 600};line-height:${big ? 26 : 20}px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere">${v}</div>
  <div style="font-size:11px;color:${ctx.v("text-secondary")}">${label}</div></div>`;

const section = (ctx: OlymposCtx, name: string, body: TemplateResult) =>
  html`<div style=${cardStyle(ctx)}><div style="font-size:13px;font-weight:600">${name}</div>${body}</div>`;

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
  const btn = (label: string, icon: string, disabled: boolean, onClick: () => void) => html`<button type="button" ?disabled=${disabled} @click=${onClick}
    style="border:0;font:600 13px inherit;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;background:${ctx.v("chip-bg")};color:${ctx.v("text")};opacity:${disabled ? 0.4 : 1}">
    <ha-icon .icon=${icon} style="--mdc-icon-size:18px"></ha-icon>${label}</button>`;
  const sel = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    if (spId) void ctx.callService("select", "select_option", { entity_id: spId, option: value });
  };
  return html`<div style="padding:12px;display:flex;flex-direction:column;gap:12px;color:${ctx.v("text")};background:${ctx.v("surface-1")}">
    ${backHeader(ctx, "Device", model ?? "")}
    ${section(ctx, "Settings", html`
      <label style="position:relative;display:block;min-width:0;height:48px;opacity:${selDis ? 0.4 : 1}">
        <ha-icon .icon=${ctx.icon("speed")} style="position:absolute;left:12px;top:14px;--mdc-icon-size:20px;color:${ctx.v("text-secondary")};pointer-events:none"></ha-icon>
        <select aria-label="Print speed" ?disabled=${selDis} @change=${sel}
          style="border:0;appearance:none;font:600 13px inherit;margin:0;width:100%;height:48px;box-sizing:border-box;padding:0 12px 0 40px;border-radius:14px;cursor:pointer;background:${ctx.v("chip-bg")};color:${ctx.v("text")}">
          ${opts.map((o) => html`<option value=${o} ?selected=${o === cur}>Speed · ${title(o)}</option>`)}
        </select></label>
      <div style="display:flex;align-items:center;gap:8px;height:16px;font-size:12px;line-height:16px;color:${ctx.v("text-secondary")};white-space:nowrap;overflow:hidden">
        ${active ? html`<ha-icon icon="mdi:lock" style="--mdc-icon-size:16px"></ha-icon>` : nothing}<span>${speedNote(ctx.phase)}</span></div>`)}
    ${section(ctx, "Status", html`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">${status.map(([l, v]) => tile(ctx, l, v))}</div>`)}
    ${section(ctx, "Hardware", html`<div style="display:flex;flex-direction:column;gap:10px">${hw.map(([l, v]) => tile(ctx, l, v, false))}</div>`)}
    ${section(ctx, "Maintenance", html`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
      ${btn("Home axes", ctx.icon("home"), active || off, () => void ctx.press("home"))}
      ${btn("Dismiss alert", ctx.icon("alert"), off, () => void ctx.press("clear_hms"))}</div>`)}
  </div>`;
};
