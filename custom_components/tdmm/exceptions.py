"""Exceptions for the 3D Model Manager integration."""

from __future__ import annotations

from homeassistant.exceptions import HomeAssistantError


class TdmmError(HomeAssistantError):
    """Base error."""


class TdmmAuthError(TdmmError):
    """API key rejected (401)."""


class TdmmScopeError(TdmmError):
    """API key lacks a required scope (403)."""


class TdmmConnectionError(TdmmError):
    """Transport failure or unexpected HTTP status."""


class TdmmCameraWarming(TdmmConnectionError):
    """Camera not ready yet (503)."""

    def __init__(self, retry_after: float = 2.0) -> None:
        super().__init__(f"Camera warming up, retry after {retry_after}s")
        self.retry_after = retry_after
