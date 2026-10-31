"""Pure incremental Server-Sent Events parser (WHATWG event-stream rules)."""

from __future__ import annotations

import codecs
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import Mapping


@dataclass(frozen=True, slots=True)
class SseEvent:
    """A dispatched SSE event."""

    event: str
    data: str
    id: str | None
    retry_ms: int | None


class SseParser:
    """Incremental parser; feed raw bytes, get completed events."""

    def __init__(self) -> None:
        self.retry_ms: int | None = None
        self._decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        self._buf = ""
        self._prev_cr = False
        self._started = False
        self._reset_block()

    def _reset_block(self) -> None:
        self._event = ""
        self._data: list[str] = []
        self._id: str | None = None
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
        if text:
            self._prev_cr = text.endswith("\r")
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        self._buf += text
        *lines, self._buf = self._buf.split("\n")
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
