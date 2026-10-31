"""Diagnostics for the 3D Model Manager integration."""

from __future__ import annotations

from dataclasses import asdict
from typing import TYPE_CHECKING, Any

from homeassistant.components.diagnostics import async_redact_data

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .coordinator import TdmmConfigEntry

REDACT = {"api_key", "url", "host", "serial", "tray_uuid", "ipcam", "configuration_url", "title"}


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: TdmmConfigEntry) -> dict[str, Any]:
    """Return redacted diagnostics for a config entry."""
    runtime = entry.runtime_data
    stats = asdict(runtime.hub.stream.stats) if runtime.hub.stream is not None else None
    if stats is not None and stats["last_event_at"] is not None:
        stats["last_event_at"] = stats["last_event_at"].isoformat()
    return async_redact_data(
        {
            "entry": {"title": entry.title, "data": dict(entry.data), "options": dict(entry.options)},
            "connected": runtime.hub.connected,
            "scopes": sorted(runtime.hub.ping.scopes),
            "stream": stats,
            "printers": {pid: {"info": asdict(c.printer), "raw": c.raw} for pid, c in runtime.coordinators.items()},
        },
        REDACT,
    )
