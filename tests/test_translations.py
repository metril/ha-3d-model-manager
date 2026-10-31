"""Audit that every entity, exception and issue key has a translation string."""

from __future__ import annotations

import json
import re
from importlib import import_module
from pathlib import Path

import pytest

COMPONENT = Path(__file__).parent.parent / "custom_components" / "tdmm"
STRINGS = json.loads((COMPONENT / "strings.json").read_text())

PLATFORM_TUPLES = {
    "sensor": ("SENSOR_DESCRIPTIONS", "AMS_DESCRIPTIONS"),
    "binary_sensor": ("BINARY_SENSOR_DESCRIPTIONS",),
    "light": ("LIGHT_DESCRIPTIONS",),
    "fan": ("FAN_DESCRIPTIONS",),
    "number": ("NUMBER_DESCRIPTIONS",),
    "select": ("SELECT_DESCRIPTIONS",),
    "button": ("BUTTON_DESCRIPTIONS",),
    "camera": ("CAMERA_DESCRIPTIONS",),
    "image": ("IMAGE_DESCRIPTIONS",),
}


def _descriptions(platform: str) -> list:
    module = import_module(f"custom_components.tdmm.{platform}")
    return [d for name in PLATFORM_TUPLES[platform] for d in getattr(module, name)]


@pytest.mark.parametrize("platform", PLATFORM_TUPLES)
def test_every_translation_key_has_string(platform: str) -> None:
    descriptions = _descriptions(platform)
    assert descriptions
    section = STRINGS["entity"][platform]
    for desc in descriptions:
        key = desc.translation_key or desc.key
        assert section.get(key, {}).get("name"), f"entity.{platform}.{key}.name missing"


def test_exception_and_issue_keys_have_strings() -> None:
    exc_keys: set[str] = set()
    issue_keys: set[str] = set()
    for path in COMPONENT.glob("*.py"):
        for key in re.findall(r'translation_key="([^"]+)"', path.read_text()):
            (issue_keys if path.name == "repairs.py" else exc_keys).add(key)
    assert exc_keys
    assert issue_keys
    for key in exc_keys:
        assert STRINGS["exceptions"][key]["message"], key
    for key in issue_keys:
        assert STRINGS["issues"][key]["title"], key


def test_enum_states_translated() -> None:
    from custom_components.tdmm.select import SELECT_DESCRIPTIONS
    from custom_components.tdmm.sensor import PRINT_STATES, SPEED_PROFILES

    sensor = STRINGS["entity"]["sensor"]
    assert set(PRINT_STATES) <= set(sensor["print_state"]["state"])
    assert set(SPEED_PROFILES) <= set(sensor["speed_profile"]["state"])
    speed = next(d for d in SELECT_DESCRIPTIONS if d.key == "speed_profile")
    assert set(speed.options) <= set(STRINGS["entity"]["select"]["speed_profile"]["state"])
