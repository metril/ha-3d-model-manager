"""Pure incremental Server-Sent Events parser (WHATWG event-stream rules)."""

from __future__ import annotations

import asyncio
import codecs
import contextlib
import json
import logging
import random
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import aiohttp
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.util import dt as dt_util

from .exceptions import TdmmAuthError, TdmmError

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable, Mapping
    from datetime import datetime

    from homeassistant.core import Event, HomeAssistant

    from .coordinator import PrinterCoordinator, TdmmConfigEntry, TdmmHub

_LOGGER = logging.getLogger(__name__)


MAX_LINE_CHARS = 1024 * 1024


@dataclass(frozen=True, slots=True)
class SseEvent:
    """A dispatched SSE event."""

    event: str
    data: str
    id: str | None
    retry_ms: int | None


class SseParser:
    """Incremental parser; feed raw bytes, get completed events.

    Per WHATWG, the last ``id`` persists across events until overwritten (an
    ``id`` containing NUL is ignored). An unterminated line over 1 MiB is dropped.
    """

    def __init__(self) -> None:
        self.retry_ms: int | None = None
        self._decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        self._buf = ""
        self._prev_cr = False
        self._started = False
        self._id: str | None = None
        self._reset_block()

    def _reset_block(self) -> None:
        self._event = ""
        self._data: list[str] = []
        self._block_retry: int | None = None

    def feed(self, chunk: bytes) -> list[SseEvent]:
        """Consume a chunk and return any events completed by it."""
        text = self._decoder.decode(chunk)
        if not text:
            return []
        if not self._started:
            self._started = True
            text = text.removeprefix("﻿")
        if self._prev_cr and text.startswith("\n"):
            text = text[1:]
        self._prev_cr = text.endswith("\r")
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        self._buf += text
        *lines, self._buf = self._buf.split("\n")
        if len(self._buf) > MAX_LINE_CHARS:
            self._buf = ""
        events: list[SseEvent] = []
        for line in lines:
            ev = self._line(line)
            if ev is not None:
                events.append(ev)
        return events

    def _line(self, line: str) -> SseEvent | None:
        if not line:
            ev = None
            if self._data:
                ev = SseEvent(self._event or "message", "\n".join(self._data), self._id, self._block_retry)
            self._reset_block()
            return ev
        if line.startswith(":"):
            return None
        name, sep, value = line.partition(":")
        if sep and value.startswith(" "):
            value = value[1:]
        if name == "event":
            self._event = value
        elif name == "data":
            self._data.append(value)
        elif name == "id":
            if "\0" not in value:
                self._id = value
        elif name == "retry" and value.isascii() and value.isdigit():
            self._block_retry = self.retry_ms = int(value)
        return None


def event_type(ev: SseEvent, payload: Mapping[str, Any]) -> str | None:
    """Named SSE event wins; otherwise fall back to JSON ``type``."""
    if ev.event and ev.event != "message":
        return ev.event
    t = payload.get("type")
    return t if isinstance(t, str) else None


MAX_BACKOFF = 60.0


def next_backoff(attempt: int, retry_ms: int | None, rand: Callable[[], float]) -> float:
    """Exponential backoff with +-20 % jitter, floored by server ``retry:`` and capped at 60 s."""
    floor = retry_ms / 1000 if retry_ms else 0.0
    base = max(min(MAX_BACKOFF, 2 ** min(attempt, 10)), floor)
    jitter = 1 + (rand() * 0.4 - 0.2)
    return min(MAX_BACKOFF, max(floor, base * jitter))


@dataclass
class StreamStats:
    connects: int = 0
    disconnects: int = 0
    events: int = 0
    last_event_at: datetime | None = None
    last_error: str | None = None


