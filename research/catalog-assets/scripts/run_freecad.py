#!/usr/bin/env python3
"""Run catalog asset scripts inside FreeCAD's Python console."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = {
    "catalog-assets": ROOT / "research" / "catalog-assets" / "scripts" / "catalog_assets.py",
    "generate-fasteners-steps": ROOT / "research" / "catalog-assets" / "scripts" / "generate_fasteners_steps.py",
}
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


def build_console_code(script_path: Path, args: list[str]) -> str:
    argv = [script_path.name, *args]
    return (
        "import runpy, sys\n"
        f"sys.argv = {argv!r}\n"
        f"runpy.run_path({str(script_path)!r}, run_name='__main__')\n"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run a catalog asset script through FreeCADCmd console mode")
    parser.add_argument("script", choices=sorted(SCRIPTS), help="Script alias to run")
    parser.add_argument("args", nargs=argparse.REMAINDER, help="Arguments for the selected script")
    parsed = parser.parse_args(argv)

    process = subprocess.run(
        [find_freecadcmd(), "-c"],
        input=build_console_code(SCRIPTS[parsed.script], parsed.args),
        text=True,
        cwd=ROOT,
        check=False,
    )
    return process.returncode


if __name__ == "__main__":
    raise SystemExit(main())
