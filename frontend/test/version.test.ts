import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TDMM_VERSION, registerCard } from "../src/register.ts";

const root = resolve(import.meta.dirname, "../..");
const manifest = JSON.parse(readFileSync(resolve(root, "custom_components/tdmm/manifest.json"), "utf8"));

describe("version", () => {
  it("TDMM_VERSION matches manifest.json", () => {
    expect(TDMM_VERSION).toBe(manifest.version);
    expect(TDMM_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it("built bundle embeds the version", () => {
    const bundle = readFileSync(resolve(root, "custom_components/tdmm/frontend/tdmm-cards.js"), "utf8");
    expect(bundle).toContain(`v${manifest.version}`);
  });
  it("customCards entries carry version", () => {
    (window as unknown as { customCards?: unknown[] }).customCards = [];
    registerCard({ type: "custom:x-card", name: "x", description: "x" });
    const w = window as unknown as { customCards: Array<{ version?: string }> };
    expect(w.customCards[0]!.version).toBe(TDMM_VERSION);
  });
});
