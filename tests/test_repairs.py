"""Repair issue tests."""

from __future__ import annotations

from functools import partial
from typing import TYPE_CHECKING
from unittest.mock import patch

from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import Platform
from homeassistant.helpers import issue_registry as ir

from custom_components.tdmm.const import DOMAIN
from custom_components.tdmm.sse import EventStream

from .conftest import setup_integration, until

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .fake_tdmm import FakeTdmm


def _ping(scopes: list[str]) -> dict:
    return {"key": {"id": 1, "label": "t", "scopes": scopes, "printer_ids": None}}


def _issue(hass: HomeAssistant, issue_id: str):
    return ir.async_get(hass).async_get_issue(DOMAIN, issue_id)


async def test_sse_401_creates_issue_and_starts_reauth(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.events_status = 401
    entry = await setup_integration(hass, fake_tdmm)
    iid = f"{entry.entry_id}_invalid_api_key"
    await until(lambda: _issue(hass, iid) is not None)
    issue = _issue(hass, iid)
    assert issue.severity is ir.IssueSeverity.ERROR
    assert issue.is_fixable is False
    assert issue.translation_key == "invalid_api_key"
    await until(lambda: bool(hass.config_entries.flow.async_progress_by_handler(DOMAIN)))
    flows = hass.config_entries.flow.async_progress_by_handler(DOMAIN)
    assert flows[0]["context"]["source"] == "reauth"


async def test_issue_cleared_on_successful_connect(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.overrides["ping"] = (401, {})
    entry = await setup_integration(hass, fake_tdmm)
    iid = f"{entry.entry_id}_invalid_api_key"
    assert _issue(hass, iid) is not None
    del fake_tdmm.overrides["ping"]
    # on_connected fires once the snapshot window closes; shrink it.
    with patch("custom_components.tdmm.EventStream", partial(EventStream, snapshot_timeout=0.05)):
        await hass.config_entries.async_reload(entry.entry_id)
        await until(lambda: _issue(hass, iid) is None)
    assert entry.state is ConfigEntryState.LOADED


async def test_missing_read_scope_issue(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.ping = _ping(["control"])
    entry = await setup_integration(hass, fake_tdmm)
    assert entry.state is ConfigEntryState.SETUP_ERROR
    issue = _issue(hass, f"{entry.entry_id}_missing_scope_read")
    assert issue is not None
    assert issue.severity is ir.IssueSeverity.WARNING
    assert issue.translation_key == "missing_scope"
    assert issue.translation_placeholders == {"scope": "read"}


async def test_missing_control_scope_issue_and_no_control_platforms(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.ping = _ping(["read"])
    with (
        patch("custom_components.tdmm.CONTROL_PLATFORMS", [Platform.LIGHT]),
        patch("homeassistant.config_entries.ConfigEntries.async_forward_entry_setups", return_value=None) as forward,
    ):
        entry = await setup_integration(hass, fake_tdmm)
    assert entry.state is ConfigEntryState.LOADED
    issue = _issue(hass, f"{entry.entry_id}_missing_scope_control")
    assert issue is not None
    assert issue.translation_placeholders == {"scope": "control"}
    assert _issue(hass, f"{entry.entry_id}_missing_scope_read") is None
    assert Platform.LIGHT not in forward.call_args.args[1]
    # Restoring the scope clears the issue on the next setup.
    fake_tdmm.ping = _ping(["read", "control"])
    await hass.config_entries.async_reload(entry.entry_id)
    assert _issue(hass, f"{entry.entry_id}_missing_scope_control") is None
