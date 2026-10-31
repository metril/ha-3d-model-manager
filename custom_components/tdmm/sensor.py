"""Printer sensors for 3DMM."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.const import (
    PERCENTAGE,
    SIGNAL_STRENGTH_DECIBELS_MILLIWATT,
    EntityCategory,
    UnitOfLength,
    UnitOfTemperature,
    UnitOfTime,
)
from homeassistant.util import dt as dt_util

from .entity import TdmmEntity, TdmmEntityDescription, ams_device_info
from .models import AmsUnit

if TYPE_CHECKING:
    from collections.abc import Callable, Mapping
    from typing import Any

    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.device_registry import DeviceInfo
    from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
    from homeassistant.helpers.typing import StateType

    from .coordinator import PrinterCoordinator, TdmmConfigEntry
    from .models import PrinterStatus, Tray

PARALLEL_UPDATES = 0

PRINT_STATES = ["idle", "prepare", "running", "pause", "finish", "failed", "slicing", "unknown"]
SPEED_PROFILES = ["silent", "standard", "sport", "ludicrous"]
_ACTIVE_STATES = {"RUNNING", "PAUSE", "PREPARE"}
_INT_RE = re.compile(r"-?\d+")


@dataclass(frozen=True, kw_only=True)
class TdmmSensorEntityDescription(SensorEntityDescription, TdmmEntityDescription):
    value_fn: Callable[[PrinterStatus], StateType | datetime]


def _print_state(d: PrinterStatus) -> str | None:
    if d.gcode_state is None:
        return None
    state = d.gcode_state.lower()
    return state if state in PRINT_STATES else "unknown"


def _speed_profile(d: PrinterStatus) -> str | None:
    if d.speed_level is None or not 1 <= d.speed_level <= len(SPEED_PROFILES):
        return None
    return SPEED_PROFILES[d.speed_level - 1]


def _wifi(d: PrinterStatus) -> int | None:
    if d.wifi_signal is None:
        return None
    match = _INT_RE.search(str(d.wifi_signal))
    return int(match.group()) if match else None


def _model(d: PrinterStatus) -> str | None:
    return (d.print_job.model_name if d.print_job else None) or d.subtask_name


def _active(attr: str) -> Callable[[PrinterStatus], str | None]:
    def fn(d: PrinterStatus) -> str | None:
        tray = d.current_tray()
        return getattr(tray, attr) if tray else None

    return fn


def _ext(attr: str) -> Callable[[PrinterStatus], str | None]:
    def fn(d: PrinterStatus) -> str | None:
        return getattr(d.ext_tray, attr) if d.ext_tray else None

    return fn


_TEMP = {
    "device_class": SensorDeviceClass.TEMPERATURE,
    "native_unit_of_measurement": UnitOfTemperature.CELSIUS,
    "state_class": SensorStateClass.MEASUREMENT,
}

SENSOR_DESCRIPTIONS: tuple[TdmmSensorEntityDescription, ...] = (
    TdmmSensorEntityDescription(
        key="print_state",
        device_class=SensorDeviceClass.ENUM,
        options=PRINT_STATES,
        value_fn=_print_state,
    ),
    TdmmSensorEntityDescription(
        key="progress",
        native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda d: d.mc_percent,
    ),
    TdmmSensorEntityDescription(
        key="remaining_time",
        device_class=SensorDeviceClass.DURATION,
        native_unit_of_measurement=UnitOfTime.MINUTES,
        value_fn=lambda d: d.mc_remaining_time,
    ),
    TdmmSensorEntityDescription(
        key="end_time",
        device_class=SensorDeviceClass.TIMESTAMP,
        value_fn=lambda d: None,  # replaced by TdmmEndTimeSensor
    ),
    TdmmSensorEntityDescription(key="current_layer", value_fn=lambda d: d.layer_num),
    TdmmSensorEntityDescription(key="total_layers", value_fn=lambda d: d.total_layer_num),
    TdmmSensorEntityDescription(key="nozzle_temperature", value_fn=lambda d: d.nozzle_temper, **_TEMP),
    TdmmSensorEntityDescription(key="nozzle_target_temperature", value_fn=lambda d: d.nozzle_target, **_TEMP),
    TdmmSensorEntityDescription(key="bed_temperature", value_fn=lambda d: d.bed_temper, **_TEMP),
    TdmmSensorEntityDescription(key="bed_target_temperature", value_fn=lambda d: d.bed_target, **_TEMP),
    TdmmSensorEntityDescription(
        key="chamber_temperature",
        exists_fn=lambda p: p.capabilities.chamber_temp,
        value_fn=lambda d: d.chamber_temper,
        **_TEMP,
    ),
    TdmmSensorEntityDescription(key="stage", value_fn=lambda d: d.stage),
    TdmmSensorEntityDescription(
        key="speed_profile",
        device_class=SensorDeviceClass.ENUM,
        options=SPEED_PROFILES,
        value_fn=_speed_profile,
    ),
    TdmmSensorEntityDescription(
        key="wifi_signal",
        entity_registry_enabled_default=False,
        device_class=SensorDeviceClass.SIGNAL_STRENGTH,
        native_unit_of_measurement=SIGNAL_STRENGTH_DECIBELS_MILLIWATT,
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=_wifi,
    ),
    TdmmSensorEntityDescription(key="current_model", value_fn=_model),
    TdmmSensorEntityDescription(
        key="print_error",
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda d: d.print_error or None,
    ),
    TdmmSensorEntityDescription(key="active_filament_material", value_fn=_active("material")),
    TdmmSensorEntityDescription(key="active_filament_color", value_fn=_active("color")),
    TdmmSensorEntityDescription(
        key="firmware_version",
        entity_category=EntityCategory.DIAGNOSTIC,
        entity_registry_enabled_default=False,
        value_fn=lambda d: d.firmware_ota,
    ),
    TdmmSensorEntityDescription(
        key="nozzle_type", entity_category=EntityCategory.DIAGNOSTIC, value_fn=lambda d: d.nozzle_type
    ),
    TdmmSensorEntityDescription(
        key="nozzle_diameter",
        entity_category=EntityCategory.DIAGNOSTIC,
        device_class=SensorDeviceClass.DISTANCE,
        native_unit_of_measurement=UnitOfLength.MILLIMETERS,
        value_fn=lambda d: d.nozzle_mm,
    ),
    TdmmSensorEntityDescription(key="external_spool_material", value_fn=_ext("material")),
    TdmmSensorEntityDescription(key="external_spool_color", value_fn=_ext("color")),
)
PRINTER_SENSORS = SENSOR_DESCRIPTIONS


def _none(_d: PrinterStatus) -> None:
    """Placeholder value_fn: AMS sensors resolve their own tray or unit."""
    return None


AMS_DESCRIPTIONS: tuple[TdmmSensorEntityDescription, ...] = (
    TdmmSensorEntityDescription(key="tray_material", value_fn=_none),
    TdmmSensorEntityDescription(key="tray_color", value_fn=_none),
    TdmmSensorEntityDescription(
        key="tray_remaining",
        native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=_none,
    ),
    TdmmSensorEntityDescription(
        key="ams_humidity",
        device_class=SensorDeviceClass.HUMIDITY,
        native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=_none,
    ),
    TdmmSensorEntityDescription(key="ams_temperature", value_fn=_none, **_TEMP),
)
_AMS_BY_KEY = {d.key: d for d in AMS_DESCRIPTIONS}
_TRAY_FIELDS = {"tray_material": "material", "tray_color": "color", "tray_remaining": "remain_pct"}


async def async_setup_entry(
    hass: HomeAssistant, entry: TdmmConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    async_add_entities(
        (TdmmEndTimeSensor if desc.key == "end_time" else TdmmSensor)(coord, desc)
        for coord in entry.runtime_data.coordinators.values()
        for desc in SENSOR_DESCRIPTIONS
        if desc.exists_fn(coord.printer)
    )
    for coord in entry.runtime_data.coordinators.values():
        entry.async_on_unload(coord.async_add_listener(_ams_listener(coord, async_add_entities)))


def _ams_listener(coord: PrinterCoordinator, async_add_entities: AddConfigEntryEntitiesCallback) -> Callable[[], None]:
    known_keys: set[str] = set()

    def _add_new() -> None:
        data = coord.data
        if data is None:
            return
        new: list[TdmmSensor] = []
        unit_ids = {u.id for u in data.ams_units} | {t.ams_unit for t in data.trays if t.ams_unit is not None}
        for unit_id in sorted(unit_ids):
            for key in ("ams_humidity", "ams_temperature"):
                if f"ams{unit_id}_{key.removeprefix('ams_')}" not in known_keys:
                    known_keys.add(f"ams{unit_id}_{key.removeprefix('ams_')}")
                    new.append(TdmmAmsUnitSensor(coord, _AMS_BY_KEY[key], unit_id))
        for tray in data.trays:
            if tray.ams_unit is None or tray.tray is None:
                continue
            for key in _TRAY_FIELDS:
                k = f"ams{tray.ams_unit}_tray{tray.tray}_{key.removeprefix('tray_')}"
                if k not in known_keys:
                    known_keys.add(k)
                    new.append(TdmmAmsTraySensor(coord, _AMS_BY_KEY[key], tray.ams_unit, tray.tray))
        if new:
            async_add_entities(new)

    _add_new()
    return _add_new


class TdmmSensor(TdmmEntity, SensorEntity):
    entity_description: TdmmSensorEntityDescription

    def __init__(self, coordinator: PrinterCoordinator, description: TdmmSensorEntityDescription) -> None:
        super().__init__(coordinator, description)

    @property
    def native_value(self) -> StateType | datetime:
        data = self.coordinator.data
        return None if data is None else self.entity_description.value_fn(data)


class TdmmEndTimeSensor(TdmmSensor):
    """Estimated end time, recomputed only when the remaining minutes change."""

    _cache: tuple[int, datetime] | None = None

    @property
    def native_value(self) -> datetime | None:
        data = self.coordinator.data
        remaining = None if data is None else data.mc_remaining_time
        if (
            data is None
            or not data.online
            or remaining is None
            or (data.gcode_state or "").upper() not in _ACTIVE_STATES
        ):
            self._cache = None
            return None
        if self._cache is None or self._cache[0] != remaining:
            eta = (dt_util.utcnow() + timedelta(minutes=remaining)).replace(second=0, microsecond=0)
            self._cache = (remaining, eta)
        return self._cache[1]


def _ams_device(coord: PrinterCoordinator, unit_id: int) -> DeviceInfo:
    data = coord.data
    unit = next((u for u in data.ams_units if u.id == unit_id), None) if data else None
    # A unit first seen via trays gets fallback device info that is not updated later.
    return ams_device_info(coord.printer, unit or AmsUnit(id=unit_id))


class TdmmAmsTraySensor(TdmmSensor):
    """One property of one AMS tray."""

    def __init__(
        self, coordinator: PrinterCoordinator, description: TdmmSensorEntityDescription, unit_id: int, tray_id: int
    ) -> None:
        super().__init__(coordinator, description)
        self._unit_id = unit_id
        self._tray_id = tray_id
        self._field = _TRAY_FIELDS[description.key]
        self._attr_unique_id = (
            f"{coordinator.config_entry.entry_id}_{coordinator.printer.id}"
            f"_ams{unit_id}_tray{tray_id}_{description.key.removeprefix('tray_')}"
        )
        self._attr_translation_placeholders = {"slot": str(tray_id + 1)}

    def _tray(self) -> Tray | None:
        data = self.coordinator.data
        if data is None:
            return None
        return next((t for t in data.trays if t.ams_unit == self._unit_id and t.tray == self._tray_id), None)

    @property
    def available(self) -> bool:
        return super().available and self._tray() is not None

    @property
    def native_value(self) -> StateType:
        tray = self._tray()
        if tray is None:
            return None
        value = getattr(tray, self._field)
        if self._field == "remain_pct" and (value is None or value < 0):
            return None  # 3DMM/Bambu report -1 for unknown
        return value

    @property
    def device_info(self) -> DeviceInfo:
        return _ams_device(self.coordinator, self._unit_id)

    @property
    def extra_state_attributes(self) -> Mapping[str, Any]:
        return {"ams_unit": self._unit_id, "slot": self._tray_id + 1}


class TdmmAmsUnitSensor(TdmmSensor):
    """Humidity or temperature of one AMS unit."""

    def __init__(self, coordinator: PrinterCoordinator, description: TdmmSensorEntityDescription, unit_id: int) -> None:
        super().__init__(coordinator, description)
        self._unit_id = unit_id
        suffix = description.key.removeprefix("ams_")
        self._attr_unique_id = f"{coordinator.config_entry.entry_id}_{coordinator.printer.id}_ams{unit_id}_{suffix}"

    @property
    def native_value(self) -> StateType:
        data = self.coordinator.data
        unit = next((u for u in data.ams_units if u.id == self._unit_id), None) if data else None
        if unit is None:
            return None
        return unit.humidity if self.entity_description.key == "ams_humidity" else unit.temp

    @property
    def device_info(self) -> DeviceInfo:
        return _ams_device(self.coordinator, self._unit_id)

    @property
    def extra_state_attributes(self) -> Mapping[str, Any]:
        return {"ams_unit": self._unit_id}
