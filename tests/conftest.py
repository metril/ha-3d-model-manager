"""Shared test fixtures."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest
from homeassistant.config_entries import ConfigEntryState
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.tdmm.const import CONF_API_KEY, CONF_PRINTER_IDS, CONF_URL, CONF_VERIFY_SSL, DOMAIN

from .fake_tdmm import FakeTdmm

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Callable

    from homeassistant.core import HomeAssistant


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom integrations in every test."""
    yield


@pytest.fixture(autouse=True)
def stub_frontend_dependency():
    """The frontend package (hass_frontend) is not installed in the test env; skip its real setup."""
    with patch("homeassistant.components.frontend.async_setup", return_value=True):
        yield


@pytest.fixture
async def fake_tdmm(hass: HomeAssistant, socket_enabled, aiohttp_server) -> AsyncIterator[FakeTdmm]:
    """A fresh fake 3DMM server per test."""
    fake = FakeTdmm()
    server = await aiohttp_server(fake.app())
    fake.url = str(server.make_url("")).rstrip("/")
    yield fake
    # Unload before the server shuts down, or the open SSE stream blocks server teardown.
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is ConfigEntryState.LOADED:
            await hass.config_entries.async_unload(entry.entry_id)


async def until(cond: Callable[[], bool], timeout: float = 5.0) -> None:
    """Poll until cond() is true."""
    async with asyncio.timeout(timeout):
        while not cond():
            await asyncio.sleep(0.005)


async def setup_entry(hass: HomeAssistant, fake: FakeTdmm, *, printer_ids=(1,)) -> MockConfigEntry:
    """Create a config entry pointing at the fake server and add it to hass (no platform setup)."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="3DMM",
        data={CONF_URL: fake.url, CONF_API_KEY: "tdmm-test-key-123", CONF_VERIFY_SSL: True},
        options={CONF_PRINTER_IDS: list(printer_ids)},
        unique_id=f"fake-{fake.url}",
    )
    entry.add_to_hass(hass)
    return entry


async def setup_integration(hass: HomeAssistant, fake: FakeTdmm, *, printer_ids=(1,)) -> MockConfigEntry:
    """Create the entry and run the real async_setup_entry."""
    entry = await setup_entry(hass, fake, printer_ids=printer_ids)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry
