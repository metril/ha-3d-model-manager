"""In-process fake 3DMM server (REST + SSE + MJPEG) for tests. Knobs are append-only."""

from __future__ import annotations

import asyncio
import collections
import contextlib
import json
from dataclasses import dataclass, field
from typing import Any

from aiohttp import web


@dataclass
class RecordedRequest:
    method: str
    path: str
    headers: dict[str, str]
    body: bytes


@dataclass
class FakeTdmm:
    requests: collections.Counter[str] = field(default_factory=collections.Counter)
    ping: dict[str, Any] = field(
        default_factory=lambda: {"key": {"id": 1, "label": "test", "scopes": ["read", "control"], "printer_ids": None}}
    )
    printers: list[dict[str, Any]] = field(default_factory=lambda: [{"id": 1, "name": "A1", "serial": "SN1"}])
    statuses: dict[int, dict[str, Any]] = field(default_factory=dict)
    events_status: int = 200
    snapshot_on_connect: bool = True
    camera_frames: list[bytes] = field(default_factory=list)
    snapshot_status: int = 200
    snapshot_retry_after: str | None = None
    thumbnail: bytes | None = None
    last_body: dict[str, Any] = field(default_factory=dict)
    open_camera_streams: int = 0
    # Per-route overrides: keys "ping", "printers", "status[<id>]", "control", "command" -> (status, body).
    overrides: dict[str, tuple[int, Any]] = field(default_factory=dict)
    request_log: list[RecordedRequest] = field(default_factory=list)
    open_event_streams: int = 0
    max_event_streams: int = 0
    url: str = ""
    _queues: list[asyncio.Queue[bytes | None]] = field(default_factory=list)

    def app(self) -> web.Application:
        app = web.Application(middlewares=[self._record])
        r = app.router
        r.add_get("/api/ext/v2/ping", self._ping)
        r.add_get("/api/ext/v2/printers", self._printers)
        r.add_get("/api/ext/v2/printers/{id}/status", self._status)
        r.add_post("/api/ext/v2/printers/{id}/control/{name}", self._control)
        r.add_post("/api/ext/v2/printers/{id}/{action:pause|resume|stop}", self._command)
        r.add_get("/api/ext/v2/printers/{id}/camera/snapshot", self._snapshot)
        r.add_get("/api/ext/v2/printers/{id}/camera/stream", self._stream)
        r.add_get("/api/ext/v2/printers/{id}/thumbnail", self._thumbnail)
        r.add_get("/api/events", self._events)
        return app

    @web.middleware
    async def _record(self, request: web.Request, handler: Any) -> web.StreamResponse:
        body = await request.read()
        self.requests[request.path] += 1
        self.request_log.append(RecordedRequest(request.method, request.path, dict(request.headers), body))
        if body:
            with contextlib.suppress(ValueError):
                parsed = json.loads(body)
                if isinstance(parsed, dict):
                    self.last_body[request.path] = parsed
        return await handler(request)

    def _override(self, key: str) -> web.Response | None:
        if key in self.overrides:
            status, body = self.overrides[key]
            return web.json_response(body, status=status)
        return None

    async def _ping(self, request: web.Request) -> web.Response:
        return self._override("ping") or web.json_response(self.ping)

    async def _printers(self, request: web.Request) -> web.Response:
        return self._override("printers") or web.json_response({"printers": self.printers})

    async def _status(self, request: web.Request) -> web.Response:
        pid = int(request.match_info["id"])
        if (resp := self._override(f"status[{pid}]")) is not None:
            return resp
        if pid not in self.statuses:
            return web.json_response({"error": "not found"}, status=404)
        return web.json_response(self.statuses[pid])

    async def _control(self, request: web.Request) -> web.Response:
        return self._override("control") or web.json_response({})

    async def _command(self, request: web.Request) -> web.Response:
        return self._override("command") or web.json_response({})

    async def _snapshot(self, request: web.Request) -> web.Response:
        if self.snapshot_status != 200:
            headers = {"Retry-After": self.snapshot_retry_after} if self.snapshot_retry_after else {}
            return web.Response(status=self.snapshot_status, headers=headers)
        return web.Response(body=self.camera_frames[0] if self.camera_frames else b"", content_type="image/jpeg")

    async def _stream(self, request: web.Request) -> web.StreamResponse:
        resp = web.StreamResponse(headers={"Content-Type": "multipart/x-mixed-replace;boundary=frame"})
        await resp.prepare(request)
        self.open_camera_streams += 1
        try:
            while True:
                for frame in self.camera_frames:
                    await resp.write(
                        b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                        + str(len(frame)).encode()
                        + b"\r\n\r\n"
                        + frame
                        + b"\r\n"
                    )
                await asyncio.sleep(0.05)
        finally:
            self.open_camera_streams -= 1

    async def _thumbnail(self, request: web.Request) -> web.Response:
        if self.thumbnail is None:
            return web.Response(status=404)
        return web.Response(body=self.thumbnail, content_type="image/png")

    @staticmethod
    def _frame(type_: str, payload: dict[str, Any], named: bool) -> bytes:
        data = f"data: {json.dumps({'type': type_, **payload})}\n\n"
        return (f"event: {type_}\n" + data if named else data).encode()

    async def _events(self, request: web.Request) -> web.StreamResponse:
        if self.events_status != 200:
            return web.Response(status=self.events_status)
        resp = web.StreamResponse(headers={"Content-Type": "text/event-stream", "Cache-Control": "no-cache"})
        await resp.prepare(request)
        queue: asyncio.Queue[bytes | None] = asyncio.Queue()
        self._queues.append(queue)
        self.open_event_streams += 1
        self.max_event_streams = max(self.max_event_streams, self.open_event_streams)
        try:
            if self.snapshot_on_connect:
                wanted = {int(i) for i in request.query.get("printer_ids", "").split(",") if i}
                for pid, status in self.statuses.items():
                    if not wanted or pid in wanted:
                        await resp.write(self._frame("printer.status", {"printer_id": pid, "status": status}, False))
            while (chunk := await queue.get()) is not None:
                await resp.write(chunk)
        finally:
            self.open_event_streams -= 1
            with contextlib.suppress(ValueError):
                self._queues.remove(queue)
        return resp

    async def push(self, type_: str, payload: dict[str, Any], *, named: bool = True) -> None:
        for q in list(self._queues):
            q.put_nowait(self._frame(type_, payload, named))
        await asyncio.sleep(0)

    async def push_raw(self, chunk: bytes) -> None:
        for q in list(self._queues):
            q.put_nowait(chunk)
        await asyncio.sleep(0)

    async def drop_streams(self) -> None:
        for q in list(self._queues):
            q.put_nowait(None)
        await asyncio.sleep(0)
