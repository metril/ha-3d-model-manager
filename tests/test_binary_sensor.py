"""Tests for binary_sensor platform."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

from .conftest import setup_integration, until

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .fake_tdmm import FakeTdmm

FIX = Path(__file__).parent / "fixtures"


def _raw() -> dict:
    return json.loads((FIX / "status_printing.json").read_text())


async def _state(hass: HomeAssistant, entity_id: str, expected: str) -> None:
    await until(lambda: (st := hass.states.get(entity_id)) is not None and st.state == expected)


async def _push(hass: HomeAssistant, fake: FakeTdmm, patch: dict) -> None:
    await fake.push("printer.delta", {"printer_id": 1, "patch": patch})
    await hass.async_block_till_done()


async def test_online_available_when_printer_offline(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = {**_raw(), "online": False}
    await setup_integration(hass, fake_tdmm)
    await _state(hass, "binary_sensor.a1_online", "off")
    await _state(hass, "binary_sensor.a1_printing", "unavailable")


async def test_door_only_with_capability(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.printers = [
        {"id": 1, "name": "A1", "serial": "SN1"},
        {"id": 2, "name": "X1", "serial": "SN2", "capabilities": {"door": True}},
    ]
    fake_tdmm.statuses = {1: _raw(), 2: {**_raw(), "door_open": True}}
    await setup_integration(hass, fake_tdmm, printer_ids=(1, 2))
    assert hass.states.get("binary_sensor.a1_door") is None
    await _state(hass, "binary_sensor.x1_door", "on")


async def test_printing_states(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = _raw()
    await setup_integration(hass, fake_tdmm)
    await _state(hass, "binary_sensor.a1_printing", "on")
    await _push(hass, fake_tdmm, {"gcode_state": "PREPARE"})
    await _state(hass, "binary_sensor.a1_printing", "on")
    await _push(hass, fake_tdmm, {"gcode_state": "IDLE"})
    await _state(hass, "binary_sensor.a1_printing", "off")


async def test_hms_active(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = {**_raw(), "hms": []}
    await setup_integration(hass, fake_tdmm)
    await _state(hass, "binary_sensor.a1_hms_alert", "off")
    await _push(hass, fake_tdmm, {"hms": [{"attr": 1, "code": 2}]})
    await _state(hass, "binary_sensor.a1_hms_alert", "on")
