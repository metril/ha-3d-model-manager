"""Tests for the 3DMM ext v2 API client."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import aiohttp
import pytest
import voluptuous as vol
from aiohttp import web

from custom_components.tdmm.api import TdmmApiClient, normalize_url
from custom_components.tdmm.exceptions import (
    TdmmAuthError,
    TdmmCameraWarming,
    TdmmConnectionError,
    TdmmScopeError,
)

V2 = "/api/ext/v2"
FIX = Path(__file__).parent / "fixtures"


@pytest.fixture
async def serve(socket_enabled, aiohttp_server):
    """Build a client against a per-test app; routes are (method, path) -> handler. Returns (client, calls)."""
    sessions: list[aiohttp.ClientSession] = []

    async def _serve(routes):
        calls: list[web.Request] = []

        def wrap(handler):
            async def _h(request):
                calls.append(request)
                return await handler(request)

            return _h

        app = web.Application()
        for (method, path), handler in routes.items():
            app.router.add_route(method, path, wrap(handler))
        server = await aiohttp_server(app)
        session = aiohttp.ClientSession()
        sessions.append(session)
        return TdmmApiClient(session, str(server.make_url("")).rstrip("/"), "k123"), calls

    yield _serve
    for s in sessions:
        await s.close()


def _json(payload, status=200):
    async def h(request):
        return web.json_response(payload, status=status)

    return h


def _resp(status=200, body=b"", headers=None):
    async def h(request):
        return web.Response(status=status, body=body, headers=headers)

    return h


async def _drop(request):
    request.transport.close()
    return web.Response()


async def test_sends_api_key_header(serve):
    client, calls = await serve({("GET", f"{V2}/ping"): _json(json.loads((FIX / "ping.json").read_text()))})
    ping = await client.ping()
    assert ping.key_id
    assert calls[0].headers["X-API-Key"] == "k123"


async def test_printers_parsed(serve):
    client, _ = await serve({("GET", f"{V2}/printers"): _json(json.loads((FIX / "printers.json").read_text()))})
    printers = await client.printers()
    assert printers
    assert printers[0].id


async def test_status_returns_dict(serve):
    client, _ = await serve({("GET", f"{V2}/printers/1/status"): _json({"online": True})})
    assert await client.status(1) == {"online": True}


async def test_401_raises_auth(serve):
    client, _ = await serve({("GET", f"{V2}/ping"): _resp(401)})
    with pytest.raises(TdmmAuthError):
        await client.ping()


async def test_403_raises_scope(serve):
    client, _ = await serve({("GET", f"{V2}/ping"): _resp(403)})
    with pytest.raises(TdmmScopeError):
        await client.ping()


async def test_500_and_client_error_raise_connection(serve):
    n = 0

    async def flaky(request):
        nonlocal n
        n += 1
        return web.Response(status=500) if n == 1 else await _drop(request)

    client, _ = await serve({("GET", f"{V2}/ping"): flaky})
    with pytest.raises(TdmmConnectionError):
        await client.ping()
    with pytest.raises(TdmmConnectionError):
        await client.ping()


async def test_control_posts_body(serve):
    bodies = []

    async def h(request):
        bodies.append(await request.json())
        return web.json_response({})

    client, _ = await serve({("POST", f"{V2}/printers/1/control/fan"): h})
    await client.control(1, "fan", {"fan": "part", "pct": 50})
    assert bodies == [{"fan": "part", "pct": 50}]


async def test_command_pause_path(serve):
    client, calls = await serve({("POST", f"{V2}/printers/1/pause"): _json({})})
    await client.command(1, "pause")
    assert len(calls) == 1


async def test_thumbnail_404_returns_none(serve):
    client, _ = await serve({("GET", f"{V2}/printers/1/thumbnail"): _resp(404)})
    assert await client.thumbnail(1) is None


async def test_thumbnail_bytes(serve):
    client, _ = await serve({("GET", f"{V2}/printers/1/thumbnail"): _resp(body=b"png")})
    assert await client.thumbnail(1) == b"png"


async def test_camera_snapshot_bytes(serve):
    client, _ = await serve({("GET", f"{V2}/printers/1/camera/snapshot"): _resp(body=b"jpg")})
    assert await client.camera_snapshot(1) == b"jpg"


async def test_snapshot_503_retry_after(serve):
    n = 0

    async def h(request):
        nonlocal n
        n += 1
        return web.Response(status=503, headers={"Retry-After": "5"} if n == 1 else None)

    client, _ = await serve({("GET", f"{V2}/printers/1/camera/snapshot"): h})
    with pytest.raises(TdmmCameraWarming) as exc:
        await client.camera_snapshot(1)
    assert exc.value.retry_after == 5.0
    with pytest.raises(TdmmCameraWarming) as exc:
        await client.camera_snapshot(1)
    assert exc.value.retry_after == 2.0


async def test_open_camera_stream_timeout(serve):
    client, calls = await serve({("GET", f"{V2}/printers/1/camera/stream"): _resp(body=b"x")})
    with patch.object(client._session, "request", wraps=client._session.request) as req:  # noqa: SLF001
        resp = await client.open_camera_stream(1)
    resp.close()
    assert len(calls) == 1
    t = req.call_args.kwargs["timeout"]
    assert t.total is None
    assert t.sock_read == 30


async def test_open_events_query_and_headers(serve):
    client, calls = await serve({("GET", "/api/events"): _resp(body=b"")})
    with patch.object(client._session, "request", wraps=client._session.request) as req:  # noqa: SLF001
        resp = await client.open_events([2, 1])
    resp.close()
    assert calls[0].query["printer_ids"] == "1,2"
    assert calls[0].headers["Accept"] == "text/event-stream"
    assert calls[0].headers["X-API-Key"] == "k123"
    t = req.call_args.kwargs["timeout"]
    assert t.total is None
    assert t.sock_read == client.sse_sock_read


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
