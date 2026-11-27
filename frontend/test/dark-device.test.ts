import { render } from "lit";
import { describe, expect, it } from "vitest";
import { renderDeviceView } from "../src/dark/printer/device-view.ts";
import { mkCtx } from "./dark-charts.test.ts";

const view = (phase: string) => { const ctx = mkCtx({ phase }); const el = document.createElement("div"); render(renderDeviceView(ctx), el); return { el, ctx }; };
const btn = (el: HTMLElement, t: string) => [...el.querySelectorAll("button")].find((b) => b.textContent?.includes(t)) as HTMLButtonElement;

describe("device view", () => {
  it("locks speed and home while printing", () => {
    const { el } = view("printing");
    expect((el.querySelector("select") as HTMLSelectElement).disabled).toBe(true);
    expect(btn(el, "Home axes").disabled).toBe(true);
    expect(btn(el, "Dismiss alert").disabled).toBe(false);
    expect(el.textContent).toContain("Locked while printing — change it before the next job");
  });
  it("offline disables all", () => {
    const { el } = view("offline");
    expect(btn(el, "Dismiss alert").disabled).toBe(true);
    expect(el.textContent).toContain("Printer offline");
  });
  it("idle: note, hardware, presses", () => {
    const { el, ctx } = view("idle");
    expect(el.textContent).toContain("Applies to the next print");
    expect(el.textContent).toContain("01.08.00.00");
    expect(el.textContent).toContain("0.4 mm");
    btn(el, "Dismiss alert").click();
    btn(el, "Home axes").click();
    expect((ctx.press as ReturnType<typeof import("vitest").vi.fn>).mock.calls.map((c) => c[0])).toEqual(["clear_hms", "home"]);
  });
});
