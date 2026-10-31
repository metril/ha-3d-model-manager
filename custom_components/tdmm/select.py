"""Speed profile select for 3DMM printers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from homeassistant.components.select import SelectEntity, SelectEntityDescription

from .entity import TdmmEntity, TdmmEntityDescription

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

    from .coordinator import TdmmConfigEntry

PARALLEL_UPDATES = 1

SPEED_OPTIONS = ("silent", "standard", "sport", "ludicrous")


@dataclass(frozen=True, kw_only=True)
class TdmmSelectDescription(TdmmEntityDescription, SelectEntityDescription):
    """Select description."""


SELECT_DESCRIPTIONS: tuple[TdmmSelectDescription, ...] = (
    TdmmSelectDescription(key="speed_profile", options=list(SPEED_OPTIONS)),
)


async def async_setup_entry(
    hass: HomeAssistant, entry: TdmmConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    async_add_entities(
        TdmmSpeedSelect(coord, desc)
        for coord in entry.runtime_data.coordinators.values()
        for desc in SELECT_DESCRIPTIONS
        if desc.exists_fn(coord.printer)
    )


class TdmmSpeedSelect(TdmmEntity, SelectEntity):
    entity_description: TdmmSelectDescription

    @property
    def current_option(self) -> str | None:
        data = self.coordinator.data
        level = None if data is None else data.speed_level
        return SPEED_OPTIONS[level - 1] if level is not None and 1 <= level <= len(SPEED_OPTIONS) else None

    async def async_select_option(self, option: str) -> None:
        body = {"level": SPEED_OPTIONS.index(option) + 1}
        await self._async_call(self.coordinator.hub.api.control(self.coordinator.printer.id, "speed", body))
