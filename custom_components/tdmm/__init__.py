"""The 3D Model Manager integration."""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.const import CONF_API_KEY, CONF_URL, CONF_VERIFY_SSL
from homeassistant.exceptions import ConfigEntryAuthFailed, ConfigEntryError, ConfigEntryNotReady
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from . import repairs
from .api import TdmmApiClient
from .const import CONF_PRINTER_IDS, CONTROL_PLATFORMS, DOMAIN, PLATFORMS
from .coordinator import PrinterCoordinator, TdmmHub, TdmmRuntime
from .exceptions import TdmmAuthError, TdmmError
from .frontend import async_register_frontend
from .sse import EventStream

if TYPE_CHECKING:
    from homeassistant.const import Platform
    from homeassistant.core import HomeAssistant

    from .coordinator import TdmmConfigEntry


def _platforms(hub: TdmmHub) -> list[Platform]:
    return [*PLATFORMS, *(CONTROL_PLATFORMS if hub.can_control else [])]


async def async_setup_entry(hass: HomeAssistant, entry: TdmmConfigEntry) -> bool:
    """Set up 3DMM from a config entry."""
    session = async_get_clientsession(hass, verify_ssl=entry.data[CONF_VERIFY_SSL])
    api = TdmmApiClient(session, entry.data[CONF_URL], entry.data[CONF_API_KEY])
    try:
        ping = await api.ping()
        repairs.async_clear_issues(hass, entry)
        repairs.async_set_missing_scopes(hass, entry, {"read", "control"} - set(ping.scopes))
        if "read" not in ping.scopes:
            raise ConfigEntryError(translation_domain=DOMAIN, translation_key="missing_read_scope")
        printers = await api.printers()
    except TdmmAuthError as err:
        repairs.async_raise_invalid_key(hass, entry)
        raise ConfigEntryAuthFailed from err
    except TdmmError as err:
        raise ConfigEntryNotReady from err

    hub = TdmmHub(api=api, ping=ping)
    selected = set(entry.options.get(CONF_PRINTER_IDS, [p.id for p in printers]))
    coordinators = {p.id: PrinterCoordinator(hass, entry, hub, p) for p in printers if p.id in selected}
    entry.runtime_data = TdmmRuntime(hub=hub, coordinators=coordinators)

    def _auth_failed() -> None:
        repairs.async_raise_invalid_key(hass, entry)
        entry.async_start_reauth(hass)

    def _connected() -> None:
        repairs.async_clear_issues(hass, entry)

    hub.stream = EventStream(hass, entry, hub, coordinators, on_auth_failed=_auth_failed, on_connected=_connected)
    await hass.config_entries.async_forward_entry_setups(entry, _platforms(hub))
    await async_register_frontend(hass)
    hub.stream.start()
    return True


async def async_unload_entry(hass: HomeAssistant, entry: TdmmConfigEntry) -> bool:
    """Unload a config entry."""
    hub = entry.runtime_data.hub
    if hub.stream is not None:
        await hub.stream.stop()
    return await hass.config_entries.async_unload_platforms(entry, _platforms(hub))


async def async_remove_entry(hass: HomeAssistant, entry: TdmmConfigEntry) -> None:
    """Remove the entry's repair issues."""
    repairs.async_delete_all_issues(hass, entry)
