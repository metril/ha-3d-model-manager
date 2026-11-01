import { describe, expect, it } from "vitest";
import { defineOnce, registerCard } from "../src/register.ts";

describe("register", () => {
  it("registerCard is idempotent", () => {
    const info = { type: "tdmm-x", name: "X", description: "d" };
    registerCard(info);
    registerCard(info);
    const w = window as unknown as { customCards: { type: string; documentationURL: string }[] };
    const hits = w.customCards.filter((c) => c.type === "tdmm-x");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.documentationURL).toBe("https://github.com/metril/ha-3d-model-manager#cards");
  });
  it("defineOnce does not throw twice", () => {
    class A extends HTMLElement {}
    class B extends HTMLElement {}
    defineOnce("tdmm-once", A);
    expect(() => defineOnce("tdmm-once", B)).not.toThrow();
    expect(customElements.get("tdmm-once")).toBe(A);
  });
});
