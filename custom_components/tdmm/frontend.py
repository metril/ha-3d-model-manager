"""Serve the Lovelace card bundle."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import TYPE_CHECKING

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

URL_BASE = "/tdmm/tdmm-cards.js"
DATA_FRONTEND = f"{DOMAIN}_frontend"
BUNDLE_PATH = Path(__file__).parent / "frontend" / "tdmm-cards.js"


def _hash(path: Path) -> str | None:
    """Return the short bundle digest, or None when the file is missing."""
    if not path.is_file():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()[:8]


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the card bundle and load it in the frontend, once per HA instance."""
    if hass.data.get(DATA_FRONTEND):
        return
    path = BUNDLE_PATH
    try:
        digest = await hass.async_add_executor_job(_hash, path)
        if digest is None:
            _LOGGER.debug("Card bundle %s not found; skipping", path)
            return
        await hass.http.async_register_static_paths([StaticPathConfig(URL_BASE, str(path), cache_headers=False)])
        add_extra_js_url(hass, f"{URL_BASE}?v={digest}")
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Could not register card bundle: %s", err)
        return
    hass.data[DATA_FRONTEND] = True
