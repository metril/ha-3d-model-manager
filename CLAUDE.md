# tdmm: 3D Model Manager HA integration

## Commands
- Setup: `uv sync`
- Tests: `uv run pytest -n auto`
- Lint: `uv run ruff check . && uv run ruff format --check .`
- Types (advisory): `uv run mypy custom_components/tdmm`

## Conventions
- Domain `tdmm`; Python >=3.13.2 (HA 2025.8+ needs 3.13; no 3.12 leg). CI matrix: 3.13 and 3.14, the two newest Pythons the locked phcc supports.
- Ruff: py312 target, line length 120, rules E,F,W,I,UP,B,SIM,TCH. mypy `disallow_untyped_defs` (advisory).
- `strings.json` and `translations/en.json` must be byte-identical.
- unique_id entity: `{entry_id}_{printer_id}_{key}`. No module-level mutable state; per-instance flags go in `hass.data`.
- Conventional commits, repo-local identity metril, no AI attribution.

## Request budget
Steady state: one `/ping` and one `/printers` per setup, one `/api/events` SSE stream, zero `/status` calls. Entities read coordinator data and never make requests (camera/image fetch on demand only).

## xdist rules
- Tests run with `-n auto`; each test uses its own `aiohttp_server`, tmp dirs and ports.
- No test may touch global state; no shared files between tests.
- CI shards with pytest-split (`--splits 4 --group N`); aggregator job `tests` is the required check.
