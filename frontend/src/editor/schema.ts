import type { CardKind } from "../config.ts";

export type HaFormSchema = Record<string, unknown>;

const text = { text: {} };
const px = { number: { min: 0, max: 48, mode: "box", unit_of_measurement: "px" } };
const select = (options: string[], multiple = false) => ({
  select: { mode: "dropdown", multiple, options: options.map((value) => ({ value, label: value[0]!.toUpperCase() + value.slice(1) })) },
});

export function editorSchema(kind: CardKind): HaFormSchema[] {
  const schema: HaFormSchema[] = [
    {
      name: "device_id",
      required: true,
      selector: { device: { filter: { integration: "tdmm" }, entity: { integration: "tdmm", domain: "binary_sensor" } } },
    },
  ];
  if (kind === "printer") {
    schema.push(
      { name: "default_tab", selector: select(["status", "control", "filament"]) },
      { name: "hide_tabs", selector: select(["status", "control", "filament"], true) },
    );
  }
  if (kind === "camera") schema.push({ name: "camera_view", selector: select(["auto", "live"]) });
  schema.push({
    type: "expandable",
    name: "theme",
    title: "Appearance",
    schema: [
      ...["accent", "progress", "text", "text_secondary", "bg", "chip_bg"].map((name) => ({ name, selector: text })),
      ...["radius", "font_size", "icon_size"].map((name) => ({ name, selector: px })),
      { name: "font_family", selector: text },
      { name: "density", selector: select(["compact", "normal", "comfortable"]) },
      { name: "icon_set", selector: select(["default", "outline"]) },
    ],
  });
  return schema;
}
