# 3D Model Manager for Home Assistant

Custom integration for 3D Model Manager (3DMM): monitor and control your printers from Home Assistant, with Lovelace cards included.

## Installation (HACS)

1. In HACS, add this repository as a custom repository (category: Integration).
2. Install "3D Model Manager"; HACS installs the release zip (`tdmm.zip`, card bundle included).
3. Restart Home Assistant, then add the integration under Settings, Devices & services.

## Requirements

- A 3DMM server on the `feat/ext-v2-ha-additions` branch, which provides the `/api/ext/v2` API.
- A 3DMM API key with the `read` scope (required). Add the `control` scope to enable the light, fan, number, select and button entities; without it those commands fail with a clear error and a repair issue is raised.

## Entities

Created per printer:

- Sensor: print state, progress, remaining time, end time, current layer, total layers, nozzle temperature and target, bed temperature and target, chamber temperature, stage, speed profile, Wi-Fi signal, current model, print error, active filament material and color, firmware version, nozzle type and diameter, external spool material and color.
- Sensor (per AMS tray/unit): tray material, tray color, tray remaining, AMS humidity, AMS temperature.
- Binary sensor: online, door open, printing, HMS active.
- Light: chamber light.
- Fan: part fan, aux fan, chamber fan.
- Number: nozzle target temperature, bed target temperature.
- Select: speed profile.
- Button: pause, resume, stop, home, clear HMS.
- Camera: proxied printer camera.
- Image: print thumbnail.

## Request budget

Steady state is one `/ping` and one `/printers` request per setup and one `/api/events` SSE stream, with zero `/status` polling. Entities read coordinator data and never make requests; camera and image fetch on demand only.

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

## Releasing

1. Bump `version` in `custom_components/tdmm/manifest.json`.
2. Open a PR and merge to `main`.
3. The release workflow tags `v<version>`, builds the cards, zips the integration (bundle included) as `tdmm.zip` and publishes a GitHub release. HACS installs that zip.

Tags are never moved; an existing version tag means no release is made.
