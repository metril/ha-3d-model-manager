"""Tests for light and fan platforms."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

import pytest
from homeassistant.exceptions import HomeAssistantError

from .conftest import setup_integration, until

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .fake_tdmm import FakeTdmm

FIX = Path(__file__).parent / "fixtures"
CTRL = "/api/ext/v2/printers/1/control/"


async def _ready(hass: HomeAssistant, fake: FakeTdmm, caps: dict | None = None) -> None:
    _prep(fake, caps)
    await setup_integration(hass, fake)
    await until(lambda: (st := hass.states.get("light.a1_chamber_light")) is not None and st.state != "unavailable")


def _prep(fake: FakeTdmm, caps: dict | None = None) -> None:
    fake.statuses[1] = json.loads((FIX / "status_printing.json").read_text())
    if caps is not None:
        fake.printers = [{"id": 1, "name": "A1", "serial": "SN1", "capabilities": caps}]


async def test_light_state(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _ready(hass, fake_tdmm)
    assert hass.states.get("light.a1_chamber_light").state == "on"
    await fake_tdmm.push("printer.delta", {"printer_id": 1, "patch": {"light_on": False}})
    await until(lambda: hass.states.get("light.a1_chamber_light").state == "off")


@pytest.mark.parametrize(("service", "on"), [("turn_on", True), ("turn_off", False)])
async def test_light_turn_on_posts_body(hass: HomeAssistant, fake_tdmm: FakeTdmm, service: str, on: bool) -> None:
    await _ready(hass, fake_tdmm)
    await hass.services.async_call("light", service, {"entity_id": "light.a1_chamber_light"}, blocking=True)
    assert fake_tdmm.last_body[CTRL + "light"] == {"on": on}
    # No optimistic update.
    assert hass.states.get("light.a1_chamber_light").state == "on"


async def test_fan_set_percentage(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _ready(hass, fake_tdmm)
    assert hass.states.get("fan.a1_part_fan").attributes["percentage"] == 100
    await hass.services.async_call(
        "fan", "set_percentage", {"entity_id": "fan.a1_part_fan", "percentage": 55}, blocking=True
    )
    assert fake_tdmm.last_body[CTRL + "fan"] == {"fan": "part", "pct": 55}
    await hass.services.async_call("fan", "turn_on", {"entity_id": "fan.a1_part_fan"}, blocking=True)
    assert fake_tdmm.last_body[CTRL + "fan"] == {"fan": "part", "pct": 100}


async def test_fan_turn_off_zero(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _ready(hass, fake_tdmm)
    await hass.services.async_call("fan", "turn_off", {"entity_id": "fan.a1_part_fan"}, blocking=True)
    assert fake_tdmm.last_body[CTRL + "fan"] == {"fan": "part", "pct": 0}


async def test_aux_chamber_fans_gated_by_capabilities(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _ready(hass, fake_tdmm, {"aux_fan": True})
    assert hass.states.get("fan.a1_aux_fan").attributes["percentage"] == 40
    assert hass.states.get("fan.a1_chamber_fan") is None
    await hass.services.async_call(
        "fan", "set_percentage", {"entity_id": "fan.a1_aux_fan", "percentage": 10}, blocking=True
    )
    assert fake_tdmm.last_body[CTRL + "fan"] == {"fan": "aux", "pct": 10}


async def test_chamber_fan_with_capability(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _ready(hass, fake_tdmm, {"chamber_fan": True})
    assert hass.states.get("fan.a1_chamber_fan") is not None
    assert hass.states.get("fan.a1_aux_fan") is None


@pytest.mark.parametrize(("status", "key"), [(403, "missing_control_scope"), (500, "command_failed")])
async def test_control_403_raises_translated_error(
    hass: HomeAssistant, fake_tdmm: FakeTdmm, status: int, key: str
) -> None:
    await _ready(hass, fake_tdmm)
    fake_tdmm.overrides["control"] = (status, {"error": "x"})
    with pytest.raises(HomeAssistantError) as exc:
        await hass.services.async_call("light", "turn_on", {"entity_id": "light.a1_chamber_light"}, blocking=True)
    assert exc.value.translation_key == key


async def test_no_control_entities_without_scope(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    _prep(fake_tdmm)
    fake_tdmm.ping = {"key": {"id": 1, "label": "t", "scopes": ["read"], "printer_ids": None}}
    await setup_integration(hass, fake_tdmm)
    assert hass.states.get("light.a1_chamber_light") is None
    assert hass.states.get("fan.a1_part_fan") is None
