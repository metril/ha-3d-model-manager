"""Tests for entry setup/unload."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import TYPE_CHECKING

from homeassistant.config_entries import ConfigEntryState
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from custom_components.tdmm.const import DOMAIN

from .conftest import setup_integration, until

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .fake_tdmm import FakeTdmm

FIX = Path(__file__).parent / "fixtures"


def _raw() -> dict:
    return json.loads((FIX / "status_printing.json").read_text())


async def test_setup_creates_device_and_entities(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = _raw()
    entry = await setup_integration(hass, fake_tdmm)
    assert entry.state is ConfigEntryState.LOADED
    dev = dr.async_get(hass).async_get_device(identifiers={(DOMAIN, "SN1")})
    assert dev is not None
    assert dev.name == "A1"
    assert dev.configuration_url == fake_tdmm.url
    ents = er.async_entries_for_config_entry(er.async_get(hass), entry.entry_id)
    assert {e.unique_id for e in ents} >= {f"{entry.entry_id}_1_online", f"{entry.entry_id}_1_printing"}


async def test_steady_state_request_budget(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = _raw()
    entry = await setup_integration(hass, fake_tdmm)
    coord = entry.runtime_data.coordinators[1]
    await until(lambda: coord.data is not None)
    for i in range(5):
        await fake_tdmm.push("printer.delta", {"printer_id": 1, "patch": {"mc_percent": 50 + i}})
    await until(lambda: coord.data is not None and coord.data.mc_percent == 54)
    await hass.async_block_till_done()
    assert dict(fake_tdmm.requests) == {"/api/ext/v2/ping": 1, "/api/ext/v2/printers": 1, "/api/events": 1}
    assert fake_tdmm.requests["/api/ext/v2/printers/1/status"] == 0


async def test_entities_unavailable_until_snapshot(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.snapshot_on_connect = False
    await setup_integration(hass, fake_tdmm)
    await until(lambda: fake_tdmm.open_event_streams == 1)
    assert hass.states.get("binary_sensor.a1_online").state == "unavailable"
    await fake_tdmm.push("printer.status", {"printer_id": 1, "status": _raw()})
    await until(lambda: hass.states.get("binary_sensor.a1_online").state == "on")


async def test_disconnect_unavailable_reconnect_restores(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = _raw()
    entry = await setup_integration(hass, fake_tdmm)
    await until(lambda: hass.states.get("binary_sensor.a1_online").state == "on")
    hub = entry.runtime_data.hub
    hub.stream._sleep = lambda _d: asyncio.sleep(0.01)
    fake_tdmm.snapshot_on_connect = False
    await fake_tdmm.drop_streams()
    await until(lambda: hass.states.get("binary_sensor.a1_online").state == "unavailable")
    fake_tdmm.snapshot_on_connect = True
    await until(lambda: hass.states.get("binary_sensor.a1_online").state == "on", timeout=10)


async def test_unload_stops_stream(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = _raw()
    entry = await setup_integration(hass, fake_tdmm)
    await until(lambda: fake_tdmm.open_event_streams == 1)
    stream = entry.runtime_data.hub.stream
    assert stream.running
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.NOT_LOADED
    assert not stream.running
    await until(lambda: fake_tdmm.open_event_streams == 0)


async def test_ping_connection_error_not_ready(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.overrides["ping"] = (500, {})
    entry = await setup_integration(hass, fake_tdmm)
    assert entry.state is ConfigEntryState.SETUP_RETRY
    assert fake_tdmm.requests["/api/events"] == 0


async def test_unselected_printer_not_created(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.printers = [{"id": 1, "name": "A1", "serial": "SN1"}, {"id": 2, "name": "X1", "serial": "SN2"}]
    fake_tdmm.statuses[1] = _raw()
    entry = await setup_integration(hass, fake_tdmm, printer_ids=(1,))
    assert set(entry.runtime_data.coordinators) == {1}
    assert hass.states.get("binary_sensor.x1_online") is None
    assert dr.async_get(hass).async_get_device(identifiers={(DOMAIN, "SN2")}) is None
