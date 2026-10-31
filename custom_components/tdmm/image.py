"""Print thumbnail image entity for 3DMM printers (fetched on demand, once per key)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from homeassistant.components.image import ImageEntity
from homeassistant.util import dt as dt_util

from .entity import TdmmEntity, TdmmEntityDescription
from .exceptions import TdmmError

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

    from .coordinator import PrinterCoordinator, TdmmConfigEntry

PARALLEL_UPDATES = 0


@dataclass(frozen=True, kw_only=True)
class TdmmImageDescription(TdmmEntityDescription):
    """Image description."""


IMAGE_DESCRIPTIONS: tuple[TdmmImageDescription, ...] = (TdmmImageDescription(key="print_thumbnail"),)


async def async_setup_entry(
    hass: HomeAssistant, entry: TdmmConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    async_add_entities(
        TdmmThumbnailImage(hass, coord, desc)
        for coord in entry.runtime_data.coordinators.values()
        for desc in IMAGE_DESCRIPTIONS
        if desc.exists_fn(coord.printer)
    )


class TdmmThumbnailImage(TdmmEntity, ImageEntity):
    entity_description: TdmmImageDescription
    _attr_content_type = "image/png"

    def __init__(self, hass: HomeAssistant, coordinator: PrinterCoordinator, description: TdmmImageDescription) -> None:
        TdmmEntity.__init__(self, coordinator, description)
        ImageEntity.__init__(self, hass)
        self._key = self._current_key()
        self._cache: bytes | None = None
        self._cached_key: str | None = None
        self._has_cache = False
        self._attr_image_last_updated = dt_util.utcnow()

    def _current_key(self) -> str | None:
        data = self.coordinator.data
        return None if data is None else data.print_thumbnail_key

    def _handle_coordinator_update(self) -> None:
        key = self._current_key()
        if key != self._key:
            self._key = key
            self._cache = None
            self._has_cache = False
            self._attr_image_last_updated = dt_util.utcnow()
        super()._handle_coordinator_update()

    async def async_image(self) -> bytes | None:
        key = self._current_key()
        if key is None:
            return None
        if self._has_cache and self._cached_key == key:
            return self._cache
        try:
            data = await self.coordinator.hub.api.thumbnail(self.coordinator.printer.id)
        except TdmmError:
            return None
        self._cache, self._cached_key, self._has_cache = data, key, True
        return data