class EventStream:
    """One long-lived ``/api/events`` stream per entry, with reconnect and backoff.

    ``stop()`` sets ``hub.connected`` False without notifying listeners (unload tears entities down).
    The snapshot timeout uses real ``asyncio.sleep`` by design; only the reconnect backoff is injectable.
    """

    def __init__(
        self,
        hass: HomeAssistant,
        entry: TdmmConfigEntry,
        hub: TdmmHub,
        coordinators: dict[int, PrinterCoordinator],
        *,
        on_auth_failed: Callable[[], None],
        on_connected: Callable[[], None],
        snapshot_timeout: float = 10.0,
        stable_after: float = 60.0,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        rand: Callable[[], float] = random.random,
    ) -> None:
        self._hass = hass
        self._entry = entry
        self._hub = hub
        self._coordinators = coordinators
        self._on_auth_failed = on_auth_failed
        self._on_connected = on_connected
        self._snapshot_timeout = snapshot_timeout
        self._stable_after = stable_after
        self._sleep = sleep
        self._rand = rand
        self._task: asyncio.Task[None] | None = None
        self._retry_ms: int | None = None
        self._auth_failed = False
        self.stats = StreamStats()

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    def start(self) -> None:
        if self.running:
            return
        self._task = self._entry.async_create_background_task(self._hass, self._run(), "tdmm_event_stream")
        self._entry.async_on_unload(self._hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, self._on_ha_stop))

    def _on_ha_stop(self, _event: Event) -> None:
        if self._task is not None:
            self._task.cancel()

    async def stop(self) -> None:
        task, self._task = self._task, None
        if task is None:
            return
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

    async def _run(self) -> None:
        loop = asyncio.get_running_loop()
        attempt = 0
        while True:
            started = loop.time()
            connected = False
            try:
                resp = await self._hub.api.open_events(self._coordinators)
                connected = True
                try:
                    await self._consume(resp)
                finally:
                    resp.close()
            except asyncio.CancelledError:
                if connected:
                    self._hub.connected = False
                raise
            except TdmmAuthError:
                _LOGGER.error("3DMM rejected the API key; stopping event stream")
                self._on_auth_failed()
                return
            except (TdmmError, aiohttp.ClientError, TimeoutError) as err:
                self.stats.last_error = str(err) or type(err).__name__
                _LOGGER.debug("Event stream error: %s", self.stats.last_error)
            except Exception as err:
                self.stats.last_error = str(err) or type(err).__name__
                _LOGGER.exception("Unexpected event stream error")
            if connected:
                self._disconnected()
            if self._auth_failed:
                _LOGGER.error("3DMM rejected the API key; stopping event stream")
                self._on_auth_failed()
                return
            if connected and loop.time() - started >= self._stable_after:
                attempt = 0
            delay = next_backoff(attempt, self._retry_ms, self._rand)
            attempt += 1
            _LOGGER.debug("Reconnecting event stream in %.1fs", delay)
            await self._sleep(delay)

    def _disconnected(self) -> None:
        self.stats.disconnects += 1
        self._hub.connected = False
        for coord in self._coordinators.values():
            coord.reset_snapshot()
        for coord in self._coordinators.values():
            coord.async_update_listeners()

    async def _consume(self, resp: aiohttp.ClientResponse) -> None:
        self.stats.connects += 1
        self._hub.connected = True
        parser = SseParser()
        parser.retry_ms = self._retry_ms
        fallback = asyncio.create_task(self._fallback(resp))
        try:
            async for chunk in resp.content.iter_any():
                for ev in parser.feed(chunk):
                    try:
                        self._dispatch(ev)
                    except Exception:
                        _LOGGER.exception("Error handling event %r", ev.event)
                self._retry_ms = parser.retry_ms
        finally:
            self._retry_ms = parser.retry_ms
            fallback.cancel()
            try:
                await fallback
            except asyncio.CancelledError:
                task = asyncio.current_task()
                if task is not None and task.cancelling():
                    raise  # our own cancellation, not the fallback's
            except Exception:
                _LOGGER.exception("Snapshot fallback failed")

    async def _fallback(self, resp: aiohttp.ClientResponse) -> None:
        """If no snapshot arrives in time, fetch one /status per missing printer."""
        await asyncio.sleep(self._snapshot_timeout)
        for pid, coord in self._coordinators.items():
            if coord.raw is not None:
                continue
            try:
                raw = await self._hub.api.status(pid)
            except TdmmAuthError:
                self._auth_failed = True
                resp.close()
                return
            except TdmmError as err:
                _LOGGER.debug("Fallback status for printer %s failed: %s", pid, err)
                continue
            if coord.raw is None and isinstance(raw, dict):
                coord.apply_snapshot(raw)
        self._on_connected()

    def _dispatch(self, ev: SseEvent) -> None:
        try:
            payload = json.loads(ev.data)
        except ValueError:
            return
        if not isinstance(payload, dict):
            return
        kind = event_type(ev, payload)
        if kind not in ("printer.status", "printer.delta", "print_job.updated"):
            return
        self.stats.events += 1
        self.stats.last_event_at = dt_util.utcnow()
        if kind == "print_job.updated":
            data = {k: v for k, v in payload.items() if k != "type"}
            self._hass.bus.async_fire("tdmm_print_job_updated", {**data, "entry_id": self._entry.entry_id})
            return
        coord = self._coordinators.get(payload.get("printer_id"))  # type: ignore[arg-type]
        if coord is None:
            _LOGGER.debug("Dropping %s for unknown printer %s", kind, payload.get("printer_id"))
            return
        if kind == "printer.status" and isinstance(payload.get("status"), dict):
            coord.apply_snapshot(payload["status"])
        elif kind == "printer.delta" and isinstance(payload.get("patch"), dict):
            coord.apply_delta(payload["patch"])
