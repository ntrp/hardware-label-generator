#!/usr/bin/env python3
"""Run catalog asset commands inside FreeCAD's Python console."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
CATALOG_ASSETS = ROOT / "research" / "catalog-assets" / "scripts" / "catalog_assets.py"
FREECAD_CANDIDATES = (
    "FreeCADCmd",
    "freecadcmd",
    "/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd",
)


def find_freecadcmd() -> str:
    for candidate in FREECAD_CANDIDATES:
        path = shutil.which(candidate) if "/" not in candidate else candidate
        if path and Path(path).exists():
            return path
    raise RuntimeError("FreeCADCmd/freecadcmd was not found.")


def build_console_code(args: list[str]) -> str:
    argv = ["catalog_assets.py", *args]
    return (
        "import runpy, sys\n"
        f"sys.argv = {argv!r}\n"
        f"runpy.run_path({str(CATALOG_ASSETS)!r}, run_name='__main__')\n"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run catalog asset commands through FreeCADCmd console mode")
    parser.add_argument("args", nargs=argparse.REMAINDER, help="Arguments for catalog_assets.py")
    parsed = parser.parse_args(argv)
    if not parsed.args:
        parser.error("missing catalog_assets.py command")

    process = subprocess.run(
        [find_freecadcmd(), "-c"],
        input=build_console_code(parsed.args),
        text=True,
        cwd=ROOT,
        check=False,
    )
    return process.returncode


if __name__ == "__main__":
    raise SystemExit(main())
