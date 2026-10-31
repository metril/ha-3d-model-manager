"""Tests for dynamic AMS sensors."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from custom_components.tdmm.const import DOMAIN

from .conftest import setup_integration, until

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .fake_tdmm import FakeTdmm

FIX = Path(__file__).parent / "fixtures"
COLORS = ["#FF0000", "#00FF00", "#0000FF", "#FFFFFF"]


def _trays(unit: int = 0, n: int = 4) -> list[dict]:
    return [
        {
            "slot": unit * 4 + i,
            "ams_unit": unit,
            "tray": i,
            "color": COLORS[i],
            "material": "PLA",
            "remain_pct": 10 * (i + 1),
        }
        for i in range(n)
    ]


def _raw(*, serial: str | None = "AMS123", with_unit: bool = True) -> dict:
    raw = json.loads((FIX / "status_printing.json").read_text())
    raw["trays"] = _trays()
    raw["ams_units"] = (
        [{"id": 0, "humidity": 18.0, "temp": 27.5, "serial": serial, "label": "Main"}] if with_unit else []
    )
    return raw


def _ams_entities(hass: HomeAssistant) -> list[er.RegistryEntry]:
    return [e for e in er.async_get(hass).entities.values() if "_ams" in e.unique_id]


async def _ready(hass: HomeAssistant, count: int = 14) -> None:
    await until(lambda: len(_ams_entities(hass)) == count)
    await hass.async_block_till_done()


async def _state(hass: HomeAssistant, entity_id: str, expected: str) -> None:
    await until(lambda: (st := hass.states.get(entity_id)) is not None and st.state == expected)


async def _push(hass: HomeAssistant, fake: FakeTdmm, patch: dict) -> None:
    await fake.push("printer.delta", {"printer_id": 1, "patch": patch})
    await hass.async_block_till_done()


async def test_ams_entities_created_from_snapshot(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = _raw()
    await setup_integration(hass, fake_tdmm)
    await _ready(hass)
    assert hass.states.get("sensor.a1_main_tray_1_material").state == "PLA"
    assert hass.states.get("sensor.a1_main_humidity").state == "18.0"
    assert hass.states.get("sensor.a1_main_temperature").state == "27.5"


async def test_ams_device_via_printer(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = _raw()
    await setup_integration(hass, fake_tdmm)
    await _ready(hass)
    dev_reg = dr.async_get(hass)
    ams = dev_reg.async_get_device(identifiers={(DOMAIN, "SN1_ams0")})
    printer = dev_reg.async_get_device(identifiers={(DOMAIN, "SN1")})
    assert ams is not None
    assert printer is not None
    assert ams.via_device_id == printer.id
    ent = er.async_get(hass).async_get("sensor.a1_main_humidity")
    assert ent.device_id == ams.id


async def test_ams_identifier_without_serial_uses_printer_id(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.printers = [{"id": 1, "name": "A1"}]
    fake_tdmm.statuses[1] = _raw(with_unit=False)
    await setup_integration(hass, fake_tdmm)
    await _ready(hass)
    dev_reg = dr.async_get(hass)
    assert dev_reg.async_get_device(identifiers={(DOMAIN, "1_ams0")}) is not None
    assert dev_reg.async_get_device(identifiers={(DOMAIN, "None_ams0")}) is None


async def test_new_ams_unit_added_via_delta(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = _raw()
    await setup_integration(hass, fake_tdmm)
    await _ready(hass)
    await _push(
        hass,
        fake_tdmm,
        {
            "trays": _trays(0) + _trays(1, 2),
            "ams_units": [
                {"id": 0, "humidity": 18.0, "temp": 27.5, "serial": "AMS123", "label": "Main"},
                {"id": 1, "humidity": 30.0, "temp": 25.0, "serial": "AMS456", "label": "Second"},
            ],
        },
    )
    await until(lambda: len(_ams_entities(hass)) == 14 + 2 + 2 * 3)
    await _state(hass, "sensor.a1_second_humidity", "30.0")
    await _state(hass, "sensor.a1_second_tray_2_color", COLORS[1])


async def test_no_duplicate_entities_on_repeat_snapshot(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = _raw()
    await setup_integration(hass, fake_tdmm)
    await _ready(hass)
    await _push(hass, fake_tdmm, {"mc_percent": 50})
    await fake_tdmm.push("printer.status", {"printer_id": 1, "status": {**_raw(), "mc_percent": 60}})
    await hass.async_block_till_done()
    await _push(hass, fake_tdmm, {"trays": _trays()})
    assert len(_ams_entities(hass)) == 14
    assert len({e.unique_id for e in _ams_entities(hass)}) == 14


async def test_tray_removed_becomes_unavailable(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = _raw()
    await setup_integration(hass, fake_tdmm)
    await _state(hass, "sensor.a1_main_tray_4_material", "PLA")
    await _push(hass, fake_tdmm, {"trays": _trays(n=3)})
    await _state(hass, "sensor.a1_main_tray_4_material", "unavailable")
    await _state(hass, "sensor.a1_main_tray_3_material", "PLA")
    assert len(_ams_entities(hass)) == 14


async def test_tray_color_and_remaining(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = _raw()
    await setup_integration(hass, fake_tdmm)
    await _state(hass, "sensor.a1_main_tray_2_color", "#00FF00")
    await _state(hass, "sensor.a1_main_tray_2_remaining", "20")
    assert hass.states.get("sensor.a1_main_tray_2_remaining").attributes["unit_of_measurement"] == "%"


async def test_ams_tray_attributes_identify_slot(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = _raw()
    await setup_integration(hass, fake_tdmm)
    await _ready(hass)
    attrs = hass.states.get("sensor.a1_main_tray_3_material").attributes
    assert attrs["ams_unit"] == 0
    assert attrs["slot"] == 3
    assert hass.states.get("sensor.a1_main_humidity").attributes["ams_unit"] == 0
    assert "slot" not in hass.states.get("sensor.a1_main_humidity").attributes
    ent = er.async_get(hass).async_get("sensor.a1_main_tray_3_material")
    assert ent.translation_key == "tray_material"
    assert ent.unique_id.endswith("_1_ams0_tray2_material")
