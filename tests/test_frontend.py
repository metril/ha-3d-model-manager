"""Tests for serving the card bundle."""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest
from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL, UrlManager
from homeassistant.config_entries import ConfigEntryState
from homeassistant.setup import async_setup_component

from custom_components.tdmm.frontend import DATA_FRONTEND, URL_BASE

from .conftest import setup_entry, setup_integration

if TYPE_CHECKING:
    from pathlib import Path

    from homeassistant.core import HomeAssistant

    from .fake_tdmm import FakeTdmm

BUNDLE = b"console.info('test bundle');\n"


@pytest.fixture
def bundle(tmp_path: Path):
    """Point the module at a temp bundle file."""
    path = tmp_path / "tdmm-cards.js"
    path.write_bytes(BUNDLE)
    with patch("custom_components.tdmm.frontend.BUNDLE_PATH", path):
        yield path


@pytest.fixture(autouse=True)
async def http_and_urls(hass: HomeAssistant):
    """Set up http; the real frontend setup is stubbed, so create its URL storage."""
    assert await async_setup_component(hass, "http", {})
    hass.data[DATA_EXTRA_MODULE_URL] = UrlManager(lambda *_: None, [])


async def test_bundle_served(hass: HomeAssistant, hass_client, fake_tdmm: FakeTdmm, bundle: Path) -> None:
    await setup_integration(hass, fake_tdmm)
    client = await hass_client()
    resp = await client.get(URL_BASE)
    assert resp.status == 200
    assert await resp.read() == bundle.read_bytes()


async def test_extra_js_url_has_hash(hass: HomeAssistant, fake_tdmm: FakeTdmm, bundle: Path) -> None:
    await setup_integration(hass, fake_tdmm)
    urls = hass.data[DATA_EXTRA_MODULE_URL].urls
    assert len(urls) == 1
    assert re.fullmatch(re.escape(URL_BASE) + r"\?v=[0-9a-f]{8}", next(iter(urls)))


async def test_registered_once_for_two_entries(hass: HomeAssistant, fake_tdmm: FakeTdmm, bundle: Path) -> None:
    await setup_integration(hass, fake_tdmm)
    with patch.object(hass.http, "async_register_static_paths") as register:
        second = await setup_entry(hass, fake_tdmm)
        await hass.config_entries.async_setup(second.entry_id)
        await hass.async_block_till_done()
    register.assert_not_called()
    assert len(hass.data[DATA_EXTRA_MODULE_URL].urls) == 1
    assert hass.data[DATA_FRONTEND] is True


async def test_missing_bundle_does_not_fail_setup(hass: HomeAssistant, fake_tdmm: FakeTdmm, tmp_path: Path) -> None:
    with patch("custom_components.tdmm.frontend.BUNDLE_PATH", tmp_path / "nope.js"):
        entry = await setup_integration(hass, fake_tdmm)
    assert entry.state is ConfigEntryState.LOADED
    assert not hass.data[DATA_EXTRA_MODULE_URL].urls


async def test_registration_error_logs_warning_entities_load(
    hass: HomeAssistant, fake_tdmm: FakeTdmm, bundle: Path, caplog: pytest.LogCaptureFixture
) -> None:
    with (
        caplog.at_level(logging.WARNING),
        patch.object(hass.http, "async_register_static_paths", side_effect=RuntimeError("boom")),
    ):
        entry = await setup_integration(hass, fake_tdmm)
    assert entry.state is ConfigEntryState.LOADED
    assert hass.states.async_entity_ids("binary_sensor")
    assert "card bundle" in caplog.text
