"""Tests for tdmm models and RFC 7386 merge patch."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from custom_components.tdmm.models import (
    PingResult,
    PrinterInfo,
    PrinterStatus,
    Tray,
    fingerprint,
    merge_patch,
)

FIX = Path(__file__).parent / "fixtures"


def load(name: str) -> Any:
    return json.loads((FIX / name).read_text())


# RFC 7386 Appendix A
RFC_CASES = [
    ({"a": "b"}, {"a": "c"}, {"a": "c"}),
    ({"a": "b"}, {"b": "c"}, {"a": "b", "b": "c"}),
    ({"a": "b"}, {"a": None}, {}),
    ({"a": "b", "b": "c"}, {"a": None}, {"b": "c"}),
    ({"a": ["b"]}, {"a": "c"}, {"a": "c"}),
    ({"a": "c"}, {"a": ["b"]}, {"a": ["b"]}),
    ({"a": {"b": "c"}}, {"a": {"b": "d", "c": None}}, {"a": {"b": "d"}}),
    ({"a": [{"b": "c"}]}, {"a": [1]}, {"a": [1]}),
    (["a", "b"], ["c", "d"], ["c", "d"]),
    ({"a": "b"}, ["c"], ["c"]),
    ({"a": "foo"}, None, None),
    ({"a": "foo"}, "bar", "bar"),
    ({"e": None}, {"a": 1}, {"e": None, "a": 1}),
    ([1, 2], {"a": "b", "c": None}, {"a": "b"}),
    ({}, {"a": {"bb": {"ccc": None}}}, {"a": {"bb": {}}}),
]


@pytest.mark.parametrize(("target", "patch", "expected"), RFC_CASES)
def test_merge_patch_rfc7386_appendix_a(target, patch, expected):
    assert merge_patch(copy.deepcopy(target), patch) == expected


def test_merge_patch_mutates_dict_in_place():
    t = {"x": 1}
    assert merge_patch(t, {"a": 1}) is t
    assert t == {"x": 1, "a": 1}


def test_merge_patch_replaces_lists():
    assert merge_patch({"a": [1, 2, 3]}, {"a": [9]}) == {"a": [9]}


def test_fingerprint_key_order_insensitive():
    assert fingerprint({"a": 1, "b": {"c": 2, "d": 3}}) == fingerprint({"b": {"d": 3, "c": 2}, "a": 1})
    assert fingerprint({"a": 1}) != fingerprint({"a": 2})


def test_status_from_dict_ignores_unknown_fields():
    s = PrinterStatus.from_dict({"online": True, "zzz": 1})
    assert s.online is True
    assert s.trays == ()
    assert s.mc_percent is None


def test_status_from_fixture_printing():
    s = PrinterStatus.from_dict(load("status_printing.json"))
    assert isinstance(s.trays, tuple)
    assert all(isinstance(t, Tray) for t in s.trays)
    assert s.trays[0].color == "#FF0000"
    assert s.print_job is not None
    assert s.print_job.model_name == "Benchy"
    assert s.firmware_ota == "01.08.02.00"
    assert s.hms[0].code == 65540
    assert s.ams_units[0].humidity == 18.0
    assert s.ext_tray is not None
    assert s.ext_tray.slot == 254


def test_status_without_active_tray_and_print_job():
    s = PrinterStatus.from_dict(load("status_idle_offline.json"))
    assert s.online is False
    assert s.active_tray is None
    assert s.print_job is None
    assert s.firmware_ota is None


def test_current_tray_prefers_active_then_tray_now_then_ext_254():
    raw = load("status_printing.json")
    s = PrinterStatus.from_dict(raw)
    assert s.current_tray() is s.active_tray

    raw["active_tray"] = None
    raw["tray_now"] = 1
    s = PrinterStatus.from_dict(raw)
    assert s.current_tray() == s.trays[1]

    raw["tray_now"] = 254
    s = PrinterStatus.from_dict(raw)
    assert s.current_tray() is s.ext_tray

    raw["tray_now"] = 99
    assert PrinterStatus.from_dict(raw).current_tray() is None
    raw["tray_now"] = None
    assert PrinterStatus.from_dict(raw).current_tray() is None


def test_ping_null_printer_ids_means_all():
    p = PingResult.from_dict(load("ping.json"))
    assert p.key_id == 4
    assert p.label == "Home Assistant"
    assert p.scopes == frozenset({"read", "control"})
    assert p.printer_ids is None
    q = PingResult.from_dict({"key": {"id": 1, "scopes": ["read"], "printer_ids": [2, 3]}})
    assert q.printer_ids == (2, 3)


def test_printer_info_from_printers_fixture():
    a, b = (PrinterInfo.from_dict(d) for d in load("printers.json"))
    assert (a.id, a.name, a.serial, a.model) == (1, "A1 Mini", "0309DA123456789", "A1 mini")
    assert a.capabilities.aux_fan is True
    assert a.capabilities.camera == "a1"
    assert b.capabilities.door is True
    assert b.capabilities.chamber_temp is True
    assert PrinterInfo.from_dict({"id": 3, "name": "x"}).capabilities.camera == "none"
