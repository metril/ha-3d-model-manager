"""Tests for the long-lived SSE EventStream."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock

import pytest
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from custom_components.tdmm.api import TdmmApiClient
from custom_components.tdmm.coordinator import PrinterCoordinator, TdmmHub
from custom_components.tdmm.models import PingResult, PrinterInfo
from custom_components.tdmm.sse import EventStream, next_backoff

from .conftest import setup_entry

if TYPE_CHECKING:
    from collections.abc import Callable

    from homeassistant.core import HomeAssistant

    from .fake_tdmm import FakeTdmm

FIX = Path(__file__).parent / "fixtures"
STATUS_PATH = "/api/ext/v2/printers/1/status"


def _raw() -> dict[str, Any]:
    return json.loads((FIX / "status_printing.json").read_text())


async def _until(cond: Callable[[], bool], timeout: float = 5.0) -> None:
    async with asyncio.timeout(timeout):
        while not cond():
            await asyncio.sleep(0.005)


class Harness:
    def __init__(self) -> None:
        self.delays: list[float] = []
        self.auth_failed = MagicMock()
        self.connected = MagicMock()
        self.stream: EventStream
        self.hub: TdmmHub
        self.coords: dict[int, PrinterCoordinator]
        self.api: TdmmApiClient

    async def sleep(self, delay: float) -> None:
        self.delays.append(delay)
        await asyncio.sleep(0.01)


async def _make(
    hass: HomeAssistant,
    fake: FakeTdmm,
    *,
    ids: tuple[int, ...] = (1,),
    sock_read: float | None = None,
    rand: Callable[[], float] = lambda: 0.5,
    **kw: Any,
) -> Harness:
    h = Harness()
    entry = await setup_entry(hass, fake, printer_ids=ids)
    h.api = TdmmApiClient(async_get_clientsession(hass), fake.url, "key")
    if sock_read is not None:
        h.api.sse_sock_read = sock_read
    h.hub = TdmmHub(h.api, PingResult(key_id=1, scopes=frozenset({"read"})))
    h.coords = {i: PrinterCoordinator(hass, entry, h.hub, PrinterInfo(id=i, name=f"P{i}")) for i in ids}
    kw.setdefault("snapshot_timeout", 10.0)
    h.stream = EventStream(
        hass,
        entry,
        h.hub,
        h.coords,
        on_auth_failed=h.auth_failed,
        on_connected=h.connected,
        sleep=h.sleep,
        rand=rand,
        **kw,
    )
    return h


@pytest.fixture
async def started(hass: HomeAssistant, fake_tdmm: FakeTdmm):
    """Factory: build + start a stream; always stopped at teardown."""
    made: list[Harness] = []

    async def factory(**kw: Any) -> Harness:
        h = await _make(hass, fake_tdmm, **kw)
        made.append(h)
        h.stream.start()
        return h

    yield factory
    for h in made:
        await h.stream.stop()


async def test_snapshot_on_connect_populates(fake_tdmm, started) -> None:
    fake_tdmm.statuses[1] = _raw()
    h = await started()
    await _until(lambda: h.coords[1].data is not None)
    assert h.coords[1].data.mc_percent == 42
    assert h.hub.connected is True
    assert h.stream.running is True
    assert h.stream.stats.connects == 1


async def test_delta_updates(fake_tdmm, started) -> None:
    fake_tdmm.statuses[1] = _raw()
    h = await started()
    await _until(lambda: h.coords[1].data is not None)
    await fake_tdmm.push("printer.delta", {"printer_id": 1, "patch": {"mc_percent": 50}})
    await _until(lambda: h.coords[1].data.mc_percent == 50)


async def test_identical_status_no_listener_call(fake_tdmm, started) -> None:
    fake_tdmm.statuses[1] = _raw()
    h = await started()
    await _until(lambda: h.coords[1].data is not None)
    cb = MagicMock()
    h.coords[1].async_add_listener(cb)
    await fake_tdmm.push("printer.status", {"printer_id": 1, "status": _raw()})
    await fake_tdmm.push("printer.delta", {"printer_id": 1, "patch": {"mc_percent": 42}})
    await fake_tdmm.push("printer.delta", {"printer_id": 1, "patch": {"mc_percent": 43}})
    await _until(lambda: h.coords[1].data.mc_percent == 43)
    assert cb.call_count == 1


async def test_delta_before_snapshot_ignored(fake_tdmm, started) -> None:
    fake_tdmm.snapshot_on_connect = False
    h = await started()
    await _until(lambda: h.hub.connected)
    await fake_tdmm.push("printer.delta", {"printer_id": 1, "patch": {"mc_percent": 50}})
    await _until(lambda: h.stream.stats.events == 1)
    assert h.coords[1].raw is None
    assert h.coords[1].data is None
    assert h.stream.running


async def test_unknown_printer_dropped(fake_tdmm, started) -> None:
    fake_tdmm.snapshot_on_connect = False
    h = await started()
    await _until(lambda: h.hub.connected)
    await fake_tdmm.push("printer.status", {"printer_id": 99, "status": _raw()})
    await fake_tdmm.push("printer.delta", {"printer_id": 99, "patch": {"a": 1}})
    await fake_tdmm.push("printer.status", {"printer_id": 1, "status": _raw()})
    await _until(lambda: h.coords[1].data is not None)
    assert list(h.coords) == [1]
    assert h.stream.running


async def test_fallback_status_after_timeout(fake_tdmm, started) -> None:
    fake_tdmm.snapshot_on_connect = False
    fake_tdmm.statuses[1] = _raw()
    h = await started(snapshot_timeout=0.05)
    await _until(lambda: h.connected.call_count == 1)
    assert h.coords[1].data.mc_percent == 42
    assert fake_tdmm.requests[STATUS_PATH] == 1


async def test_fallback_404_is_tolerated(fake_tdmm, started) -> None:
    fake_tdmm.snapshot_on_connect = False
    h = await started(snapshot_timeout=0.05)
    await _until(lambda: h.connected.call_count == 1)
    assert h.coords[1].raw is None
    assert h.stream.running


async def test_no_status_calls_when_snapshot_arrives(fake_tdmm, started) -> None:
    fake_tdmm.statuses[1] = _raw()
    h = await started(snapshot_timeout=0.05)
    await _until(lambda: h.connected.call_count == 1)
    assert fake_tdmm.requests[STATUS_PATH] == 0


async def test_disconnect_marks_unavailable_then_reconnects(fake_tdmm, started) -> None:
    fake_tdmm.statuses[1] = _raw()
    h = await started()
    seen: list[bool] = []
    h.coords[1].async_add_listener(lambda: seen.append(h.coords[1].data is None))
    await _until(lambda: h.coords[1].data is not None)
    await fake_tdmm.drop_streams()
    await _until(lambda: h.stream.stats.connects == 2 and h.coords[1].data is not None)
    assert True in seen  # went unavailable in between
    assert h.stream.stats.disconnects == 1
    assert h.hub.connected is True
    assert h.delays == [1.0]


async def test_sock_read_timeout_reconnects_single_stream(fake_tdmm, started) -> None:
    fake_tdmm.snapshot_on_connect = False
    h = await started(sock_read=0.2)
    await _until(lambda: h.stream.stats.connects >= 2, timeout=10)
    assert fake_tdmm.max_event_streams == 1
    assert h.stream.stats.disconnects >= 1
    assert h.stream.stats.last_error is not None


async def test_403_events_backs_off(fake_tdmm, started) -> None:
    fake_tdmm.events_status = 403
    h = await started()
    await _until(lambda: len(h.delays) >= 3)
    assert h.delays[:3] == [1.0, 2.0, 4.0]
    assert h.stream.running
    h.auth_failed.assert_not_called()


def test_backoff_sequence_and_cap() -> None:
    seq = [next_backoff(a, None, lambda: 0.5) for a in range(9)]
    assert seq == [1, 2, 4, 8, 16, 32, 60, 60, 60]
    assert next_backoff(1000, None, lambda: 0.5) == 60


def test_backoff_clamped_after_jitter() -> None:
    for attempt in (0, 3, 10):
        for retry in (None, 5000, 70000):
            floor = (retry or 0) / 1000
            for r in (0.0, 1.0):
                got = next_backoff(attempt, retry, lambda r=r: r)
                assert max(floor, 0) <= got <= 60 or (floor > 60 and got == 60)
    assert next_backoff(0, 5000, lambda: 0.0) == 5.0
    assert next_backoff(10, None, lambda: 1.0) == 60
    assert next_backoff(0, None, lambda: 0.0) == pytest.approx(0.8)


async def test_retry_field_floor(fake_tdmm, started) -> None:
    fake_tdmm.snapshot_on_connect = False
    h = await started()
    await _until(lambda: h.hub.connected)
    await fake_tdmm.push_raw(b"retry: 5000\n\n")
    await fake_tdmm.drop_streams()
    await _until(lambda: len(h.delays) >= 1)
    assert h.delays[0] == 5.0


async def test_identical_snapshot_after_reconnect_notifies(fake_tdmm, started) -> None:
    fake_tdmm.statuses[1] = _raw()
    h = await started()
    available: list[bool] = []
    h.coords[1].async_add_listener(lambda: available.append(h.coords[1].data is not None))
    await _until(lambda: h.coords[1].data is not None)
    await fake_tdmm.drop_streams()
    await _until(lambda: h.stream.stats.connects == 2 and available[-1:] == [True] and available.count(True) >= 2)
    assert False in available


async def test_backoff_resets_after_stable(fake_tdmm, started) -> None:
    fake_tdmm.snapshot_on_connect = False
    h = await started(stable_after=0.15)
    await _until(lambda: h.hub.connected)
    await fake_tdmm.drop_streams()  # unstable
    await _until(lambda: h.stream.stats.connects == 2)
    await fake_tdmm.drop_streams()  # unstable
    await _until(lambda: h.stream.stats.connects == 3)
    await asyncio.sleep(0.25)  # stable
    await fake_tdmm.drop_streams()
    await _until(lambda: len(h.delays) == 3)
    assert h.delays == [1.0, 2.0, 1.0]


async def test_401_stops_and_calls_auth_failed(fake_tdmm, started) -> None:
    fake_tdmm.events_status = 401
    h = await started()
    await _until(lambda: not h.stream.running)
    h.auth_failed.assert_called_once()
    assert fake_tdmm.requests["/api/events"] == 1
    assert h.delays == []


async def test_print_job_updated_fires_bus_event(hass, fake_tdmm, started) -> None:
    fake_tdmm.snapshot_on_connect = False
    events: list[Any] = []
    hass.bus.async_listen("tdmm_print_job_updated", events.append)
    h = await started()
    await _until(lambda: h.hub.connected)
    await fake_tdmm.push("print_job.updated", {"printer_id": 1, "job": {"id": 7}})
    await _until(lambda: len(events) == 1)
    assert events[0].data["printer_id"] == 1
    assert events[0].data["job"] == {"id": 7}
    assert events[0].data["entry_id"] == h.stream._entry.entry_id


async def test_bare_data_events_dispatch(fake_tdmm, started) -> None:
    fake_tdmm.snapshot_on_connect = False
    h = await started()
    await _until(lambda: h.hub.connected)
    await fake_tdmm.push("printer.status", {"printer_id": 1, "status": _raw()}, named=False)
    await _until(lambda: h.coords[1].data is not None)


async def test_stop_cancels_task(fake_tdmm, started) -> None:
    fake_tdmm.statuses[1] = _raw()
    h = await started()
    await _until(lambda: h.hub.connected)
    task = h.stream._task
    await h.stream.stop()
    assert task is not None and task.done()
    assert not h.stream.running
    assert h.hub.connected is False
    await _until(lambda: fake_tdmm.open_event_streams == 0)


async def test_ha_stop_cancels_task(hass, fake_tdmm, started) -> None:
    h = await started()
    await _until(lambda: h.hub.connected)
    task = h.stream._task
    hass.bus.async_fire(EVENT_HOMEASSISTANT_STOP)
    await _until(lambda: task.done())
    assert not h.stream.running


async def test_malformed_printer_id_does_not_kill_stream(fake_tdmm, started) -> None:
    fake_tdmm.snapshot_on_connect = False
    h = await started()
    await _until(lambda: h.hub.connected)
    await fake_tdmm.push("printer.status", {"printer_id": [1], "status": _raw()})
    await fake_tdmm.push("printer.delta", {"printer_id": {}, "patch": {"a": 1}})
    await fake_tdmm.push("printer.status", {"printer_id": 1, "status": _raw()})
    await _until(lambda: h.coords[1].data is not None)
    assert h.stream.running
    assert h.stream.stats.connects == 1


async def test_listener_exception_does_not_kill_stream(fake_tdmm, started) -> None:
    fake_tdmm.statuses[1] = _raw()
    h = await started()
    await _until(lambda: h.coords[1].data is not None)

    def boom() -> None:
        raise RuntimeError("listener")

    h.coords[1].async_add_listener(boom)
    await fake_tdmm.push("printer.delta", {"printer_id": 1, "patch": {"mc_percent": 50}})
    await _until(lambda: h.coords[1].raw["mc_percent"] == 50)
    await fake_tdmm.push("printer.delta", {"printer_id": 1, "patch": {"mc_percent": 51}})
    await _until(lambda: h.coords[1].raw["mc_percent"] == 51)
    assert h.stream.running
    assert h.stream.stats.connects == 1


async def test_on_connected_exception_does_not_kill_stream(fake_tdmm, started) -> None:
    fake_tdmm.snapshot_on_connect = False
    h = await started(snapshot_timeout=0.05)
    h.connected.side_effect = RuntimeError("cb")
    await _until(lambda: h.connected.call_count == 1)
    await fake_tdmm.drop_streams()
    await _until(lambda: h.stream.stats.connects == 2)
    assert h.stream.running


async def test_stop_during_fallback_wait_does_not_reconnect(hass, fake_tdmm, monkeypatch) -> None:
    fake_tdmm.snapshot_on_connect = False
    h = await _make(hass, fake_tdmm, snapshot_timeout=30.0)
    cancelling = asyncio.Event()

    async def slow_fallback(resp: Any) -> None:
        try:
            await asyncio.sleep(30)
        except asyncio.CancelledError:
            cancelling.set()
            await asyncio.sleep(0.2)  # slow cleanup keeps the stream task awaiting the fallback
            raise

    monkeypatch.setattr(h.stream, "_fallback", slow_fallback)
    h.stream.start()
    await _until(lambda: h.hub.connected)
    await fake_tdmm.drop_streams()
    await asyncio.wait_for(cancelling.wait(), 5)
    async with asyncio.timeout(3):
        await h.stream.stop()
    assert h.stream.stats.connects == 1
    assert not h.stream.running
    assert fake_tdmm.requests["/api/events"] == 1


async def test_fallback_401_calls_auth_failed_once(fake_tdmm, started) -> None:
    fake_tdmm.snapshot_on_connect = False
    fake_tdmm.overrides["status[1]"] = (401, {})
    h = await started(snapshot_timeout=0.05)
    await _until(lambda: not h.stream.running)
    await asyncio.sleep(0.1)
    h.auth_failed.assert_called_once()
    h.connected.assert_not_called()
    assert fake_tdmm.requests["/api/events"] == 1


async def test_listener_exception_on_disconnect_does_not_kill_stream(fake_tdmm, started) -> None:
    fake_tdmm.statuses[1] = _raw()
    h = await started()
    await _until(lambda: h.coords[1].data is not None)

    def boom() -> None:
        raise RuntimeError("listener")

    h.coords[1].async_add_listener(boom)
    await fake_tdmm.drop_streams()
    await _until(lambda: h.stream.stats.connects == 2)
    await fake_tdmm.push("printer.delta", {"printer_id": 1, "patch": {"mc_percent": 77}})
    await _until(lambda: h.coords[1].raw is not None and h.coords[1].raw["mc_percent"] == 77)
    assert h.stream.running
