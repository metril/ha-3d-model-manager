"""Tests for number, select and button platforms."""

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
BASE = "/api/ext/v2/printers/1/"


async def _setup(hass: HomeAssistant, fake: FakeTdmm, *, wait: bool = True) -> None:
    fake.statuses[1] = json.loads((FIX / "status_printing.json").read_text())
    await setup_integration(hass, fake)
    if wait:
        await until(lambda: (st := hass.states.get("button.a1_pause")) is not None and st.state != "unavailable")


async def test_set_nozzle_target(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm)
    assert float(hass.states.get("number.a1_nozzle_target_temperature").state) == 220
    await hass.services.async_call(
        "number", "set_value", {"entity_id": "number.a1_nozzle_target_temperature", "value": 215.0}, blocking=True
    )
    assert fake_tdmm.last_body[BASE + "control/temperature"] == {"target": "nozzle", "value": 215}


async def test_set_bed_target(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm)
    await hass.services.async_call(
        "number", "set_value", {"entity_id": "number.a1_bed_target_temperature", "value": 70}, blocking=True
    )
    assert fake_tdmm.last_body[BASE + "control/temperature"] == {"target": "bed", "value": 70}


async def test_number_bounds(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm)
    n = hass.states.get("number.a1_nozzle_target_temperature").attributes
    b = hass.states.get("number.a1_bed_target_temperature").attributes
    assert (n["min"], n["max"], n["step"]) == (0, 350, 1)
    assert (b["min"], b["max"]) == (0, 120)


async def test_speed_select_maps_levels(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm)
    st = hass.states.get("select.a1_speed_profile")
    assert st.state == "standard"
    assert st.attributes["options"] == ["silent", "standard", "sport", "ludicrous"]
    await hass.services.async_call(
        "select", "select_option", {"entity_id": "select.a1_speed_profile", "option": "ludicrous"}, blocking=True
    )
    assert fake_tdmm.last_body[BASE + "control/speed"] == {"level": 4}
    assert hass.states.get("select.a1_speed_profile").state == "standard"


async def test_speed_select_unknown_level_none(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm)
    await fake_tdmm.push("printer.delta", {"printer_id": 1, "patch": {"speed_level": 9}})
    await until(lambda: hass.states.get("select.a1_speed_profile").state == "unknown")


@pytest.mark.parametrize(
    ("key", "path", "body"),
    [
        ("pause", "pause", None),
        ("resume", "resume", None),
        ("stop", "stop", None),
        ("home", "control/home", {}),
        ("clear_hms", "control/clear-hms", {}),
    ],
)
async def test_buttons_hit_paths(
    hass: HomeAssistant, fake_tdmm: FakeTdmm, key: str, path: str, body: dict | None
) -> None:
    await _setup(hass, fake_tdmm)
    await hass.services.async_call("button", "press", {"entity_id": f"button.a1_{key}"}, blocking=True)
    posts = [r for r in fake_tdmm.request_log if r.method == "POST"]
    assert [r.path for r in posts] == [BASE + path]
    if body is not None:
        assert json.loads(posts[0].body) == body


async def test_button_409_raises_command_failed(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm)
    fake_tdmm.overrides["command"] = (409, {"error": "conflict"})
    with pytest.raises(HomeAssistantError) as exc:
        await hass.services.async_call("button", "press", {"entity_id": "button.a1_pause"}, blocking=True)
    assert exc.value.translation_key == "command_failed"


async def test_no_control_entities_without_scope(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.ping = {"key": {"id": 1, "label": "t", "scopes": ["read"], "printer_ids": None}}
    await _setup(hass, fake_tdmm, wait=False)
    await until(lambda: hass.states.get("binary_sensor.a1_online") is not None)
    for eid in ("number.a1_bed_target_temperature", "select.a1_speed_profile", "button.a1_pause"):
        assert hass.states.get(eid) is None
