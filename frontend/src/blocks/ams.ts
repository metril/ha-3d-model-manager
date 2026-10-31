import { css, html, nothing } from "lit";
import { registerBlock } from "./registry.ts";
import { fmtPercent, fmtTemp, isAvailable, present } from "./format.ts";
import { colorStyle, isBlank, isEmptyColor, parseColor } from "./filament.ts";

registerBlock({
  type: "ams", label: "AMS", icon: "spool", size: 1,
  uses: (r) => present(...r.ams.flatMap((u) => [u.humidity, u.temperature, ...u.slots.flatMap((s) => [s.material, s.color, s.remaining])]),
    r.byKey.active_filament_material, r.byKey.active_filament_color),
  render: (ctx) => {
    const units = ctx.resolved.ams;
    if (!units.length) return nothing;
    const st = (id?: string) => (id ? ctx.hass.states[id] : undefined);
    const actMat = ctx.state("active_filament_material")?.state;
    const actCol = parseColor(ctx.state("active_filament_color")?.state);
    return html`<div class="tdmm-ams">${units.map((u) => html`
      <div class="tdmm-ams-unit">
        <div class="tdmm-ams-head"><span>AMS ${u.unit}</span>
          ${u.humidity ? html`<span class="tdmm-ams-env"><ha-icon .icon=${ctx.icon("humidity")}></ha-icon>${fmtPercent(st(u.humidity))}</span>` : nothing}
          ${u.temperature ? html`<span class="tdmm-ams-env">${fmtTemp(st(u.temperature))}</span>` : nothing}</div>
        <div class="tdmm-slots">${u.slots.map((s) => {
          const mat = st(s.material), col = st(s.color), rem = st(s.remaining);
          const empty = !isAvailable(mat) || isBlank(mat!.state) || (isAvailable(col) && isEmptyColor(col!.state));
          const colorOf = parseColor(isAvailable(col) ? col!.state : undefined);
          const active = !empty && !!actCol && colorOf === actCol && isAvailable(mat) && mat!.state === actMat;
          const pct = isAvailable(rem) ? Math.max(0, Math.min(100, Number(rem!.state) || 0)) : 0;
          return html`<div class="tdmm-slot ${active ? "active" : ""}">
            <span class="tdmm-swatch" style=${empty ? "background:var(--_tdmm-chip-bg)" : colorStyle(isAvailable(col) ? col!.state : undefined)}></span>
            <span class="tdmm-slot-mat">${empty ? "Empty" : mat!.state}</span>
            ${empty ? nothing : html`<div class="tdmm-bar"><div class="tdmm-bar-fill" style="width:${pct}%"></div></div>
              <span class="tdmm-slot-rem">${fmtPercent(rem)}</span>`}
          </div>`;
        })}</div>
      </div>`)}</div>`;
  },
  styles: css`
    .tdmm-ams { display: flex; flex-direction: column; gap: var(--_tdmm-gap); }
    .tdmm-ams-head { display: flex; align-items: center; gap: var(--_tdmm-gap); margin-bottom: 4px; color: var(--_tdmm-text-secondary); }
    .tdmm-ams-head > span:first-child { flex: 1; color: var(--_tdmm-text); font-weight: 500; }
    .tdmm-ams-env { display: inline-flex; align-items: center; gap: 2px; }
    .tdmm-ams-env ha-icon { --mdc-icon-size: 16px; }
    .tdmm-slots { display: grid; grid-template-columns: repeat(auto-fit, minmax(5.5em, 1fr)); gap: var(--_tdmm-gap); }
    .tdmm-slot { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: var(--_tdmm-gap); background: var(--_tdmm-chip-bg); border-radius: var(--_tdmm-radius); border: 2px solid transparent; }
    .tdmm-slot.active { border-color: var(--_tdmm-accent); }
    .tdmm-slot .tdmm-bar { align-self: stretch; }
    .tdmm-slot-rem { color: var(--_tdmm-text-secondary); font-size: 0.85em; }
  `,
});
