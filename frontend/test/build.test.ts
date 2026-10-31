import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
// @ts-expect-error untyped .mjs
import { buildOptions } from "../esbuild.config.mjs";

const run = async () => {
  const r = await build({ ...buildOptions, write: false });
  return r.outputFiles![0]!;
};

describe("build", () => {
  it("build is byte-identical across two runs", async () => {
    const a = await run();
    const b = await run();
    const h = (c: Uint8Array) => createHash("sha256").update(c).digest("hex");
    expect(h(a.contents)).toBe(h(b.contents));
  });
  it("build has no legal comments or timestamps", async () => {
    const text = (await run()).text;
    expect(text).not.toMatch(/@license|\/\*!/);
    expect(text).not.toContain(new Date().toISOString().slice(0, 7));
  });
  it("buildOptions pinned", () => {
    expect(buildOptions.legalComments).toBe("none");
    expect(buildOptions.format).toBe("esm");
    expect(buildOptions.minify).toBe(true);
    expect(buildOptions.sourcemap).toBeFalsy();
    expect(buildOptions.outfile.endsWith("custom_components/tdmm/frontend/tdmm-cards.js")).toBe(true);
  });
  it("package.json pins exact versions", () => {
    const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8"));
    for (const [n, v] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      expect(v, n).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});
