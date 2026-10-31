"""Repair issues (filled in by the repairs task)."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .coordinator import TdmmConfigEntry


async def async_clear_issues(hass: HomeAssistant, entry: TdmmConfigEntry) -> None:
    """Clear connection-related issues (no-op for now)."""


async def async_raise_invalid_key(hass: HomeAssistant, entry: TdmmConfigEntry) -> None:
    """Raise the invalid-key issue (no-op for now)."""


async def async_set_missing_scopes(hass: HomeAssistant, entry: TdmmConfigEntry, missing: set[str]) -> None:
    """Raise/clear the missing-scope issue (no-op for now)."""
