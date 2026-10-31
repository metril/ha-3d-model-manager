import { build } from "esbuild";
import { resolve } from "node:path";

const here = import.meta.dirname;

export const buildOptions = {
  entryPoints: [resolve(here, "src/index.ts")],
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  logLevel: "warning",
  outfile: resolve(here, "../custom_components/tdmm/frontend/tdmm-cards.js"),
};

if (import.meta.main) {
  await build(buildOptions);
}
