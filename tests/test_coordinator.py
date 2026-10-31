"""Tests for push-only printer coordinators."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import MagicMock

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.tdmm.const import DOMAIN
from custom_components.tdmm.coordinator import PrinterCoordinator, TdmmHub
from custom_components.tdmm.models import PingResult, PrinterInfo

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

FIX = Path(__file__).parent / "fixtures"


def _raw() -> dict:
    return json.loads((FIX / "status_printing.json").read_text())


@pytest.fixture
def coord(hass: HomeAssistant) -> PrinterCoordinator:
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    hub = TdmmHub(api=MagicMock(), ping=PingResult(key_id=1, scopes=frozenset({"read"})))
    return PrinterCoordinator(hass, entry, hub, PrinterInfo(id=1, name="A1"))


def test_hub_can_control() -> None:
    assert TdmmHub(MagicMock(), PingResult(key_id=1, scopes=frozenset({"control"}))).can_control
    assert not TdmmHub(MagicMock(), PingResult(key_id=1)).can_control


def test_initial_data_none(coord: PrinterCoordinator) -> None:
    assert coord.data is None
    assert coord.raw is None
    assert coord.update_interval is None


def test_snapshot_sets_data_and_notifies_once(coord: PrinterCoordinator) -> None:
    cb = MagicMock()
    coord.async_add_listener(cb)
    assert coord.apply_snapshot(_raw()) is True
    assert coord.data.mc_percent == 42
    assert cb.call_count == 1


def test_identical_snapshot_does_not_notify(coord: PrinterCoordinator) -> None:
    cb = MagicMock()
    coord.async_add_listener(cb)
    coord.apply_snapshot(_raw())
    assert coord.apply_snapshot(_raw()) is False
    assert cb.call_count == 1


def test_delta_applies_merge_patch(coord: PrinterCoordinator) -> None:
    coord.apply_snapshot(_raw())
    assert coord.apply_delta({"mc_percent": 50}) is True
    assert coord.data.mc_percent == 50


def test_noop_delta_does_not_notify(coord: PrinterCoordinator) -> None:
    cb = MagicMock()
    coord.async_add_listener(cb)
    coord.apply_snapshot(_raw())
    assert coord.apply_delta({"mc_percent": 42}) is False
    assert cb.call_count == 1


def test_delta_without_raw_returns_false(coord: PrinterCoordinator) -> None:
    assert coord.apply_delta({"mc_percent": 42}) is False
    assert coord.data is None


def test_list_patch_replaces_trays(coord: PrinterCoordinator) -> None:
    coord.apply_snapshot(_raw())
    assert len(coord.data.trays) > 1
    assert coord.apply_delta({"trays": [{"slot": 0, "material": "PETG"}]}) is True
    assert len(coord.data.trays) == 1
    assert coord.data.trays[0].material == "PETG"


def test_reset_snapshot_clears_data_and_fingerprint(coord: PrinterCoordinator) -> None:
    cb = MagicMock()
    coord.apply_snapshot(_raw())
    coord.async_add_listener(cb)
    coord.reset_snapshot()
    assert coord.data is None
    assert coord.raw is None
    assert cb.call_count == 0
    assert coord.apply_snapshot(_raw()) is True
    assert cb.call_count == 1
