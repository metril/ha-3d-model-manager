// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("docs", () => {
  it("README lists every card type and editor YAML keys", () => {
    const readme = readFileSync(resolve(import.meta.dirname, "../../README.md"), "utf8");
    for (const t of ["progress", "printer", "ams", "camera"]) expect(readme).toContain(`custom:tdmm-${t}-card`);
    for (const k of ["device_id", "tabs", "blocks", "theme", "hide_tabs", "default_tab", "camera_view"]) {
      expect(readme).toContain(k);
    }
    expect(readme).toContain("docs/theming.md");
    expect(readme).toContain("/tdmm/tdmm-cards.js");
  });
});
