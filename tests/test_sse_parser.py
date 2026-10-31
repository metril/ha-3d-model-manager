"""Tests for the incremental SSE parser."""

from custom_components.tdmm.sse import SseEvent, SseParser, event_type


def parse(data: bytes, step: int | None = None) -> tuple[list[SseEvent], SseParser]:
    p = SseParser()
    out: list[SseEvent] = []
    if step is None:
        out += p.feed(data)
    else:
        for i in range(0, len(data), step):
            out += p.feed(data[i : i + step])
    return out, p


def test_single_event():
    evs, _ = parse(b"event: foo\nid: 7\ndata: hello\n\n")
    assert evs == [SseEvent("foo", "hello", "7", None)]


def test_multiline_data():
    evs, _ = parse(b"data: a\ndata:  b\ndata\ndata: c\n\n")
    assert evs[0].data == "a\n b\n\nc"
    assert evs[0].event == "message"


def test_comment_ping_ignored():
    evs, _ = parse(b": ping\n\n: x\ndata: 1\n\n")
    assert [e.data for e in evs] == ["1"]


def test_split_across_every_byte_boundary():
    raw = ": ping\r\nevent: a\r\ndata: x\r\ndata: y\r\n\r\ndata: \xc3\xa9\r\rdata: z\n\n".encode("latin-1")
    whole, _ = parse(raw)
    assert whole == [
        SseEvent("a", "x\ny", None, None),
        SseEvent("message", "\xe9", None, None),
        SseEvent("message", "z", None, None),
    ]
    assert parse(raw, 1)[0] == whole


def test_crlf_split_between_chunks():
    p = SseParser()
    assert p.feed(b"data: a\r") == []
    assert [e.data for e in p.feed(b"\n\r")] == ["a"]
    assert p.feed(b"\ndata: b\r") == []
    assert [e.data for e in p.feed(b"\n\r\n")] == ["b"]


def test_utf8_split_across_chunks():
    raw = "data: héllo ☃\n\n".encode()
    evs, _ = parse(raw, 1)
    assert evs[0].data == "héllo ☃"


def test_retry_parsed_and_invalid_retry_ignored():
    evs, p = parse(b"retry: 3000\ndata: x\n\n")
    assert evs[0].retry_ms == 3000 and p.retry_ms == 3000
    evs, p = parse(b"retry: 3s\nretry: -5\nretry:\ndata: x\n\n")
    assert evs[0].retry_ms is None and p.retry_ms is None


def test_retry_only_block_exposes_retry_ms():
    evs, p = parse(b"retry: 5000\n\n")
    assert evs == [] and p.retry_ms == 5000


def test_id_field():
    evs, _ = parse(b"data: a\n\nid: 9\ndata: b\n\n")
    assert [e.id for e in evs] == [None, "9"]


def test_event_type_from_named_event():
    ev = SseEvent("printer.status", "{}", None, None)
    assert event_type(ev, {"type": "other"}) == "printer.status"


def test_event_type_from_data_type():
    ev = SseEvent("message", "{}", None, None)
    assert event_type(ev, {"type": "printer.delta"}) == "printer.delta"
    assert event_type(ev, {}) is None
    assert event_type(ev, {"type": 3}) is None


def test_cr_then_lf_in_separate_chunks():
    p = SseParser()
    out = p.feed(b"data: a\r") + p.feed(b"\n") + p.feed(b"\n")
    assert [e.data for e in out] == ["a"]


def test_id_persists_across_events():
    evs, _ = parse(b"id: 1\ndata: a\n\ndata: b\n\nid: 2\ndata: c\n\nid: x\0y\ndata: d\n\n")
    assert [e.id for e in evs] == ["1", "1", "2", "2"]


def test_line_buffer_cap_resets():
    p = SseParser()
    assert p.feed(b"data: " + b"x" * (2 * 1024 * 1024)) == []
    assert [e.data for e in p.feed(b"\ndata: ok\n\n")] == ["ok"]


def test_data_without_space_and_partial_block_discarded():
    evs, _ = parse(b"data:x\n\ndata: partial\n")
    assert [e.data for e in evs] == ["x"]
