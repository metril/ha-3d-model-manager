import { nothing, render, type TemplateResult } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/base/tdmm-base-card.ts";
import { getBlock } from "../src/blocks/registry.ts";
import type { BlockContext } from "../src/blocks/types.ts";
import type { BlockType, TabId } from "../src/config.ts";
import { normalizeConfig } from "../src/config.ts";
import { ENTITY_KEYS, resolveEntities, type EntityKey } from "../src/entities.ts";
import { ICON_SETS } from "../src/theme/tokens.ts";
import { fmtDuration, fmtTemp } from "../src/blocks/format.ts";
import { makeHass, type MakeHassOpts } from "./fixtures/hass.ts";

interface Opts extends MakeHassOpts { tab?: TabId; dropEntity?: string }
const mount = (type: BlockType, opts: Opts = {}) => {
  const hass = makeHass(opts);
  if (opts.dropEntity) delete hass.entities[opts.dropEntity];
  const resolved = resolveEntities(hass, "dev_p1");
  const config = normalizeConfig({ type: "custom:tdmm-printer-card", device_id: "dev_p1" });
  const ctx: BlockContext = {
    hass, resolved, config, tab: opts.tab,
    icon: (n) => ICON_SETS.default[n],
    state: (k: EntityKey) => (resolved.byKey[k] ? hass.states[resolved.byKey[k]!] : undefined),
    call: (d, s, data) => hass.callService(d, s, data),
  };
  const div = document.createElement("div");
  const r = getBlock(type).render(ctx);
  if (r !== nothing) render(r as TemplateResult, div);
  return { div, hass, ctx };
};
const btn = (div: HTMLElement, label: string) =>
  [...div.querySelectorAll("button")].find((b) => b.textContent?.includes(label)) as HTMLButtonElement | undefined;
const BTN = (k: string) => `button.x1c_garage_${k}_renamed`;

afterEach(() => vi.useRealTimers());

