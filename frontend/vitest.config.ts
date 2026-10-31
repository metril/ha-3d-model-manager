import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const manifest = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../custom_components/tdmm/manifest.json"), "utf8"),
);

export default defineConfig({
  define: { __TDMM_VERSION__: JSON.stringify(manifest.version) },
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
  },
});
