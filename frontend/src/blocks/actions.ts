import { css, html, nothing, type TemplateResult } from "lit";
import type { BlockContext, IconName } from "./types.ts";
import type { EntityKey } from "../entities.ts";
import { registerBlock } from "./registry.ts";
import { present } from "./format.ts";

const KEYS: EntityKey[] = ["pause", "resume", "stop", "home", "clear_hms"];
const DISARM_MS = 3000;
const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

const btnDisabled = (ctx: BlockContext, key: EntityKey): boolean => {
  const online = ctx.state("online");
  return (online !== undefined && online.state !== "on") || ctx.state(key)?.state === "unavailable";
};

function press(ctx: BlockContext, key: EntityKey): void {
  const id = ctx.resolved.byKey[key];
  if (id) void ctx.call("button", "press", { entity_id: id });
}

function simple(ctx: BlockContext, key: EntityKey, label: string, icon: IconName): TemplateResult {
  return html`<button class="tdmm-btn" ?disabled=${btnDisabled(ctx, key)} @click=${() => press(ctx, key)}>
    <ha-icon .icon=${ctx.icon(icon)}></ha-icon><span>${label}</span></button>`;
}

function stopBtn(ctx: BlockContext): TemplateResult {
  const onClick = (e: Event) => {
    const b = e.currentTarget as HTMLButtonElement;
    const lbl = b.querySelector(".lbl") as HTMLElement;
    const disarm = () => { timers.delete(b); b.classList.remove("armed"); lbl.textContent = "Stop"; };
    const t = timers.get(b);
    if (t === undefined) {
      b.classList.add("armed");
      lbl.textContent = "Confirm stop";
      timers.set(b, setTimeout(disarm, DISARM_MS));
      return;
    }
    clearTimeout(t);
    disarm();
    press(ctx, "stop");
  };
  return html`<button class="tdmm-btn" ?disabled=${btnDisabled(ctx, "stop")} @click=${onClick}>
    <ha-icon .icon=${ctx.icon("stop")}></ha-icon><span class="lbl">Stop</span></button>`;
}

registerBlock({
  type: "actions", label: "Actions", icon: "play", size: 1,
  uses: (r) => present(...KEYS.map((k) => r.byKey[k]), r.byKey.online, r.byKey.printing, r.byKey.print_state),
  render: (ctx) => {
    const has = (k: EntityKey) => !!ctx.resolved.byKey[k];
    const paused = ctx.state("print_state")?.state === "pause";
    const printing = ctx.state("printing")?.state === "on";
    const items: TemplateResult[] = [];
    if (has("pause") && printing && !paused) items.push(simple(ctx, "pause", "Pause", "pause"));
    if (has("resume") && paused) items.push(simple(ctx, "resume", "Resume", "play"));
    if (has("stop")) items.push(stopBtn(ctx));
    if (has("home")) items.push(simple(ctx, "home", "Home", "home"));
    if (has("clear_hms")) items.push(simple(ctx, "clear_hms", "Clear HMS", "alert"));
    return items.length ? html`<div class="tdmm-actions">${items}</div>` : nothing;
  },
  styles: css`
    .tdmm-actions { display: flex; flex-wrap: wrap; gap: var(--_tdmm-gap); }
    .tdmm-btn { display: inline-flex; align-items: center; gap: 4px; font: inherit; color: var(--_tdmm-text); background: var(--_tdmm-chip-bg); border: 0; border-radius: var(--_tdmm-radius); padding: 6px var(--_tdmm-gap); cursor: pointer; }
    .tdmm-btn ha-icon { --mdc-icon-size: 18px; color: var(--_tdmm-accent); }
    .tdmm-btn.armed { outline: 2px solid var(--_tdmm-accent); }
    .tdmm-btn:disabled { opacity: 0.5; cursor: default; }
  `,
});
