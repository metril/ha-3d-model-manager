"""Config and options flows for the 3D Model Manager integration."""

from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, Any

import voluptuous as vol
from homeassistant.config_entries import ConfigFlow, ConfigFlowResult, OptionsFlowWithReload
from homeassistant.core import callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.selector import (
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .api import TdmmApiClient, normalize_url
from .const import CONF_API_KEY, CONF_PRINTER_IDS, CONF_URL, CONF_VERIFY_SSL, DOMAIN
from .exceptions import TdmmAuthError, TdmmError, TdmmScopeError

if TYPE_CHECKING:
    from collections.abc import Mapping

    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant

    from .models import PingResult, PrinterInfo

CONTROL_WARNING = "\n\nThis API key has no control scope: printers will be read-only."


def entry_unique_id(url: str, key_id: int) -> str:
    """Stable config-entry id for a server URL and API key id."""
    return hashlib.sha256(f"{normalize_url(url)}|{key_id}".encode()).hexdigest()[:16]


async def async_validate(hass: HomeAssistant, data: Mapping[str, Any]) -> tuple[TdmmApiClient, PingResult]:
    """Ping the server with the given credentials.

    Raises ``vol.Invalid`` (bad URL), ``TdmmAuthError``, ``TdmmScopeError`` or ``TdmmConnectionError``.
    """
    url = normalize_url(data[CONF_URL])
    session = async_get_clientsession(hass, verify_ssl=data.get(CONF_VERIFY_SSL, True))
    client = TdmmApiClient(session, url, data[CONF_API_KEY])
    return client, await client.ping()


def _available(printers: list[PrinterInfo], ping: PingResult) -> list[PrinterInfo]:
    allowed = None if ping.printer_ids is None else set(ping.printer_ids)
    return [p for p in printers if allowed is None or p.id in allowed]


def _printer_selector(printers: list[PrinterInfo]) -> SelectSelector:
    options = [
        SelectOptionDict(value=str(p.id), label=f"{p.name} ({p.model})" if p.model else p.name) for p in printers
    ]
    return SelectSelector(SelectSelectorConfig(options=options, multiple=True, mode=SelectSelectorMode.LIST))


class TdmmConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for 3DMM."""

    VERSION = 1

    def __init__(self) -> None:
        self._data: dict[str, Any] = {}
        self._ping: PingResult | None = None
        self._printers: list[PrinterInfo] = []

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> TdmmOptionsFlow:
        return TdmmOptionsFlow()

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            try:
                client, ping = await async_validate(self.hass, user_input)
                if "read" not in ping.scopes:
                    errors["base"] = "missing_read_scope"
                else:
                    printers = _available(await client.printers(), ping)
                    if not printers:
                        errors["base"] = "no_printers"
            except vol.Invalid:
                errors["base"] = "invalid_url"
            except TdmmAuthError:
                errors["base"] = "invalid_auth"
            except TdmmScopeError:
                errors["base"] = "missing_read_scope"
            except TdmmError:
                errors["base"] = "cannot_connect"
            if not errors:
                url = normalize_url(user_input[CONF_URL])
                await self.async_set_unique_id(entry_unique_id(url, ping.key_id))
                self._abort_if_unique_id_configured()
                self._data = {
                    CONF_URL: url,
                    CONF_API_KEY: user_input[CONF_API_KEY],
                    CONF_VERIFY_SSL: user_input[CONF_VERIFY_SSL],
                }
                self._ping = ping
                self._printers = printers
                return await self.async_step_printers()
        defaults = user_input or {}
        schema = vol.Schema(
            {
                vol.Required(CONF_URL, default=defaults.get(CONF_URL, "")): str,
                vol.Required(CONF_API_KEY, default=defaults.get(CONF_API_KEY, "")): str,
                vol.Required(CONF_VERIFY_SSL, default=defaults.get(CONF_VERIFY_SSL, True)): bool,
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    async def async_step_printers(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        assert self._ping is not None
        errors: dict[str, str] = {}
        if user_input is not None:
            if user_input[CONF_PRINTER_IDS]:
                return self.async_create_entry(
                    title=self._ping.label or self._data[CONF_URL],
                    data=self._data,
                    options={CONF_PRINTER_IDS: [int(i) for i in user_input[CONF_PRINTER_IDS]]},
                )
            errors["base"] = "no_printers"
        schema = vol.Schema(
            {
                vol.Required(CONF_PRINTER_IDS, default=[str(p.id) for p in self._printers]): _printer_selector(
                    self._printers
                )
            }
        )
        warning = "" if "control" in self._ping.scopes else CONTROL_WARNING
        return self.async_show_form(
            step_id="printers",
            data_schema=schema,
            errors=errors,
            description_placeholders={"control_warning": warning},
        )


class TdmmOptionsFlow(OptionsFlowWithReload):
    """Select which printers are exposed."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            if user_input[CONF_PRINTER_IDS]:
                return self.async_create_entry(data={CONF_PRINTER_IDS: [int(i) for i in user_input[CONF_PRINTER_IDS]]})
            errors["base"] = "no_printers"
        try:
            client, ping = await async_validate(self.hass, self.config_entry.data)
            printers = _available(await client.printers(), ping)
        except (TdmmAuthError, TdmmScopeError):
            return self.async_abort(reason="invalid_auth")
        except (vol.Invalid, TdmmError):
            return self.async_abort(reason="cannot_connect")
        ids = {p.id for p in printers}
        selected = self.config_entry.options.get(CONF_PRINTER_IDS, ids)
        current = [str(p.id) for p in printers if p.id in selected]
        schema = vol.Schema({vol.Required(CONF_PRINTER_IDS, default=current): _printer_selector(printers)})
        return self.async_show_form(step_id="init", data_schema=schema, errors=errors)
