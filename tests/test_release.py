"""Workflow tests for versioning, tagging and release automation."""

from pathlib import Path

import yaml

WF = Path(__file__).parent.parent / ".github" / "workflows"


def _load(name):
    return yaml.safe_load((WF / name).read_text())


def _runs(job):
    return "\n".join(s.get("run", "") for s in job["steps"])


def test_release_workflow_builds_cards_and_zips():
    wf = _load("release.yml")
    triggers = wf.get("on", wf.get(True))
    assert triggers["push"]["branches"] == ["main"]
    assert "workflow_dispatch" in triggers
    assert wf["permissions"] == {"contents": "write"}
    job = wf["jobs"]["release"]
    runs = _runs(job)
    for needle in ("npm ci", "npm run build", "git diff --exit-code", "zip -r"):
        assert needle in runs
    assert runs.index("npm run build") < runs.index("git diff --exit-code") < runs.index("zip -r")
    rel = next(s for s in job["steps"] if str(s.get("uses", "")).startswith("softprops/action-gh-release@v2"))
    assert "tdmm.zip" in rel["with"]["files"]
    assert rel["with"]["tag_name"] == "v${{ steps.version.outputs.version }}"
    assert rel["with"]["generate_release_notes"] is True
    assert rel["with"]["make_latest"] is True


def test_release_workflow_skips_existing_tag():
    job = _load("release.yml")["jobs"]["release"]
    steps = job["steps"]
    idx = next(i for i, s in enumerate(steps) if "git ls-remote --tags origin" in s.get("run", ""))
    check = steps[idx]
    assert "refs/tags/v$VERSION" in check["run"]
    assert check.get("id")
    gate = f"steps.{check['id']}.outputs."
    later = steps[idx + 1 :]
    assert later
    assert all(gate in str(s.get("if", "")) for s in later)
    assert "--force" not in "\n".join(s.get("run", "") for s in steps)


def test_ci_fails_when_version_tag_exists_on_code_change():
    wf = _load("ci.yml")
    job = wf["jobs"]["version"]
    assert job["if"] == "github.event_name == 'pull_request'"
    runs = _runs(job)
    assert "custom_components/" in runs and "frontend/" in runs
    assert "git ls-remote --tags origin" in runs
    assert "exit 1" in runs
    agg = wf["jobs"]["tests"]
    assert "version" in agg["needs"]
    assert "'skipped'" not in _runs(agg)
    assert "failure" in _runs(agg) and "cancelled" in _runs(agg)
