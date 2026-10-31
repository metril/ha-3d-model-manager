"""Tests for sensor platform."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest
from homeassistant.const import EVENT_STATE_CHANGED
from homeassistant.helpers import entity_registry as er

from .conftest import setup_entry, setup_integration, until

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .fake_tdmm import FakeTdmm

FIX = Path(__file__).parent / "fixtures"


async def _setup(hass: HomeAssistant, fake: FakeTdmm, *, printer_ids=(1,), enable=()) -> None:
    """Set up the integration with disabled-by-default sensors pre-enabled in the registry."""
    entry = await setup_entry(hass, fake, printer_ids=printer_ids)
    reg = er.async_get(hass)
    for pid in printer_ids:
        for key in enable:
            reg.async_get_or_create(
                "sensor", "tdmm", f"{entry.entry_id}_{pid}_{key}", config_entry=entry, suggested_object_id=f"a1_{key}"
            )
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


def _raw() -> dict:
    return json.loads((FIX / "status_printing.json").read_text())


async def _state(hass: HomeAssistant, entity_id: str, expected: str) -> None:
    await until(lambda: (st := hass.states.get(entity_id)) is not None and st.state == expected)


async def _push(hass: HomeAssistant, fake: FakeTdmm, patch: dict) -> None:
    await fake.push("printer.delta", {"printer_id": 1, "patch": patch})
    await hass.async_block_till_done()


@pytest.mark.parametrize(
    ("key", "expected"),
    [
        ("print_state", "running"),
        ("progress", "42"),
        ("remaining_time", "95"),
        ("current_layer", "80"),
        ("total_layers", "190"),
        ("nozzle_temperature", "219.6"),
        ("nozzle_target_temperature", "220.0"),
        ("bed_temperature", "59.8"),
        ("bed_target_temperature", "60.0"),
        ("chamber_temperature", "31.0"),
        ("stage", "printing"),
        ("speed_profile", "standard"),
        ("wifi_signal", "-52"),
        ("current_model", "Benchy"),
        ("print_error", "unknown"),
        ("active_filament_material", "PLA"),
        ("active_filament_color", "#FF0000"),
        ("firmware_version", "01.08.02.00"),
        ("nozzle_type", "stainless_steel"),
        ("nozzle_diameter", "0.4"),
        ("external_spool_material", "PETG"),
        ("external_spool_color", "#00FF00"),
    ],
)
async def test_sensor_values_from_fixture(hass: HomeAssistant, fake_tdmm: FakeTdmm, key: str, expected: str) -> None:
    fake_tdmm.printers = [{"id": 1, "name": "A1", "serial": "SN1", "capabilities": {"chamber_temp": True}}]
    fake_tdmm.statuses[1] = _raw()
    await _setup(hass, fake_tdmm, enable=("wifi_signal", "firmware_version"))
    await _state(hass, f"sensor.a1_{key}", expected)


async def test_offline_printer_sensors_unavailable(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = {**_raw(), "online": False}
    await _setup(hass, fake_tdmm, enable=("firmware_version",))
    for key in ("print_state", "progress", "nozzle_temperature", "end_time", "firmware_version"):
        await _state(hass, f"sensor.a1_{key}", "unavailable")


async def test_end_time_rounded_to_minute(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = _raw()
    await setup_integration(hass, fake_tdmm)
    await until(lambda: (st := hass.states.get("sensor.a1_end_time")) is not None and st.state[0] == "2")
    end = datetime.fromisoformat(hass.states.get("sensor.a1_end_time").state)
    assert end.second == 0
    assert end.microsecond == 0


async def test_end_time_stable_when_remaining_unchanged(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    # The wall clock is mocked (not frozen) so the event loop's timers keep running.
    now = datetime(2026, 10, 30, 12, 0, 50, tzinfo=UTC)
    with patch("custom_components.tdmm.sensor.dt_util.utcnow", side_effect=lambda: now):
        fake_tdmm.statuses[1] = _raw()
        entry = await setup_integration(hass, fake_tdmm)
        coord = entry.runtime_data.coordinators[1]
        expected = "2026-10-30T13:35:00+00:00"  # 12:00:50 + 95 min, floored to the minute
        await _state(hass, "sensor.a1_end_time", expected)
        now += timedelta(seconds=30)  # crosses the minute boundary
        await _push(hass, fake_tdmm, {"fan_part_pct": 50})
        await until(lambda: coord.data.fan_part_pct == 50)
        await hass.async_block_till_done()
        assert hass.states.get("sensor.a1_end_time").state == expected
        now += timedelta(seconds=120)
        await _push(hass, fake_tdmm, {"mc_remaining_time": 90})
        await _state(hass, "sensor.a1_end_time", "2026-10-30T13:33:00+00:00")  # 12:03:20 + 90 min


async def test_end_time_none_when_idle(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = {**_raw(), "gcode_state": "IDLE"}
    await setup_integration(hass, fake_tdmm)
    await _state(hass, "sensor.a1_end_time", "unknown")


async def test_unknown_gcode_state_maps_unknown(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = {**_raw(), "gcode_state": "WEIRD"}
    await setup_integration(hass, fake_tdmm)
    await _state(hass, "sensor.a1_print_state", "unknown")


@pytest.mark.parametrize(
    ("raw", "expected"), [("-45dBm", "-45"), ("-45", "-45"), (None, "unknown"), ("junk", "unknown")]
)
async def test_wifi_signal_parsing(hass: HomeAssistant, fake_tdmm: FakeTdmm, raw: str | None, expected: str) -> None:
    fake_tdmm.statuses[1] = {**_raw(), "wifi_signal": raw}
    await _setup(hass, fake_tdmm, enable=("wifi_signal",))
    await _state(hass, "sensor.a1_wifi_signal", expected)


async def test_active_filament_falls_back_to_tray_now(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    raw = _raw()
    del raw["active_tray"]
    fake_tdmm.statuses[1] = raw
    await setup_integration(hass, fake_tdmm)
    await _state(hass, "sensor.a1_active_filament_material", "PLA")


async def test_chamber_sensor_only_with_capability(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.printers = [
        {"id": 1, "name": "A1", "serial": "SN1"},
        {"id": 2, "name": "X1", "serial": "SN2", "capabilities": {"chamber_temp": True}},
    ]
    fake_tdmm.statuses = {1: _raw(), 2: _raw()}
    await setup_integration(hass, fake_tdmm, printer_ids=(1, 2))
    assert hass.states.get("sensor.a1_chamber_temperature") is None
    await _state(hass, "sensor.x1_chamber_temperature", "31.0")


async def test_state_written_only_on_change(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = _raw()
    await setup_integration(hass, fake_tdmm)
    await _state(hass, "sensor.a1_progress", "42")
    events = []
    hass.bus.async_listen(
        EVENT_STATE_CHANGED, lambda e: events.append(e) if e.data["entity_id"].startswith("sensor.") else None
    )
    await _push(hass, fake_tdmm, {"mc_percent": 42})
    await _push(hass, fake_tdmm, {"mc_percent": 42})
    assert events == []
