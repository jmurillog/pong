from __future__ import annotations

import json
import platform
import subprocess
import sys
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path


def _package_version(name: str) -> str:
    try:
        return version(name)
    except PackageNotFoundError:
        return "not-installed"


def git_commit_hash(cwd: Path | None = None) -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()
    except Exception:
        return "unknown"


def collect_runtime_metadata(*, cwd: Path | None = None) -> dict:
    return {
        "generated_at_utc": datetime.now(tz=timezone.utc).isoformat(),
        "python": sys.version.replace("\n", " "),
        "platform": platform.platform(),
        "git_commit": git_commit_hash(cwd=cwd),
        "packages": {
            "stable-baselines3": _package_version("stable-baselines3"),
            "gymnasium": _package_version("gymnasium"),
            "ale-py": _package_version("ale-py"),
            "autorom": _package_version("autorom"),
            "torch": _package_version("torch"),
            "numpy": _package_version("numpy"),
            "pandas": _package_version("pandas"),
            "matplotlib": _package_version("matplotlib"),
            "scipy": _package_version("scipy"),
        },
    }


def write_runtime_metadata(path: Path, *, cwd: Path | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    metadata = collect_runtime_metadata(cwd=cwd)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)

