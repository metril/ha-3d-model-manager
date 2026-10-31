import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const here = import.meta.dirname;
const manifest = JSON.parse(readFileSync(resolve(here, "../custom_components/tdmm/manifest.json"), "utf8"));

export const buildOptions = {
  entryPoints: [resolve(here, "src/index.ts")],
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  define: { __TDMM_VERSION__: JSON.stringify(manifest.version) },
  logLevel: "warning",
  outfile: resolve(here, "../custom_components/tdmm/frontend/tdmm-cards.js"),
};

if (import.meta.main) {
  await build(buildOptions);
}
