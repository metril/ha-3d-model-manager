"""Typed models for 3DMM API payloads and RFC 7386 merge patch."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, fields
from typing import TYPE_CHECKING, Any, Self

if TYPE_CHECKING:
    from collections.abc import Mapping


def merge_patch(target: Any, patch: Any) -> Any:
    """Apply an RFC 7386 JSON merge patch. Mutates ``target`` in place when both are dicts."""
    if not isinstance(patch, dict):
        return patch
    if not isinstance(target, dict):
        target = {}
    for key, value in patch.items():
        if value is None:
            target.pop(key, None)
        else:
            target[key] = merge_patch(target.get(key), value)
    return target


def fingerprint(raw: Mapping[str, Any]) -> str:
    """sha1 of the canonical JSON form of ``raw``."""
    return hashlib.sha1(json.dumps(raw, sort_keys=True, separators=(",", ":")).encode()).hexdigest()  # noqa: S324


def _plain(cls: type, d: Mapping[str, Any], skip: tuple[str, ...] = ()) -> dict[str, Any]:
    return {f.name: d.get(f.name) for f in fields(cls) if f.name not in skip and f.name in d}


@dataclass(frozen=True, slots=True)
class Tray:
    slot: int
    ams_unit: int | None = None
    tray: int | None = None
    color: str | None = None
    material: str | None = None
    tray_type: str | None = None
    remain_pct: int | None = None
    sub_brand: str | None = None
    tray_uuid: str | None = None

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> Self:
        return cls(**_plain(cls, d))


@dataclass(frozen=True, slots=True)
class AmsUnit:
    id: int
    humidity: float | None = None
    temp: float | None = None
    serial: str | None = None
    label: str | None = None

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> Self:
        return cls(**_plain(cls, d))


@dataclass(frozen=True, slots=True)
class HmsEntry:
    attr: int
    code: int

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> Self:
        return cls(**_plain(cls, d))


@dataclass(frozen=True, slots=True)
class PrintJob:
    print_job_id: int | None = None
    file_id: int | None = None
    model_id: int | None = None
    model_name: str | None = None
    revision_id: int | None = None
    plate: int | None = None
    started_at: str | None = None

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> Self:
        return cls(**_plain(cls, d))


@dataclass(frozen=True, slots=True)
class Capabilities:
    chamber_temp: bool = False
    door: bool = False
    aux_fan: bool = False
    chamber_fan: bool = False
    camera: str = "none"

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> Self:
        kw = {k: v for k, v in _plain(cls, d).items() if v is not None}
        return cls(**kw)


@dataclass(frozen=True, slots=True)
class PrinterInfo:
    id: int
    name: str
    serial: str | None = None
    model: str | None = None
    capabilities: Capabilities = field(default_factory=Capabilities)

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> Self:
        return cls(
            id=d["id"],
            name=d["name"],
            serial=d.get("serial"),
            model=d.get("model"),
            capabilities=Capabilities.from_dict(d.get("capabilities") or {}),
        )


@dataclass(frozen=True, slots=True)
class PingResult:
    key_id: int
    label: str | None = None
    scopes: frozenset[str] = frozenset()
    printer_ids: tuple[int, ...] | None = None  # None means all printers

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> Self:
        key = d.get("key") or {}
        ids = key.get("printer_ids")
        return cls(
            key_id=key["id"],
            label=key.get("label"),
            scopes=frozenset(key.get("scopes") or ()),
            printer_ids=None if ids is None else tuple(ids),
        )


def _opt(factory: Any, v: Mapping[str, Any] | None) -> Any:
    return None if v is None else factory.from_dict(v)


@dataclass(frozen=True, slots=True)
class PrinterStatus:
    online: bool = False
    gcode_state: str | None = None
    mc_percent: int | None = None
    layer_num: int | None = None
    total_layer_num: int | None = None
    mc_remaining_time: int | None = None
    print_error: int | None = None
    nozzle_temper: float | None = None
    nozzle_target: float | None = None
    bed_temper: float | None = None
    bed_target: float | None = None
    chamber_temper: float | None = None
    chamber_target: float | None = None
    subtask_name: str | None = None
    wifi_signal: str | None = None
    trays: tuple[Tray, ...] = ()
    fan_part_pct: int | None = None
    fan_aux_pct: int | None = None
    fan_chamber_pct: int | None = None
    light_on: bool | None = None
    speed_level: int | None = None
    stage: str | None = None
    hms: tuple[HmsEntry, ...] = ()
    nozzle_type: str | None = None
    nozzle_mm: float | None = None
    firmware_ota: str | None = None
    ams_units: tuple[AmsUnit, ...] = ()
    ext_tray: Tray | None = None
    print_thumbnail_key: str | None = None
    door_open: bool | None = None
    tray_now: int | None = None
    active_tray: Tray | None = None
    print_job: PrintJob | None = None

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> Self:
        skip = ("trays", "hms", "ams_units", "ext_tray", "active_tray", "print_job", "firmware_ota")
        kw = _plain(cls, d, skip)
        if kw.get("online") is None:
            kw["online"] = False
        return cls(
            **kw,
            trays=tuple(Tray.from_dict(t) for t in d.get("trays") or ()),
            hms=tuple(HmsEntry.from_dict(h) for h in d.get("hms") or ()),
            ams_units=tuple(AmsUnit.from_dict(u) for u in d.get("ams_units") or ()),
            ext_tray=_opt(Tray, d.get("ext_tray")),
            active_tray=_opt(Tray, d.get("active_tray")),
            print_job=_opt(PrintJob, d.get("print_job")),
            firmware_ota=(d.get("firmware") or {}).get("ota"),
        )

    def current_tray(self) -> Tray | None:
        if self.active_tray is not None:
            return self.active_tray
        if self.tray_now is None:
            return None
        if self.tray_now == 254:
            return self.ext_tray
        return next((t for t in self.trays if t.slot == self.tray_now), None)
