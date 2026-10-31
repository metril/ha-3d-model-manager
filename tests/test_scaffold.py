"""Scaffold sanity tests."""

import json
import re
from pathlib import Path

from homeassistant.loader import async_get_integration

from custom_components.tdmm.const import DOMAIN

ROOT = Path(__file__).parent.parent
COMP = ROOT / "custom_components" / "tdmm"


def test_manifest_fields():
    m = json.loads((COMP / "manifest.json").read_text())
    assert m["domain"] == "tdmm"
    assert m["name"] == "3D Model Manager"
    assert m["iot_class"] == "local_push"
    assert re.fullmatch(r"\d+\.\d+\.\d+", m["version"])
    assert m["dependencies"] == ["frontend", "http"]


def test_hacs_min_version():
    assert json.loads((ROOT / "hacs.json").read_text())["homeassistant"] == "2025.8.0"


def test_hacs_zip_release():
    h = json.loads((ROOT / "hacs.json").read_text())
    assert h["zip_release"] is True
    assert h["filename"] == "tdmm.zip"


def test_strings_match_en():
    assert (COMP / "strings.json").read_bytes() == (COMP / "translations" / "en.json").read_bytes()


async def test_integration_loads(hass):
    integration = await async_get_integration(hass, DOMAIN)
    assert integration.name == "3D Model Manager"
