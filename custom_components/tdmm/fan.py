"""Fans for 3DMM printers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from homeassistant.components.fan import FanEntity, FanEntityDescription, FanEntityFeature

from .entity import TdmmEntity, TdmmEntityDescription

if TYPE_CHECKING:
    from collections.abc import Callable

    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

    from .coordinator import TdmmConfigEntry
    from .models import PrinterStatus

PARALLEL_UPDATES = 1


@dataclass(frozen=True, kw_only=True)
class TdmmFanDescription(TdmmEntityDescription, FanEntityDescription):
    fan: str
    pct_fn: Callable[[PrinterStatus], int | None]


FAN_DESCRIPTIONS: tuple[TdmmFanDescription, ...] = (
    TdmmFanDescription(key="part_fan", fan="part", pct_fn=lambda d: d.fan_part_pct),
    TdmmFanDescription(
        key="aux_fan",
        fan="aux",
        exists_fn=lambda p: p.capabilities.aux_fan,
        pct_fn=lambda d: d.fan_aux_pct,
    ),
    TdmmFanDescription(
        key="chamber_fan",
        fan="chamber",
        exists_fn=lambda p: p.capabilities.chamber_fan,
        pct_fn=lambda d: d.fan_chamber_pct,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant, entry: TdmmConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    async_add_entities(
        TdmmFan(coord, desc)
        for coord in entry.runtime_data.coordinators.values()
        for desc in FAN_DESCRIPTIONS
        if desc.exists_fn(coord.printer)
    )


class TdmmFan(TdmmEntity, FanEntity):
    entity_description: TdmmFanDescription
    _attr_supported_features = FanEntityFeature.SET_SPEED | FanEntityFeature.TURN_ON | FanEntityFeature.TURN_OFF

    @property
    def percentage(self) -> int | None:
        data = self.coordinator.data
        return None if data is None else self.entity_description.pct_fn(data)

    async def _set(self, pct: int) -> None:
        body = {"fan": self.entity_description.fan, "pct": pct}
        await self._async_call(self.coordinator.hub.api.control(self.coordinator.printer.id, "fan", body))

    async def async_set_percentage(self, percentage: int) -> None:
        await self._set(percentage)

    async def async_turn_on(self, percentage: int | None = None, preset_mode: str | None = None, **kwargs: Any) -> None:
        await self._set(100 if percentage is None else percentage)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._set(0)
