"""Constants for the 3D Model Manager integration."""

from homeassistant.const import Platform

DOMAIN = "tdmm"
CONF_URL = "url"
CONF_API_KEY = "api_key"
CONF_VERIFY_SSL = "verify_ssl"
CONF_PRINTER_IDS = "printer_ids"
MANUFACTURER = "Bambu Lab"

PLATFORMS: list[Platform] = [Platform.BINARY_SENSOR, Platform.CAMERA, Platform.SENSOR]
# Forwarded only when the API key has the ``control`` scope.
CONTROL_PLATFORMS: list[Platform] = [
    Platform.LIGHT,
    Platform.FAN,
    Platform.NUMBER,
    Platform.SELECT,
    Platform.BUTTON,
]
