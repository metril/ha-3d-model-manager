"""Temperature targets for 3DMM printers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from homeassistant.components.number import NumberDeviceClass, NumberEntity, NumberEntityDescription, NumberMode
from homeassistant.const import UnitOfTemperature

from .entity import TdmmEntity, TdmmEntityDescription

if TYPE_CHECKING:
    from collections.abc import Callable

    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

    from .coordinator import TdmmConfigEntry
    from .models import PrinterStatus

PARALLEL_UPDATES = 1


@dataclass(frozen=True, kw_only=True)
class TdmmNumberDescription(TdmmEntityDescription, NumberEntityDescription):
    target: Literal["nozzle", "bed"]
    value_fn: Callable[[PrinterStatus], float | None]


NUMBER_DESCRIPTIONS: tuple[TdmmNumberDescription, ...] = (
    TdmmNumberDescription(
        key="nozzle_target_temperature",
        target="nozzle",
        native_min_value=0,
        native_max_value=350,
        native_step=1,
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        device_class=NumberDeviceClass.TEMPERATURE,
        mode=NumberMode.BOX,
        value_fn=lambda d: d.nozzle_target,
    ),
    TdmmNumberDescription(
        key="bed_target_temperature",
        target="bed",
        native_min_value=0,
        native_max_value=120,
        native_step=1,
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        device_class=NumberDeviceClass.TEMPERATURE,
        mode=NumberMode.BOX,
        value_fn=lambda d: d.bed_target,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant, entry: TdmmConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    async_add_entities(
        TdmmNumber(coord, desc)
        for coord in entry.runtime_data.coordinators.values()
        for desc in NUMBER_DESCRIPTIONS
        if desc.exists_fn(coord.printer)
    )


class TdmmNumber(TdmmEntity, NumberEntity):
    entity_description: TdmmNumberDescription

    @property
    def native_value(self) -> float | None:
        data = self.coordinator.data
        return None if data is None else self.entity_description.value_fn(data)

    async def async_set_native_value(self, value: float) -> None:
        body = {"target": self.entity_description.target, "value": int(value)}
        await self._async_call(self.coordinator.hub.api.control(self.coordinator.printer.id, "temperature", body))
