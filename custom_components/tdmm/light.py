"""Chamber light for 3DMM printers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from homeassistant.components.light import ColorMode, LightEntity, LightEntityDescription

from .entity import TdmmEntity, TdmmEntityDescription

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

    from .coordinator import TdmmConfigEntry

PARALLEL_UPDATES = 1


@dataclass(frozen=True, kw_only=True)
class TdmmLightDescription(TdmmEntityDescription, LightEntityDescription):
    """Light description."""


LIGHT_DESCRIPTIONS: tuple[TdmmLightDescription, ...] = (TdmmLightDescription(key="chamber_light"),)


async def async_setup_entry(
    hass: HomeAssistant, entry: TdmmConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    async_add_entities(
        TdmmChamberLight(coord, desc)
        for coord in entry.runtime_data.coordinators.values()
        for desc in LIGHT_DESCRIPTIONS
        if desc.exists_fn(coord.printer)
    )


class TdmmChamberLight(TdmmEntity, LightEntity):
    entity_description: TdmmLightDescription
    _attr_color_mode = ColorMode.ONOFF
    _attr_supported_color_modes = {ColorMode.ONOFF}

    @property
    def is_on(self) -> bool | None:
        data = self.coordinator.data
        return None if data is None else data.light_on

    async def _set(self, on: bool) -> None:
        await self._async_call(self.coordinator.hub.api.control(self.coordinator.printer.id, "light", {"on": on}))

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self._set(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._set(False)
