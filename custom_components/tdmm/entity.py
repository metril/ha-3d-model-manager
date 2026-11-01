"""Base entity for 3DMM."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import EntityDescription
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, MANUFACTURER
from .coordinator import PrinterCoordinator
from .exceptions import TdmmError, TdmmScopeError

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from .models import AmsUnit, PrinterInfo


_HAS_VIA_DEVICE_ID = "via_device_id" in DeviceInfo.__annotations__


def _device_key(printer: PrinterInfo) -> str:
    return printer.serial or str(printer.id)


@dataclass(frozen=True, kw_only=True)
class TdmmEntityDescription(EntityDescription):
    """Base description."""

    requires_online: bool = True
    exists_fn: Callable[[PrinterInfo], bool] = lambda _: True


def ams_device_info(coordinator: PrinterCoordinator, unit: AmsUnit) -> DeviceInfo:
    """Device info for an AMS unit, attached to its printer."""
    printer = coordinator.printer
    key = _device_key(printer)
    info = DeviceInfo(
        identifiers={(DOMAIN, f"{key}_ams{unit.id}")},
        name=f"{printer.name} {unit.label or f'AMS {unit.id}'}",
        manufacturer=MANUFACTURER,
        model="AMS",
    )
    if _HAS_VIA_DEVICE_ID:
        parent = dr.async_get(coordinator.hass).async_get_or_create(
            config_entry_id=coordinator.config_entry.entry_id,
            identifiers={(DOMAIN, key)},
            name=printer.name,
            model=printer.model,
            manufacturer=MANUFACTURER,
        )
        info["via_device_id"] = parent.id
    else:
        info["via_device"] = (DOMAIN, key)
    return info


class TdmmEntity(CoordinatorEntity[PrinterCoordinator]):
    """Entity bound to one printer coordinator."""

    _attr_has_entity_name = True
    entity_description: TdmmEntityDescription

    def __init__(self, coordinator: PrinterCoordinator, description: TdmmEntityDescription) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        printer = coordinator.printer
        self._attr_translation_key = description.key
        self._attr_unique_id = f"{coordinator.config_entry.entry_id}_{printer.id}_{description.key}"

    @property
    def available(self) -> bool:
        data = self.coordinator.data
        return (
            self.coordinator.hub.connected
            and data is not None
            and (not self.entity_description.requires_online or data.online)
        )

    @property
    def device_info(self) -> DeviceInfo:
        printer = self.coordinator.printer
        data = self.coordinator.data
        return DeviceInfo(
            identifiers={(DOMAIN, _device_key(printer))},
            name=printer.name,
            model=printer.model,
            manufacturer=MANUFACTURER,
            sw_version=data.firmware_ota if data else None,
            configuration_url=self.coordinator.hub.api.base_url,
        )

    async def _async_call(self, coro: Awaitable[None]) -> None:
        try:
            await coro
        except TdmmScopeError as err:
            raise HomeAssistantError(translation_domain=DOMAIN, translation_key="missing_control_scope") from err
        except TdmmError as err:
            raise HomeAssistantError(translation_domain=DOMAIN, translation_key="command_failed") from err
