"""Repair issues for the 3D Model Manager integration."""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.helpers import issue_registry as ir

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .coordinator import TdmmConfigEntry

SCOPES = ("read", "control")


def _invalid_key_id(entry: TdmmConfigEntry) -> str:
    return f"{entry.entry_id}_invalid_api_key"


def async_clear_issues(hass: HomeAssistant, entry: TdmmConfigEntry) -> None:
    """Clear connection-related issues. Scope issues are re-evaluated at setup."""
    ir.async_delete_issue(hass, DOMAIN, _invalid_key_id(entry))


def async_raise_invalid_key(hass: HomeAssistant, entry: TdmmConfigEntry) -> None:
    """Raise the invalid-key issue."""
    ir.async_create_issue(
        hass,
        DOMAIN,
        _invalid_key_id(entry),
        is_fixable=False,
        severity=ir.IssueSeverity.ERROR,
        translation_key="invalid_api_key",
        translation_placeholders={"name": entry.title},
    )


def async_set_missing_scopes(hass: HomeAssistant, entry: TdmmConfigEntry, missing: set[str]) -> None:
    """Raise an issue per missing scope and clear the ones that are present."""
    for scope in SCOPES:
        issue_id = f"{entry.entry_id}_missing_scope_{scope}"
        if scope in missing:
            ir.async_create_issue(
                hass,
                DOMAIN,
                issue_id,
                is_fixable=False,
                severity=ir.IssueSeverity.WARNING,
                translation_key="missing_scope",
                translation_placeholders={"scope": scope},
            )
        else:
            ir.async_delete_issue(hass, DOMAIN, issue_id)
