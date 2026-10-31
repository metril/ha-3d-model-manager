import { afterEach, describe, expect, it, vi } from "vitest";
import { LitElement } from "lit";
import { TdmmCardEditor } from "../src/editor/tdmm-card-editor.ts";
import { TdmmBlockList } from "../src/editor/tdmm-block-list.ts";
import { editorSchema } from "../src/editor/schema.ts";

class StubForm extends LitElement {
  static properties = { data: { attribute: false }, schema: { attribute: false }, computeLabel: { attribute: false } };
}
if (!customElements.get("ha-form")) customElements.define("ha-form", StubForm);
if (!customElements.get("hui-image")) customElements.define("hui-image", class extends HTMLElement {});
if (!customElements.get("tdmm-block-list")) customElements.define("tdmm-block-list", TdmmBlockList);
if (!customElements.get("tdmm-card-editor")) customElements.define("tdmm-card-editor", TdmmCardEditor);

const T = (k: string) => `custom:tdmm-${k}-card`;
async function mount(cfg: Record<string, unknown>) {
  const el = document.createElement("tdmm-card-editor") as TdmmCardEditor;
  el.setConfig(cfg as never);
  document.body.append(el);
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  const got: Record<string, unknown>[] = [];
  el.addEventListener("config-changed", (e) => got.push((e as CustomEvent).detail.config));
  const form = () => el.shadowRoot!.querySelector("ha-form") as StubForm & { data: Record<string, unknown> };
  const change = async (value: Record<string, unknown>) => {
    form().dispatchEvent(new CustomEvent("value-changed", { detail: { value }, bubbles: true }));
    await el.updateComplete;
  };
  return { el, got, form, change };
}

afterEach(() => { document.body.innerHTML = ""; vi.unstubAllGlobals(); });

describe("tdmm-card-editor", () => {
  it("emits minimal config for defaults", async () => {
    const input = { type: T("printer"), device_id: "d1" };
    const { got, form, change } = await mount(input);
    await change({ ...form().data });
    expect(got[0]).toEqual(input);
  });
  it("theme change emits only theme override", async () => {
    const { got, form, change } = await mount({ type: T("printer"), device_id: "d1" });
    await change({ ...form().data, theme: { accent: "#ff0000", density: "normal", icon_set: "default" } });
    expect(got[0]!.theme).toEqual({ accent: "#ff0000" });
    expect(Object.keys(got[0]!).sort()).toEqual(["device_id", "theme", "type"]);
  });
  it("blocks-changed on control tab emits tabs.control only", async () => {
    const { el, got } = await mount({ type: T("printer"), device_id: "d1" });
    const btn = [...el.shadowRoot!.querySelectorAll("button.tab")].find((b) => b.textContent!.trim().toLowerCase() === "control") as HTMLElement;
    btn.click();
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector("tdmm-block-list")!;
    list.dispatchEvent(new CustomEvent("blocks-changed", { detail: { blocks: [{ type: "fans" }, { type: "actions" }, { type: "temps" }, { type: "light" }, { type: "speed" }] }, bubbles: true }));
    const tabs = got[0]!.tabs as Record<string, unknown>;
    expect(Object.keys(tabs)).toEqual(["control"]);
  });
  it("printer schema has default_tab and hide_tabs; progress schema does not", () => {
    const names = (k: "printer" | "progress" | "camera") => editorSchema(k).map((s) => s.name);
    expect(names("printer")).toEqual(expect.arrayContaining(["device_id", "default_tab", "hide_tabs", "theme"]));
    expect(names("progress")).not.toContain("default_tab");
    expect(names("progress")).not.toContain("hide_tabs");
    expect(names("camera")).toContain("camera_view");
  });
  it("invalid color dropped", async () => {
    vi.stubGlobal("CSS", { supports: () => false });
    const { got, form, change } = await mount({ type: T("progress"), device_id: "d1" });
    await change({ ...form().data, theme: { accent: "notacolor", radius: 8 } });
    expect(got[0]!.theme).toEqual({ radius: 8 });
  });
});