describe("control blocks", () => {
  it("pause press calls button.press", () => {
    const { div, hass } = mount("actions");
    btn(div, "Pause")!.click();
    expect(hass.callService).toHaveBeenCalledWith("button", "press", { entity_id: BTN("pause") });
    expect(btn(div, "Resume")).toBeUndefined();
  });
  it("resume shown only when paused", () => {
    const { div, hass } = mount("actions", { states: { "sensor.x1c_garage_print_state_renamed": { state: "pause" } } });
    expect(btn(div, "Pause")).toBeUndefined();
    btn(div, "Resume")!.click();
    expect(hass.callService).toHaveBeenCalledWith("button", "press", { entity_id: BTN("resume") });
  });
  it("home and clear_hms press", () => {
    const { div, hass } = mount("actions");
    btn(div, "Home")!.click();
    btn(div, "Clear HMS")!.click();
    expect(hass.callService).toHaveBeenCalledWith("button", "press", { entity_id: BTN("home") });
    expect(hass.callService).toHaveBeenCalledWith("button", "press", { entity_id: BTN("clear_hms") });
  });
  it("stop requires two clicks", () => {
    const { div, hass } = mount("actions");
    btn(div, "Stop")!.click();
    expect(hass.callService).toHaveBeenCalledTimes(0);
    expect(div.textContent).toContain("Confirm stop");
    btn(div, "Confirm stop")!.click();
    expect(hass.callService).toHaveBeenCalledTimes(1);
    expect(hass.callService).toHaveBeenCalledWith("button", "press", { entity_id: BTN("stop") });
  });
  it("stop disarms after 3s", () => {
    vi.useFakeTimers();
    const { div, hass } = mount("actions");
    btn(div, "Stop")!.click();
    vi.advanceTimersByTime(3001);
    expect(div.textContent).not.toContain("Confirm stop");
    btn(div, "Stop")!.click();
    expect(hass.callService).toHaveBeenCalledTimes(0);
  });
  it("actions disabled when unavailable", () => {
    const off = mount("actions", { states: { "binary_sensor.x1c_garage_online_renamed": { state: "off" } } });
    for (const b of off.div.querySelectorAll("button")) expect(b.disabled).toBe(true);
    const un = mount("actions", { states: { [BTN("home")]: { state: "unavailable" } } });
    expect(btn(un.div, "Home")!.disabled).toBe(true);
    expect(btn(un.div, "Stop")!.disabled).toBe(false);
  });
  it("light toggles", () => {
    const { div, hass } = mount("light");
    div.querySelector("button")!.click();
    expect(hass.callService).toHaveBeenCalledWith("light", "toggle", { entity_id: "light.x1c_garage_chamber_light_renamed" });
  });
  it("fan slider sets percentage 50", () => {
    const { div, hass } = mount("fans", { states: { "fan.x1c_garage_part_fan_renamed": { attributes: { percentage: 30 } } } });
    const inputs = div.querySelectorAll<HTMLInputElement>("input[type=range]");
    expect(inputs.length).toBe(3);
    expect(inputs[0]!.step).toBe("10");
    expect(inputs[0]!.value).toBe("30");
    inputs[0]!.value = "50";
    inputs[0]!.dispatchEvent(new Event("change"));
    expect(hass.callService).toHaveBeenCalledWith("fan", "set_percentage", { entity_id: "fan.x1c_garage_part_fan_renamed", percentage: 50 });
  });
  it("speed select calls select_option with sport", () => {
    const { div, hass } = mount("speed", { states: { "select.x1c_garage_speed_profile_renamed": { attributes: { options: ["silent", "standard", "sport"] } } } });
    const sel = div.querySelector("select")!;
    expect(sel.options.length).toBe(3);
    sel.value = "sport";
    sel.dispatchEvent(new Event("change"));
    expect(hass.callService).toHaveBeenCalledWith("select", "select_option", { entity_id: "select.x1c_garage_speed_profile_renamed", option: "sport" });
  });
  it("temps editable in control tab calls number.set_value", () => {
    const { div, hass } = mount("temps", { tab: "control" });
    const inp = div.querySelector<HTMLInputElement>("input[type=number]")!;
    inp.value = "230";
    inp.dispatchEvent(new Event("change"));
    expect(hass.callService).toHaveBeenCalledWith("number", "set_value", { entity_id: "number.x1c_garage_nozzle_target_temperature_renamed", value: 230 });
    expect(mount("temps", { tab: "status" }).div.querySelector("input")).toBeNull();
  });
  it("temps empty input makes no call; value above max is clamped", () => {
    const id = "number.x1c_garage_nozzle_target_temperature_renamed";
    const { div, hass } = mount("temps", { tab: "control", states: { [id]: { attributes: { min: 0, max: 300, step: 5 } } } });
    const inp = div.querySelector<HTMLInputElement>("input[type=number]")!;
    expect([inp.min, inp.max, inp.step]).toEqual(["0", "300", "5"]);
    inp.value = "  ";
    inp.dispatchEvent(new Event("change"));
    inp.value = "";
    inp.dispatchEvent(new Event("change"));
    expect(hass.callService).toHaveBeenCalledTimes(0);
    inp.value = "999";
    inp.dispatchEvent(new Event("change"));
    expect(hass.callService).toHaveBeenCalledWith("number", "set_value", { entity_id: id, value: 300 });
    expect(inp.value).toBe("300");
  });
  it("speed adds disabled placeholder when state not in options", () => {
    const { div } = mount("speed", { states: { "select.x1c_garage_speed_profile_renamed": { state: "weird", attributes: { options: ["silent", "sport"] } } } });
    const o = div.querySelector<HTMLOptionElement>("option[disabled]")!;
    expect(o.value).toBe("weird");
  });
  it("temps not editable when target is a sensor", () => {
    const { div } = mount("temps", { tab: "control", dropEntity: "number.x1c_garage_nozzle_target_temperature_renamed" });
    const inputs = div.querySelectorAll("input[type=number]");
    expect(inputs.length).toBe(1); // bed only
    expect(div.textContent).toContain("220 °C");
  });
  it("control blocks render nothing when entities missing", () => {
    const omit = Object.keys(ENTITY_KEYS) as EntityKey[];
    for (const t of ["actions", "fans", "light", "speed"] as BlockType[]) {
      expect(mount(t, { omit }).div.innerHTML).toBe("");
    }
  });
});

describe("format touch-ups", () => {
  const s = (state: string, unit?: string) => ({ entity_id: "x", state, attributes: unit ? { unit_of_measurement: unit } : {}, last_changed: "", last_updated: "" });
  it("fmtTemp uses unit", () => {
    expect(fmtTemp(s("70", "°F"))).toBe("70 °F");
    expect(fmtTemp(s("70"))).toBe("70 °C");
  });
  it("clamps negative durations", () => {
    expect(fmtDuration(-5, "min")).toBe("0m");
  });
});
