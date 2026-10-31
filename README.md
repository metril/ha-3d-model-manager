# 3D Model Manager for Home Assistant

Custom integration for 3D Model Manager (tdmm). Work in progress.

## Cards

The integration registers the Lovelace bundle automatically at `/tdmm/tdmm-cards.js`; there is no resource step. Add a card from the dashboard card picker (search "3DMM") and pick your printer in the visual editor, or use YAML.

| Card | Type | Default blocks |
| --- | --- | --- |
| Printer | `custom:tdmm-printer-card` | Tabs: status (`header`, `progress`, `temps`, `job`, `hms`), control (`actions`, `temps`, `fans`, `light`, `speed`), filament (`ams`, `ext`) |
| Progress | `custom:tdmm-progress-card` | `header`, `progress`, `job` |
| AMS | `custom:tdmm-ams-card` | `ams`, `ext` |
| Camera | `custom:tdmm-camera-card` | `camera`, `progress` |

```yaml
type: custom:tdmm-printer-card
device_id: <printer device id>
```

```yaml
type: custom:tdmm-progress-card
device_id: <printer device id>
```

```yaml
type: custom:tdmm-ams-card
device_id: <printer device id>
```

```yaml
type: custom:tdmm-camera-card
device_id: <printer device id>
camera_view: auto # or live
```

### Options

- `device_id` (required): the printer device.
- `blocks`: ordered list of `{type, hidden?}` for the progress, AMS and camera cards.
- `tabs`: for the printer card, a `status` / `control` / `filament` map of block lists.
- `hide_tabs`: tabs to hide; `default_tab`: tab shown first (`status`, `control` or `filament`).
- `camera_view`: camera card only, `auto` (snapshot) or `live` (stream).
- `theme`: per-card overrides, see below.

Available block types: `header`, `progress`, `temps`, `job`, `hms`, `actions`, `fans`, `light`, `speed`, `ams`, `ext`, `camera`. Blocks whose entities do not exist on your printer render nothing. Unknown block types in saved configs are ignored.

### Reordering and hiding blocks

In the visual editor, drag blocks (or use the up/down buttons) to reorder them and use the eye icon to hide one. Only non-default values are written to YAML.

### Theming

Cards follow your Home Assistant theme, light or dark, by default. Override with `--tdmm-*` CSS variables in your HA theme, or per card:

```yaml
type: custom:tdmm-printer-card
device_id: <printer device id>
theme:
  accent: "#ff6600"
  density: compact
```

The full variable and key reference is in [docs/theming.md](docs/theming.md).
