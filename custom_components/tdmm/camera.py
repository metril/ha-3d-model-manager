"""Camera entity for 3DMM printers (on-demand snapshots, per-viewer MJPEG proxy)."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import TYPE_CHECKING

from aiohttp.hdrs import CONTENT_TYPE
from homeassistant.components.camera import Camera, CameraEntityFeature
from homeassistant.helpers.aiohttp_client import async_aiohttp_proxy_stream

from .entity import TdmmEntity, TdmmEntityDescription
from .exceptions import TdmmCameraWarming, TdmmError

if TYPE_CHECKING:
    from aiohttp import web
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

    from .coordinator import PrinterCoordinator, TdmmConfigEntry

PARALLEL_UPDATES = 0


@dataclass(frozen=True, kw_only=True)
class TdmmCameraDescription(TdmmEntityDescription):
    """Camera description."""


CAMERA_DESCRIPTIONS: tuple[TdmmCameraDescription, ...] = (
    TdmmCameraDescription(key="camera", exists_fn=lambda p: p.capabilities.camera != "none"),
)


async def async_setup_entry(
    hass: HomeAssistant, entry: TdmmConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    async_add_entities(
        TdmmCamera(coord, desc)
        for coord in entry.runtime_data.coordinators.values()
        for desc in CAMERA_DESCRIPTIONS
        if desc.exists_fn(coord.printer)
    )


class TdmmCamera(TdmmEntity, Camera):
    entity_description: TdmmCameraDescription
    _attr_supported_features = CameraEntityFeature(0)

    def __init__(self, coordinator: PrinterCoordinator, description: TdmmCameraDescription) -> None:
        TdmmEntity.__init__(self, coordinator, description)
        Camera.__init__(self)
        self._cache: bytes | None = None
        self._retry_until = 0.0

    async def async_camera_image(self, width: int | None = None, height: int | None = None) -> bytes | None:
        if time.monotonic() < self._retry_until:
            return self._cache
        api = self.coordinator.hub.api
        try:
            frame = await api.camera_snapshot(self.coordinator.printer.id)
        except TdmmCameraWarming as err:
            self._retry_until = time.monotonic() + err.retry_after
            return self._cache
        except TdmmError:
            return self._cache
        if frame:
            self._cache = frame
        self._retry_until = 0.0
        return self._cache

    async def handle_async_mjpeg_stream(self, request: web.Request) -> web.StreamResponse | None:
        try:
            resp = await self.coordinator.hub.api.open_camera_stream(self.coordinator.printer.id)
        except TdmmError:
            return None
        try:
            return await async_aiohttp_proxy_stream(
                self.hass, request, resp.content, resp.headers.get(CONTENT_TYPE, "multipart/x-mixed-replace")
            )
        finally:
            resp.release()
