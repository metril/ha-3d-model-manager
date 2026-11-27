import { describe, expect, it } from "vitest";
import { normalizeConfig, serializeConfig } from "../src/config.ts";
import { TdmmOlymposAmsCard } from "../src/olympos/ams/tdmm-olympos-ams-card.ts";
import { TdmmOlymposPrinterCard } from "../src/olympos/printer/tdmm-olympos-printer-card.ts";
import { TdmmOlymposTileCard } from "../src/olympos/tile/tdmm-olympos-tile-card.ts";
import { cameraMode, chips, controlsEnabled, printerPhase, showTarget } from "../src/olympos/logic/gating.ts";
import { OLYMPOS_TOKENS, PALETTES, presetVars } from "../src/theme/olympos.ts";
import { TOKENS, tokenCss } from "../src/theme/tokens.ts";
import { makeHass } from "./fixtures/hass.js";

describe("olympos palettes", () => {
  it("every palette defines every token, and tokens exist in TOKENS", () => {
    for (const p of Object.values(PALETTES)) for (const t of OLYMPOS_TOKENS) expect(p[t], t).toBeTruthy();
    for (const t of OLYMPOS_TOKENS) expect(TOKENS.some((x) => x.name === t)).toBe(true);
    expect(presetVars("nope")).toBe(PALETTES.home);
    expect(PALETTES.home.accent).toBe("#00AE42");
  });
  it("preset replaces fallback but keeps user var layer", () => {
    expect(tokenCss({ accent: "#123456" })).toContain("--_tdmm-accent: var(--tdmm-accent, #123456);");
  });
});

describe("gating", () => {
  it("phases", () => {
    expect(printerPhase({ print_state: "running", online: "on" })).toBe("printing");
    expect(printerPhase({ print_state: "pause" })).toBe("paused");
    expect(printerPhase({ print_state: "finish" })).toBe("finished");
    expect(printerPhase({ print_state: "failed" })).toBe("failed");
    expect(printerPhase({ print_state: "idle" })).toBe("idle");
    expect(printerPhase({ print_state: "running", online: "off" })).toBe("offline");
    expect(printerPhase({ print_state: "unavailable" })).toBe("offline");
    expect(printerPhase({})).toBe("offline");
  });
  it("chips, targets, camera, controls", () => {
    expect(chips("paused", true)).toEqual({ stage: true, paused: true, hms: true });
    expect(chips("idle", false).stage).toBe(false);
    expect(showTarget(100, 220, "printing")).toBe(true);
    expect(showTarget(218, 220, "printing")).toBe(false);
    expect(showTarget(100, 220, "idle")).toBe(false);
    expect(showTarget(100, 0, "printing")).toBe(false);
    expect(showTarget(undefined, 220, "printing")).toBe(false);
    expect(cameraMode("printing", true)).toBe("live");
    expect(cameraMode("failed", true)).toBe("live");
    expect(cameraMode("finished", true)).toBe("last");
    expect(cameraMode("idle", true)).toBe("hidden");
    expect(cameraMode("printing", false)).toBe("hidden");
    expect(controlsEnabled("printing")).toEqual({ pause: true, resume: false, stop: true, home: false, speed: false });
    expect(controlsEnabled("paused").resume).toBe(true);
    expect(controlsEnabled("idle")).toMatchObject({ home: true, speed: true, stop: false });
    expect(controlsEnabled("offline")).toMatchObject({ home: false, speed: false });
  });
});

describe("olympos config", () => {
  it("defaults and round-trip", () => {
    const n = normalizeConfig({ type: "custom:tdmm-olympos-tile-card", device_id: "d" });
    expect(n.kind).toBe("olympos-tile");
    expect(n.theme).toMatchObject({ preset: "olympos", palette: "home" });
    expect(n.tap_action).toEqual({ action: "navigate", navigation_path: "#printer" });
    expect(serializeConfig(n)).toEqual({ type: "custom:tdmm-olympos-tile-card", device_id: "d" });
    const w = normalizeConfig({ type: "custom:tdmm-olympos-tile-card", device_id: "d", variant: "wide", name: "X", theme: { palette: "mocha" }, tap_action: { action: "more-info" } });
    expect(serializeConfig(w)).toEqual({
      type: "custom:tdmm-olympos-tile-card", device_id: "d", variant: "wide", name: "X", tap_action: { action: "more-info" }, theme: { palette: "mocha" },
    });
    expect(serializeConfig(normalizeConfig({ type: "custom:tdmm-olympos-printer-card", device_id: "d" }))).toEqual({ type: "custom:tdmm-olympos-printer-card", device_id: "d" });
  });
});

describe("olympos cards render with preset", () => {
  for (const [tag, Cls, type] of [
    ["tdmm-olympos-printer-card", TdmmOlymposPrinterCard, "printer"],
    ["tdmm-olympos-tile-card", TdmmOlymposTileCard, "tile"],
    ["tdmm-olympos-ams-card", TdmmOlymposAmsCard, "ams"],
  ] as const) {
    it(`${tag} renders content with olympos preset`, async () => {
      if (!customElements.get(tag)) customElements.define(tag, Cls);
      const el = document.createElement(tag) as InstanceType<typeof Cls>;
      el.setConfig({ type: `custom:tdmm-olympos-${type}-card`, device_id: "dev_p1" });
      el.hass = makeHass();
      document.body.append(el);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector(".olympos-placeholder")).toBeNull();
      expect(el.shadowRoot!.querySelector("ha-card")).toBeTruthy();
      expect(el.shadowRoot!.querySelector("style")!.textContent).toContain("#00AE42");
    });
  }
});
