"""Config and options flow tests."""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import patch

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResultType

from custom_components.tdmm.config_flow import entry_unique_id
from custom_components.tdmm.const import CONF_API_KEY, CONF_PRINTER_IDS, CONF_URL, CONF_VERIFY_SSL, DOMAIN

from .conftest import setup_integration, until

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .fake_tdmm import FakeTdmm

PRINTERS = [
    {"id": 1, "name": "A1", "serial": "SN1", "model": "A1"},
    {"id": 2, "name": "X1", "serial": "SN2", "model": "X1C"},
]


def _creds(fake: FakeTdmm, url: str | None = None) -> dict:
    return {CONF_URL: url or fake.url, CONF_API_KEY: "key", CONF_VERIFY_SSL: True}


async def _start(hass: HomeAssistant, fake: FakeTdmm, url: str | None = None):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    return await hass.config_entries.flow.async_configure(result["flow_id"], _creds(fake, url))


async def test_user_flow_creates_entry(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.printers = PRINTERS
    with patch("custom_components.tdmm.async_setup_entry", return_value=True):
        result = await _start(hass, fake_tdmm, fake_tdmm.url.upper().replace("HTTP", "http") + "/")
        assert result["type"] is FlowResultType.FORM
        assert result["step_id"] == "printers"
        assert result["description_placeholders"]["control_warning"] == ""
        result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_PRINTER_IDS: ["1", "2"]})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"] == {CONF_URL: fake_tdmm.url, CONF_API_KEY: "key", CONF_VERIFY_SSL: True}
    assert result["options"] == {CONF_PRINTER_IDS: [1, 2]}
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    assert entry.unique_id == entry_unique_id(fake_tdmm.url, 1)


async def test_invalid_auth_error(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.overrides["ping"] = (401, {})
    assert (await _start(hass, fake_tdmm))["errors"] == {"base": "invalid_auth"}


async def test_cannot_connect_error(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    result = await _start(hass, fake_tdmm, "http://127.0.0.1:1")
    assert result["errors"] == {"base": "cannot_connect"}


async def test_missing_read_scope_error(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.ping = {"key": {"id": 1, "scopes": ["control"], "printer_ids": None}}
    assert (await _start(hass, fake_tdmm))["errors"] == {"base": "missing_read_scope"}


async def test_no_control_scope_warns_but_allows(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.ping = {"key": {"id": 1, "scopes": ["read"], "printer_ids": None}}
    with patch("custom_components.tdmm.async_setup_entry", return_value=True):
        result = await _start(hass, fake_tdmm)
        assert result["step_id"] == "printers"
        assert "control" in result["description_placeholders"]["control_warning"]
        result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_PRINTER_IDS: ["1"]})
    assert result["type"] is FlowResultType.CREATE_ENTRY


async def test_printers_filtered_by_key_allowlist(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.printers = PRINTERS
    fake_tdmm.ping = {"key": {"id": 1, "scopes": ["read"], "printer_ids": [2]}}
    result = await _start(hass, fake_tdmm)
    options = result["data_schema"].schema[CONF_PRINTER_IDS].config["options"]
    assert options == [{"value": "2", "label": "X1 (X1C)"}]


async def test_no_printers_error(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.printers = []
    assert (await _start(hass, fake_tdmm))["errors"] == {"base": "no_printers"}


async def test_duplicate_aborts(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    from pytest_homeassistant_custom_component.common import MockConfigEntry

    MockConfigEntry(domain=DOMAIN, data=_creds(fake_tdmm), unique_id=entry_unique_id(fake_tdmm.url, 1)).add_to_hass(
        hass
    )
    result = await _start(hass, fake_tdmm)
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "already_configured"


async def test_invalid_url_error(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    assert (await _start(hass, fake_tdmm, "ftp://nope"))["errors"] == {"base": "invalid_url"}


async def test_options_flow_updates_printer_ids_and_reloads(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.printers = PRINTERS
    fake_tdmm.statuses = {1: {"online": True}, 2: {"online": True}}
    entry = await setup_integration(hass, fake_tdmm, printer_ids=(1,))
    assert set(entry.runtime_data.coordinators) == {1}
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    assert result["data_schema"]({})[CONF_PRINTER_IDS] == ["1"]
    result = await hass.config_entries.options.async_configure(result["flow_id"], {CONF_PRINTER_IDS: ["1", "2"]})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options == {CONF_PRINTER_IDS: [1, 2]}
    await until(lambda: set(getattr(entry, "runtime_data", None) and entry.runtime_data.coordinators or ()) == {1, 2})
