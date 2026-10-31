"""Tests for the 3DMM ext v2 API client."""

from __future__ import annotations

import json
from pathlib import Path

import aiohttp
import pytest
import voluptuous as vol
from aioresponses import aioresponses
from yarl import URL

from custom_components.tdmm.api import TdmmApiClient, normalize_url
from custom_components.tdmm.exceptions import (
    TdmmAuthError,
    TdmmCameraWarming,
    TdmmConnectionError,
    TdmmScopeError,
)

BASE = "http://3dmm.local"
V2 = f"{BASE}/api/ext/v2"
FIX = Path(__file__).parent / "fixtures"


@pytest.fixture
async def client():
    async with aiohttp.ClientSession() as session:
        yield TdmmApiClient(session, BASE, "k123")


@pytest.fixture
def m():
    with aioresponses() as mock:
        yield mock


def _calls(m, method, url):
    return m.requests[(method, URL(url))]


async def test_sends_api_key_header(client, m):
    m.get(f"{V2}/ping", payload=json.loads((FIX / "ping.json").read_text()))
    ping = await client.ping()
    assert ping.key_id
    assert _calls(m, "GET", f"{V2}/ping")[0].kwargs["headers"]["X-API-Key"] == "k123"


async def test_printers_parsed(client, m):
    m.get(f"{V2}/printers", payload=json.loads((FIX / "printers.json").read_text()))
    printers = await client.printers()
    assert printers
    assert printers[0].id


async def test_status_returns_dict(client, m):
    m.get(f"{V2}/printers/1/status", payload={"online": True})
    assert await client.status(1) == {"online": True}


async def test_401_raises_auth(client, m):
    m.get(f"{V2}/ping", status=401)
    with pytest.raises(TdmmAuthError):
        await client.ping()


async def test_403_raises_scope(client, m):
    m.get(f"{V2}/ping", status=403)
    with pytest.raises(TdmmScopeError):
        await client.ping()


async def test_500_and_client_error_raise_connection(client, m):
    m.get(f"{V2}/ping", status=500)
    m.get(f"{V2}/ping", exception=aiohttp.ClientConnectionError("boom"))
    with pytest.raises(TdmmConnectionError):
        await client.ping()
    with pytest.raises(TdmmConnectionError):
        await client.ping()


async def test_control_posts_body(client, m):
    url = f"{V2}/printers/1/control/fan"
    m.post(url, status=200, payload={})
    await client.control(1, "fan", {"fan": "part", "pct": 50})
    assert _calls(m, "POST", url)[0].kwargs["json"] == {"fan": "part", "pct": 50}


async def test_command_pause_path(client, m):
    url = f"{V2}/printers/1/pause"
    m.post(url, status=200, payload={})
    await client.command(1, "pause")
    assert len(_calls(m, "POST", url)) == 1


async def test_thumbnail_404_returns_none(client, m):
    m.get(f"{V2}/printers/1/thumbnail", status=404)
    assert await client.thumbnail(1) is None


async def test_thumbnail_bytes(client, m):
    m.get(f"{V2}/printers/1/thumbnail", body=b"png")
    assert await client.thumbnail(1) == b"png"


async def test_camera_snapshot_bytes(client, m):
    m.get(f"{V2}/printers/1/camera/snapshot", body=b"jpg")
    assert await client.camera_snapshot(1) == b"jpg"


async def test_snapshot_503_retry_after(client, m):
    url = f"{V2}/printers/1/camera/snapshot"
    m.get(url, status=503, headers={"Retry-After": "5"})
    m.get(url, status=503)
    with pytest.raises(TdmmCameraWarming) as exc:
        await client.camera_snapshot(1)
    assert exc.value.retry_after == 5.0
    with pytest.raises(TdmmCameraWarming) as exc:
        await client.camera_snapshot(1)
    assert exc.value.retry_after == 2.0


async def test_open_camera_stream_timeout(client, m):
    url = f"{V2}/printers/1/camera/stream"
    m.get(url, body=b"x")
    resp = await client.open_camera_stream(1)
    resp.close()
    t = _calls(m, "GET", url)[0].kwargs["timeout"]
    assert t.total is None
    assert t.sock_read == 30


async def test_open_events_query_and_headers(client, m):
    url = f"{BASE}/api/events?printer_ids=1,2"
    m.get(url, body=b"")
    resp = await client.open_events([2, 1])
    resp.close()
    call = next(c for k, v in m.requests.items() if k[1].path == "/api/events" for c in v)
    assert call.kwargs["headers"]["Accept"] == "text/event-stream"
    assert call.kwargs["headers"]["X-API-Key"] == "k123"
    assert call.kwargs["timeout"].total is None
    assert call.kwargs["timeout"].sock_read == client.sse_sock_read
    assert [k for k in m.requests if k[1].path == "/api/events"][0][1].query["printer_ids"] == "1,2"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("HTTP://Host:80/", "http://host"),
        ("https://Host:443", "https://host"),
        ("http://host:8080/", "http://host:8080"),
        ("https://h.example/base/", "https://h.example/base"),
    ],
)
def test_normalize_url(raw, expected):
    assert normalize_url(raw) == expected


@pytest.mark.parametrize("raw", ["ftp://host", "host", "http://"])
def test_normalize_url_invalid(raw):
    with pytest.raises(vol.Invalid):
        normalize_url(raw)
