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

if (process.argv[1] && resolve(process.argv[1]) === resolve(here, "esbuild.config.mjs")) {
  await build(buildOptions);
}
