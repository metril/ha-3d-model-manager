"""Config flow (placeholder; replaced by the config-flow task)."""

from homeassistant.config_entries import ConfigFlow

from .const import DOMAIN


class TdmmConfigFlow(ConfigFlow, domain=DOMAIN):
    """Placeholder so entries can load."""

    VERSION = 1
