"""Diagnostics tests."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

from homeassistant.helpers import issue_registry as ir

from custom_components.tdmm.const import DOMAIN
from custom_components.tdmm.diagnostics import async_get_config_entry_diagnostics

from .conftest import setup_integration, until

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .fake_tdmm import FakeTdmm


async def test_diagnostics_redacts_secrets(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    entry = await setup_integration(hass, fake_tdmm)
    result = await async_get_config_entry_diagnostics(hass, entry)
    dumped = json.dumps(result)
    assert result["entry"]["data"]["api_key"] == "**REDACTED**"
    assert fake_tdmm.url not in dumped
    assert fake_tdmm.url.split("://")[1] not in dumped
    assert result["printers"][1]["info"]["serial"] == "**REDACTED**"
    assert "SN1" not in dumped
    assert result["entry"]["title"] == "**REDACTED**"


async def test_diagnostics_includes_stream_stats_and_raw(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.statuses[1] = json.loads((Path(__file__).parent / "fixtures" / "status_printing.json").read_text())
    entry = await setup_integration(hass, fake_tdmm)
    coord = entry.runtime_data.coordinators[1]
    await until(lambda: coord.raw is not None)
    result = await async_get_config_entry_diagnostics(hass, entry)
    json.dumps(result)
    assert result["connected"] is True
    assert result["scopes"] == sorted(result["scopes"])
    assert "read" in result["scopes"]
    assert result["stream"]["connects"] >= 1
    assert isinstance(result["stream"]["last_event_at"], str)
    assert result["printers"][1]["raw"] is not None


async def test_remove_entry_deletes_repair_issues(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.ping = {"key": {"id": 1, "label": "t", "scopes": ["read"], "printer_ids": None}}
    entry = await setup_integration(hass, fake_tdmm)
    ids = [f"{entry.entry_id}_missing_scope_control", f"{entry.entry_id}_invalid_api_key"]
    from custom_components.tdmm import repairs

    repairs.async_raise_invalid_key(hass, entry)
    reg = ir.async_get(hass)
    assert all(reg.async_get_issue(DOMAIN, i) for i in ids)
    await hass.config_entries.async_remove(entry.entry_id)
    assert not any(reg.async_get_issue(DOMAIN, i) for i in ids)


async def test_setup_ping_clears_invalid_key_issue(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    from custom_components.tdmm import repairs

    from .conftest import setup_entry

    entry = await setup_entry(hass, fake_tdmm)
    repairs.async_raise_invalid_key(hass, entry)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert ir.async_get(hass).async_get_issue(DOMAIN, f"{entry.entry_id}_invalid_api_key") is None
