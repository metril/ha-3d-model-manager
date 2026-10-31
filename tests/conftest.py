"""Shared test fixtures."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.tdmm.const import CONF_API_KEY, CONF_PRINTER_IDS, CONF_URL, CONF_VERIFY_SSL, DOMAIN

from .fake_tdmm import FakeTdmm

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom integrations in every test."""
    yield


@pytest.fixture
async def fake_tdmm(socket_enabled, aiohttp_server) -> FakeTdmm:
    """A fresh fake 3DMM server per test."""
    fake = FakeTdmm()
    server = await aiohttp_server(fake.app())
    fake.url = str(server.make_url("")).rstrip("/")
    return fake


async def setup_entry(hass: HomeAssistant, fake: FakeTdmm, *, printer_ids=(1,)) -> MockConfigEntry:
    """Create a config entry pointing at the fake server and add it to hass (no platform setup)."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="3DMM",
        data={CONF_URL: fake.url, CONF_API_KEY: "key", CONF_VERIFY_SSL: True, CONF_PRINTER_IDS: list(printer_ids)},
        unique_id=f"fake-{fake.url}",
    )
    entry.add_to_hass(hass)
    return entry
