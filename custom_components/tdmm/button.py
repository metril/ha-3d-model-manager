"""Action buttons for 3DMM printers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from homeassistant.components.button import ButtonEntity, ButtonEntityDescription

from .entity import TdmmEntity, TdmmEntityDescription

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

    from .api import TdmmApiClient
    from .coordinator import TdmmConfigEntry

PARALLEL_UPDATES = 1


@dataclass(frozen=True, kw_only=True)
class TdmmButtonEntityDescription(TdmmEntityDescription, ButtonEntityDescription):
    press_fn: Callable[[TdmmApiClient, int], Awaitable[None]]


BUTTON_DESCRIPTIONS: tuple[TdmmButtonEntityDescription, ...] = (
    TdmmButtonEntityDescription(key="pause", press_fn=lambda api, pid: api.command(pid, "pause")),
    TdmmButtonEntityDescription(key="resume", press_fn=lambda api, pid: api.command(pid, "resume")),
    TdmmButtonEntityDescription(key="stop", press_fn=lambda api, pid: api.command(pid, "stop")),
    TdmmButtonEntityDescription(key="home", press_fn=lambda api, pid: api.control(pid, "home", {})),
    TdmmButtonEntityDescription(key="clear_hms", press_fn=lambda api, pid: api.control(pid, "clear-hms", {})),
)


async def async_setup_entry(
    hass: HomeAssistant, entry: TdmmConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    async_add_entities(
        TdmmButton(coord, desc)
        for coord in entry.runtime_data.coordinators.values()
        for desc in BUTTON_DESCRIPTIONS
        if desc.exists_fn(coord.printer)
    )


class TdmmButton(TdmmEntity, ButtonEntity):
    entity_description: TdmmButtonEntityDescription

    async def async_press(self) -> None:
        await self._async_call(self.entity_description.press_fn(self.coordinator.hub.api, self.coordinator.printer.id))
