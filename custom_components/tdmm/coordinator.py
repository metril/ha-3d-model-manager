"""Hub and push-only printer coordinators."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import DOMAIN
from .models import PrinterStatus, fingerprint, merge_patch

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .api import TdmmApiClient
    from .models import PingResult, PrinterInfo
    from .sse import EventStream

_LOGGER = logging.getLogger(__name__)

type TdmmConfigEntry = ConfigEntry[TdmmRuntime]


@dataclass
class TdmmHub:
    """Shared per-entry state."""

    api: TdmmApiClient
    ping: PingResult
    connected: bool = False
    stream: EventStream | None = None

    @property
    def can_control(self) -> bool:
        return "control" in self.ping.scopes


class PrinterCoordinator(DataUpdateCoordinator[PrinterStatus | None]):
    """Holds one printer's status; updated only by pushed snapshots/deltas."""

    def __init__(self, hass: HomeAssistant, entry: TdmmConfigEntry, hub: TdmmHub, printer: PrinterInfo) -> None:
        super().__init__(hass, _LOGGER, config_entry=entry, name=f"{DOMAIN} {printer.name}", update_interval=None)
        self.hub = hub
        self.printer = printer
        self.raw: dict[str, Any] | None = None
        self._fp: str | None = None
        self.data = None

    def _publish(self, new_fp: str) -> bool:
        if new_fp == self._fp:
            return False
        self._fp = new_fp
        assert self.raw is not None
        self.async_set_updated_data(PrinterStatus.from_dict(self.raw))
        return True

    def apply_snapshot(self, raw: dict[str, Any]) -> bool:
        self.raw = raw
        return self._publish(fingerprint(raw))

    def apply_delta(self, patch: dict[str, Any]) -> bool:
        if self.raw is None:
            return False
        self.raw = merge_patch(self.raw, patch)
        return self._publish(fingerprint(self.raw))

    def reset_snapshot(self) -> None:
        """Forget state without notifying; caller calls async_update_listeners()."""
        self.raw = None
        self._fp = None
        self.data = None


@dataclass
class TdmmRuntime:
    hub: TdmmHub
    coordinators: dict[int, PrinterCoordinator]
