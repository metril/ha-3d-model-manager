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

from .entity import TdmmEntity, TdmmEntityDescription

if TYPE_CHECKING:
    from collections.abc import Callable

    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
    from homeassistant.helpers.typing import StateType

    from .coordinator import PrinterCoordinator, TdmmConfigEntry
    from .models import PrinterStatus

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
        device_class=SensorDeviceClass.SIGNAL_STRENGTH,
        native_unit_of_measurement=SIGNAL_STRENGTH_DECIBELS_MILLIWATT,
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=_wifi,
    ),
    TdmmSensorEntityDescription(key="current_model", value_fn=_model),
    TdmmSensorEntityDescription(
        key="print_error", entity_category=EntityCategory.DIAGNOSTIC, value_fn=lambda d: d.print_error
    ),
    TdmmSensorEntityDescription(key="active_filament_material", value_fn=_active("material")),
    TdmmSensorEntityDescription(key="active_filament_color", value_fn=_active("color")),
    TdmmSensorEntityDescription(
        key="firmware_version", entity_category=EntityCategory.DIAGNOSTIC, value_fn=lambda d: d.firmware_ota
    ),
    TdmmSensorEntityDescription(key="nozzle_type", value_fn=lambda d: d.nozzle_type),
    TdmmSensorEntityDescription(
        key="nozzle_diameter",
        device_class=SensorDeviceClass.DISTANCE,
        native_unit_of_measurement=UnitOfLength.MILLIMETERS,
        value_fn=lambda d: d.nozzle_mm,
    ),
    TdmmSensorEntityDescription(key="external_spool_material", value_fn=_ext("material")),
    TdmmSensorEntityDescription(key="external_spool_color", value_fn=_ext("color")),
)
PRINTER_SENSORS = SENSOR_DESCRIPTIONS


async def async_setup_entry(
    hass: HomeAssistant, entry: TdmmConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    async_add_entities(
        (TdmmEndTimeSensor if desc.key == "end_time" else TdmmSensor)(coord, desc)
        for coord in entry.runtime_data.coordinators.values()
        for desc in SENSOR_DESCRIPTIONS
        if desc.exists_fn(coord.printer)
    )


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
        if data is None or remaining is None or data.gcode_state not in _ACTIVE_STATES:
            self._cache = None
            return None
        if self._cache is None or self._cache[0] != remaining:
            eta = (dt_util.utcnow() + timedelta(minutes=remaining)).replace(second=0, microsecond=0)
            self._cache = (remaining, eta)
        return self._cache[1]
