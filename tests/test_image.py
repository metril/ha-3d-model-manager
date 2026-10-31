"""Tests for the print thumbnail image entity."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

from homeassistant.components.image import async_get_image

from .conftest import setup_integration, until

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .fake_tdmm import FakeTdmm

FIX = Path(__file__).parent / "fixtures"
ENTITY = "image.a1_print_thumbnail"
THUMB = "/api/ext/v2/printers/1/thumbnail"
PNG = b"\x89PNG\r\n\x1a\nthumb"


async def _setup(hass: HomeAssistant, fake: FakeTdmm, key: str | None = "k1") -> None:
    raw = json.loads((FIX / "status_printing.json").read_text())
    raw["print_thumbnail_key"] = key
    fake.statuses = {1: raw}
    fake.thumbnail = PNG
    await setup_integration(hass, fake)
    await until(lambda: (st := hass.states.get(ENTITY)) is not None and st.state != "unavailable")


async def _delta(hass: HomeAssistant, fake: FakeTdmm, key: str | None) -> None:
    await fake.push("printer.delta", {"printer_id": 1, "patch": {"print_thumbnail_key": key}})
    await hass.async_block_till_done()


async def test_thumbnail_fetched_once_per_key(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm)
    assert fake_tdmm.requests[THUMB] == 0
    assert (await async_get_image(hass, ENTITY)).content == PNG
    assert (await async_get_image(hass, ENTITY)).content == PNG
    assert fake_tdmm.requests[THUMB] == 1


async def test_key_change_refetches_and_updates_timestamp(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm)
    await async_get_image(hass, ENTITY)
    before = hass.states.get(ENTITY).state
    await _delta(hass, fake_tdmm, "k2")
    await until(lambda: hass.states.get(ENTITY).state != before)
    await async_get_image(hass, ENTITY)
    assert fake_tdmm.requests[THUMB] == 2


async def test_null_key_no_request(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm, key=None)
    ent = hass.data["image"].get_entity(ENTITY)
    assert await ent.async_image() is None
    assert fake_tdmm.requests[THUMB] == 0


async def test_404_cached_as_none(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm)
    fake_tdmm.thumbnail = None
    ent = hass.data["image"].get_entity(ENTITY)
    assert await ent.async_image() is None
    assert await ent.async_image() is None
    assert fake_tdmm.requests[THUMB] == 1
