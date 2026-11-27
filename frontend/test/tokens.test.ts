import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ICON_SETS, TOKENS, parseColor, pickOnAccent, renderThemingMarkdown, themeStyleVars, tokenCss } from "../src/theme/tokens.ts";

describe("tokens", () => {
  it("every token has var fallback chain", () => {
    const css = tokenCss();
    expect(css).toContain("--_tdmm-accent: var(--tdmm-accent, var(--primary-color))");
    expect(css).toContain("--_tdmm-bg: var(--tdmm-bg, var(--ha-card-background, var(--card-background-color)))");
    expect(TOKENS.length).toBe(20);
    expect((css.match(/--_tdmm-[a-z0-9-]+:/g) ?? []).length).toBe(20);
  });

  it("no literal colors", () => {
    for (const t of TOKENS.filter((x) => x.kind === "color")) {
      expect(t.fallback).not.toMatch(/#[0-9a-f]{3,8}|rgb|hsl/i);
    }
  });

  it("themeStyleVars maps overrides only", () => {
    expect(themeStyleVars({ accent: "red", radius: 4 })).toEqual({ "--tdmm-accent": "red", "--tdmm-radius": "4px" });
    expect(themeStyleVars(undefined)).toEqual({});
    expect(themeStyleVars({ density: "compact" })).toEqual({ "--tdmm-gap": "4px" });
    expect(themeStyleVars({ density: "normal" })).toEqual({});
  });

  it("pickOnAccent chooses the higher-contrast text color", () => {
    expect(pickOnAccent("#03a9f4")).toBe("#000000");
    expect(pickOnAccent("rgb(3, 169, 244)")).toBe("#000000");
    expect(pickOnAccent("#ffffff")).toBe("#000000");
    expect(pickOnAccent("#000")).toBe("#ffffff");
    expect(pickOnAccent("#1a237e")).toBe("#ffffff");
    expect(pickOnAccent("rgba(255, 235, 59, 0.5)")).toBe("#000000");
    expect(pickOnAccent("var(--x)")).toBeUndefined();
    expect(parseColor("#abc")).toEqual([170, 187, 204]);
  });

  it("on_accent theme key maps to var", () => {
    expect(themeStyleVars({ on_accent: "#111" })).toEqual({ "--tdmm-on-accent": "#111" });
  });

  it("icon sets cover every IconName", () => {
    const d = Object.keys(ICON_SETS.default).sort();
    expect(d.length).toBe(18);
    expect(Object.keys(ICON_SETS.outline).sort()).toEqual(d);
  });

  it("docs/theming.md is fresh", () => {
    const file = readFileSync(resolve(process.cwd(), "../docs/theming.md"), "utf8");
    expect(file).toBe(renderThemingMarkdown());
  });
});
