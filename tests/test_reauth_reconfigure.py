"""Reauth and reconfigure flow tests."""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.config_entries import SOURCE_REAUTH, ConfigEntryState
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.tdmm.config_flow import entry_unique_id
from custom_components.tdmm.const import CONF_API_KEY, CONF_PRINTER_IDS, CONF_URL, CONF_VERIFY_SSL, DOMAIN

from .conftest import setup_integration
from .fake_tdmm import FakeTdmm

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant


def _entry(fake: FakeTdmm, key: str = "old") -> MockConfigEntry:
    return MockConfigEntry(
        domain=DOMAIN,
        title="3DMM",
        data={CONF_URL: fake.url, CONF_API_KEY: key, CONF_VERIFY_SSL: True},
        options={CONF_PRINTER_IDS: [1]},
        unique_id=entry_unique_id(fake.url, 1),
    )


async def test_ping_401_triggers_reauth(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    fake_tdmm.overrides["ping"] = (401, {})
    entry = await setup_integration(hass, fake_tdmm)
    assert entry.state is ConfigEntryState.SETUP_ERROR
    flows = hass.config_entries.flow.async_progress_by_handler(DOMAIN)
    assert [f["context"]["source"] for f in flows] == [SOURCE_REAUTH]


async def test_reauth_success_updates_key_and_reloads(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    entry = _entry(fake_tdmm)
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    result = await entry.start_reauth_flow(hass)
    assert result["step_id"] == "reauth_confirm"
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_API_KEY: "new"})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "reauth_successful"
    assert entry.data[CONF_API_KEY] == "new"
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    assert entry.options == {CONF_PRINTER_IDS: [1]}
    assert any(r.headers.get("X-API-Key") == "new" for r in fake_tdmm.request_log)


async def test_reauth_wrong_key_id_aborts(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    entry = _entry(fake_tdmm)
    entry.add_to_hass(hass)
    result = await entry.start_reauth_flow(hass)
    fake_tdmm.ping = {"key": {"id": 2, "label": "other", "scopes": ["read"], "printer_ids": None}}
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_API_KEY: "new"})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "wrong_key"
    assert entry.data[CONF_API_KEY] == "old"


async def test_reauth_invalid_auth_error(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    entry = _entry(fake_tdmm)
    entry.add_to_hass(hass)
    result = await entry.start_reauth_flow(hass)
    fake_tdmm.overrides["ping"] = (401, {})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_API_KEY: "bad"})
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "invalid_auth"}


async def _second_server(aiohttp_server) -> FakeTdmm:
    fake = FakeTdmm()
    server = await aiohttp_server(fake.app())
    fake.url = str(server.make_url("")).rstrip("/")
    return fake


async def test_reconfigure_changes_url(hass: HomeAssistant, fake_tdmm: FakeTdmm, aiohttp_server) -> None:
    entry = _entry(fake_tdmm)
    entry.add_to_hass(hass)
    new_url = (await _second_server(aiohttp_server)).url
    result = await entry.start_reconfigure_flow(hass)
    assert result["step_id"] == "reconfigure"
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_URL: new_url + "/", CONF_API_KEY: "k2", CONF_VERIFY_SSL: False}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "reconfigure_successful"
    assert entry.data == {CONF_URL: new_url, CONF_API_KEY: "k2", CONF_VERIFY_SSL: False}
    assert entry.unique_id == entry_unique_id(new_url, 1)
    assert entry.unique_id != entry_unique_id(fake_tdmm.url, 1)
    await hass.async_block_till_done()
    assert entry.options == {CONF_PRINTER_IDS: [1]}


async def test_reconfigure_to_existing_server_aborts_already_configured(
    hass: HomeAssistant, fake_tdmm: FakeTdmm, aiohttp_server
) -> None:
    entry = _entry(fake_tdmm)
    entry.add_to_hass(hass)
    other_url = (await _second_server(aiohttp_server)).url
    other = MockConfigEntry(
        domain=DOMAIN,
        data={CONF_URL: other_url, CONF_API_KEY: "x", CONF_VERIFY_SSL: True},
        unique_id=entry_unique_id(other_url, 1),
    )
    other.add_to_hass(hass)
    result = await entry.start_reconfigure_flow(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_URL: other_url, CONF_API_KEY: "k2", CONF_VERIFY_SSL: True}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "already_configured"
    assert entry.data[CONF_URL] == fake_tdmm.url


async def test_reauth_missing_read_scope_error(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    entry = _entry(fake_tdmm)
    entry.add_to_hass(hass)
    result = await entry.start_reauth_flow(hass)
    fake_tdmm.overrides["ping"] = (403, {})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_API_KEY: "new"})
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "missing_read_scope"}
