import { writeFileSync } from "node:fs";
import { renderThemingMarkdown } from "../src/theme/tokens.ts";

writeFileSync(new URL("../../docs/theming.md", import.meta.url), renderThemingMarkdown());
