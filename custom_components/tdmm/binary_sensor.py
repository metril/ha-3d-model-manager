"""Binary sensors for 3DMM printers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
    BinarySensorEntityDescription,
)

from .entity import TdmmEntity, TdmmEntityDescription

if TYPE_CHECKING:
    from collections.abc import Callable

    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

    from .coordinator import PrinterCoordinator, TdmmConfigEntry
    from .models import PrinterStatus

PARALLEL_UPDATES = 0


@dataclass(frozen=True, kw_only=True)
class TdmmBinarySensorDescription(TdmmEntityDescription, BinarySensorEntityDescription):
    value_fn: Callable[[PrinterStatus], bool]


BINARY_SENSOR_DESCRIPTIONS: tuple[TdmmBinarySensorDescription, ...] = (
    TdmmBinarySensorDescription(
        key="online",
        device_class=BinarySensorDeviceClass.CONNECTIVITY,
        requires_online=False,
        value_fn=lambda d: d.online,
    ),
    TdmmBinarySensorDescription(
        key="door_open",
        device_class=BinarySensorDeviceClass.DOOR,
        exists_fn=lambda p: p.capabilities.door,
        value_fn=lambda d: bool(d.door_open),
    ),
    TdmmBinarySensorDescription(
        key="printing",
        device_class=BinarySensorDeviceClass.RUNNING,
        value_fn=lambda d: d.gcode_state in {"RUNNING", "PREPARE"},
    ),
    TdmmBinarySensorDescription(
        key="hms_active",
        device_class=BinarySensorDeviceClass.PROBLEM,
        value_fn=lambda d: len(d.hms) > 0,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant, entry: TdmmConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    async_add_entities(
        TdmmBinarySensor(coord, desc)
        for coord in entry.runtime_data.coordinators.values()
        for desc in BINARY_SENSOR_DESCRIPTIONS
        if desc.exists_fn(coord.printer)
    )


class TdmmBinarySensor(TdmmEntity, BinarySensorEntity):
    entity_description: TdmmBinarySensorDescription

    def __init__(self, coordinator: PrinterCoordinator, description: TdmmBinarySensorDescription) -> None:
        super().__init__(coordinator, description)

    @property
    def is_on(self) -> bool | None:
        data = self.coordinator.data
        return None if data is None else self.entity_description.value_fn(data)
