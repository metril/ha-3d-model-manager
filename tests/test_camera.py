"""Tests for the camera platform."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import TYPE_CHECKING

import pytest
from homeassistant.components.camera import async_get_image
from homeassistant.setup import async_setup_component

from .conftest import setup_integration, until

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .fake_tdmm import FakeTdmm

FIX = Path(__file__).parent / "fixtures"
ENTITY = "camera.a1_camera"
SNAP = "/api/ext/v2/printers/1/camera/snapshot"
STREAM = "/api/ext/v2/printers/1/camera/stream"
FRAME = b"\xff\xd8jpegbytes\xff\xd9"


@pytest.fixture(autouse=True)
async def _http(hass: HomeAssistant) -> None:
    assert await async_setup_component(hass, "http", {})


async def _setup(hass: HomeAssistant, fake: FakeTdmm, camera: str = "rtsp") -> None:
    fake.printers = [{"id": 1, "name": "A1", "serial": "SN1", "capabilities": {"camera": camera}}]
    fake.statuses = {1: json.loads((FIX / "status_printing.json").read_text())}
    fake.camera_frames = [FRAME]
    await setup_integration(hass, fake)
    if camera != "none":
        await until(lambda: (st := hass.states.get(ENTITY)) is not None and st.state != "unavailable")


async def test_snapshot_fetched_on_demand_only(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm)
    assert fake_tdmm.requests[SNAP] == 0
    img = await async_get_image(hass, ENTITY)
    assert img.content == FRAME
    assert fake_tdmm.requests[SNAP] == 1


async def test_snapshot_503_uses_cache_and_honours_retry_after(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm)
    await async_get_image(hass, ENTITY)
    fake_tdmm.snapshot_status = 503
    fake_tdmm.snapshot_retry_after = "30"
    img = await async_get_image(hass, ENTITY)
    assert img.content == FRAME
    assert fake_tdmm.requests[SNAP] == 2
    img = await async_get_image(hass, ENTITY)
    assert img.content == FRAME
    assert fake_tdmm.requests[SNAP] == 2


async def test_mjpeg_proxied_with_key_header(hass: HomeAssistant, hass_client, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm)
    client = await hass_client()
    resp = await client.get(f"/api/camera_proxy_stream/{ENTITY}")
    assert resp.status == 200
    assert "multipart/x-mixed-replace" in resp.headers["Content-Type"]
    assert "boundary=frame" in resp.headers["Content-Type"]
    chunk = await resp.content.read(200)
    assert FRAME[:8] in chunk or b"--frame" in chunk
    resp.close()
    reqs = [r for r in fake_tdmm.request_log if r.path == STREAM]
    assert len(reqs) == 1
    assert reqs[0].headers["X-API-Key"] == "key"


async def test_stream_closed_on_client_disconnect(hass: HomeAssistant, hass_client, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm)
    client = await hass_client()
    resp = await client.get(f"/api/camera_proxy_stream/{ENTITY}")
    await resp.content.read(100)
    await until(lambda: fake_tdmm.open_camera_streams == 1)
    resp.close()
    await until(lambda: fake_tdmm.open_camera_streams == 0)
    await asyncio.sleep(0)


async def test_no_camera_entity_without_capability(hass: HomeAssistant, fake_tdmm: FakeTdmm) -> None:
    await _setup(hass, fake_tdmm, camera="none")
    assert hass.states.get(ENTITY) is None
    assert fake_tdmm.requests[SNAP] == 0
