#!/usr/bin/env python3
"""Generate flat STEP files from the FreeCAD Fasteners workbench."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from types import SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
CATALOG_TS = ROOT / "src" / "data" / "catalog.ts"
DEFAULT_STEPS_DIR = ROOT / "research" / "catalog-assets" / "steps"
FASTENERS_WORKBENCH_CANDIDATES = (
    Path.home() / "Library" / "Application Support" / "FreeCAD" / "v1-1" / "Mod" / "fasteners",
    Path.home() / "Library" / "Application Support" / "FreeCAD" / "Mod" / "fasteners",
)


@dataclass
class CatalogEntry:
    id: str
    category: str
    unit_system: str
    code: str
    description: str
    standards: dict[str, str] = field(default_factory=dict)


def timestamp() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def catalog_id_to_step_name(catalog_id: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", catalog_id).strip("_").lower() + ".step"


def string_field(block: str, name: str, default: str = "") -> str:
    match = re.search(rf"{name}:\s*'([^']*)'", block)
    return match.group(1) if match else default


def standards_field(block: str) -> dict[str, str]:
    match = re.search(r"standards:\s*\{([^}]*)\}", block, re.DOTALL)
    if not match:
        return {}
    return {family: value for family, value in re.findall(r"(DIN|ISO|EN|ASME|ASTM|SAE|JIS):\s*'([^']*)'", match.group(1))}


def catalog_blocks(source: str, array_name: str) -> list[str]:
    start = source.find(array_name)
    if start == -1:
        return []
    assignment = source.find("=", start)
    array_start = source.find("[", assignment)
    if assignment == -1 or array_start == -1:
        return []
    blocks: list[str] = []
    depth = 0
    block_start: int | None = None
    in_string = False
    escape = False

    for index in range(array_start, len(source)):
        char = source[index]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == "'":
                in_string = False
            continue

        if char == "'":
            in_string = True
            continue
        if char == "{":
            if depth == 0:
                block_start = index
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0 and block_start is not None:
                blocks.append(source[block_start : index + 1])
                block_start = None
        elif char == "]" and depth == 0:
            break

    return blocks


def load_catalog() -> list[CatalogEntry]:
    entries: list[CatalogEntry] = []
    source = CATALOG_TS.read_text(encoding="utf-8")
    for array_name in ("coreStandardsCatalog", "freecadWorkbenchCatalogEntries"):
        for block in catalog_blocks(source, array_name):
            entry_id = string_field(block, "id")
            if not entry_id:
                continue
            entries.append(
                CatalogEntry(
                    id=entry_id,
                    category=string_field(block, "category"),
                    unit_system=string_field(block, "unitSystem"),
                    code=string_field(block, "code"),
                    description=string_field(block, "description"),
                    standards=standards_field(block),
                )
            )
    return entries


def normalize_standard(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper().replace("DINENISO", "DIN EN ISO").replace("DINISO", "DIN ISO"))


def find_fasteners_workbench() -> Path | None:
    for candidate in FASTENERS_WORKBENCH_CANDIDATES:
        if candidate.exists():
            return candidate
    return None


def load_fasteners_modules() -> dict[str, Any]:
    workbench = find_fasteners_workbench()
    if workbench is None:
        raise RuntimeError("FreeCAD Fasteners workbench was not found.")
    if str(workbench) not in sys.path:
        sys.path.insert(0, str(workbench))

    import FastenersCmd  # type: ignore
    import FSutils  # type: ignore
    from FSAliases import FSGetTypeAlias  # type: ignore

    return {
        "FastenersCmd": FastenersCmd,
        "FSutils": FSutils,
        "FSGetTypeAlias": FSGetTypeAlias,
        "workbenchPath": workbench,
    }


def fasteners_type_index(modules: dict[str, Any]) -> dict[str, str]:
    table = modules["FastenersCmd"].FSScrewCommandTable
    return {normalize_standard(type_id): type_id for type_id in table}


def match_fasteners_type(entry: CatalogEntry, index: dict[str, str]) -> str | None:
    wanted = [normalize_standard(code) for code in entry.standards.values() if code]
    for code in wanted:
        if code in index:
            return index[code]
    for code in wanted:
        for normalized_type, type_id in index.items():
            if normalized_type.startswith(code) or code.startswith(normalized_type):
                return type_id
    return None


def choose_fasteners_diameter(screw_maker: Any, type_id: str) -> str:
    diameters = [diameter for diameter in screw_maker.GetAllDiams(type_id) if diameter not in ("Auto", "Custom")]
    for preferred in ("M6", "M5", "M4", "1/4in", "#10", "6 mm", "25 mm"):
        if preferred in diameters:
            return preferred
    if not diameters:
        raise RuntimeError(f"No diameters available for Fasteners type {type_id}")
    return diameters[0]


def choose_fasteners_length(screw_maker: Any, type_id: str, diameter: str, width: str | None) -> str | None:
    try:
        lengths = screw_maker.GetAllLengths(type_id, diameter, False, width)
    except Exception:
        return None
    if not lengths:
        return None
    for preferred in ("20", "20 mm", "25", "25 mm", "1in"):
        if preferred in lengths:
            return preferred
    return lengths[min(len(lengths) // 2, len(lengths) - 1)]


def build_fasteners_attributes(type_id: str, modules: dict[str, Any], real_threads: bool) -> SimpleNamespace:
    fasteners_cmd = modules["FastenersCmd"]
    screw_maker = fasteners_cmd.screwMaker
    fsutils = modules["FSutils"]
    base_type = modules["FSGetTypeAlias"](type_id)
    params = fasteners_cmd.FSGetParams(type_id)
    diameter = choose_fasteners_diameter(screw_maker, type_id)

    width = None
    if "widthCode" in params or "SlotWidth" in params:
        try:
            values = screw_maker.GetAllWidthcodes(type_id, diameter)
        except Exception:
            values = []
        width = values[0] if values else None
    length = choose_fasteners_length(screw_maker, type_id, diameter, width)

    pitch = None
    calc_pitch = None
    if "Pitch" in params:
        pitches = [value for value in screw_maker.GetAllPitches(type_id, diameter, False) if value != "Custom"]
        pitch = pitches[0] if pitches else None
        calc_pitch = fsutils.parseLength(pitch) if pitch else None

    attrs = SimpleNamespace(
        Type=type_id,
        baseType=base_type,
        Diameter=diameter,
        DiameterCustom=None,
        Length=length,
        LengthCustom=None,
        Width=width,
        Tcode=None,
        SlotWidth=None,
        KeySize=None,
        ExternalDiam=None,
        Pitch=pitch,
        PitchCustom=None,
        Thread=real_threads and "Thread" in params,
        LeftHanded=False,
        MatchOuter=False,
        Blind=False,
        ScrewLength=None,
        NumStarts=1,
        calc_diam=diameter,
        calc_len=length,
        calc_pitch=calc_pitch,
        dimTable=None,
    )
    if "ThicknessCode" in params:
        tcodes = screw_maker.GetAllTcodes(type_id, diameter)
        attrs.Tcode = tcodes[0] if tcodes else None
    if "SlotWidth" in params:
        slot_widths = screw_maker.GetAllSlotWidths(type_id, diameter)
        attrs.SlotWidth = slot_widths[0] if slot_widths else None
    if "KeySize" in params:
        key_sizes = screw_maker.GetAllKeySizes(type_id, diameter)
        attrs.KeySize = key_sizes[0] if key_sizes else None
    if "ExternalDiam" in params:
        attrs.ExternalDiam = screw_maker.GetTableProperty(type_id, diameter, "ExtDia", 8.0)
    if "ThreadLength" in params:
        attrs.ScrewLength = screw_maker.GetThreadLength(type_id, diameter)
    return attrs


def generate_step(entry: CatalogEntry, type_id: str, modules: dict[str, Any], output_dir: Path, real_threads: bool) -> dict[str, Any]:
    try:
        import FreeCAD  # type: ignore
        import Import  # type: ignore
    except ImportError as error:
        raise RuntimeError("FreeCAD Python modules are not available. Run this command with FreeCADCmd.") from error

    attrs = build_fasteners_attributes(type_id, modules, real_threads)
    shape = modules["FastenersCmd"].screwMaker.createFastener(attrs)
    if shape is None:
        raise RuntimeError(f"Fasteners workbench returned no shape for {type_id}.")

    document_name = re.sub(r"[^A-Za-z0-9_]", "_", f"fasteners_{entry.id}")
    doc = FreeCAD.newDocument(document_name)
    try:
        part = doc.addObject("Part::Feature", "FastenersWorkbench_part")
        part.Label = entry.id
        part.Shape = shape
        doc.recompute()
        output_dir.mkdir(parents=True, exist_ok=True)
        step_path = output_dir / catalog_id_to_step_name(entry.id)
        Import.export([part], str(step_path))
    finally:
        FreeCAD.closeDocument(doc.Name)

    return {
        "catalogId": entry.id,
        "fastenersType": type_id,
        "stepPath": display_path(step_path),
        "parameters": {key: value for key, value in vars(attrs).items() if value is not None},
    }


def selected_catalog(catalog: list[CatalogEntry], args: argparse.Namespace) -> list[CatalogEntry]:
    if args.all:
        return catalog
    return [entry for entry in catalog if entry.id == args.catalog_id]


def command_generate(args: argparse.Namespace) -> int:
    modules = load_fasteners_modules()
    type_index = fasteners_type_index(modules)
    generated = []
    skipped = []
    errors = []

    for entry in selected_catalog(load_catalog(), args):
        type_id = match_fasteners_type(entry, type_index)
        if not type_id:
            skipped.append({"catalogId": entry.id, "reason": "No Fasteners workbench type matched the catalog standards."})
            continue
        try:
            generated.append(generate_step(entry, type_id, modules, Path(args.output_dir).resolve(), args.threads))
        except Exception as error:  # noqa: BLE001 - batch command should report all failures.
            errors.append({"catalogId": entry.id, "fastenersType": type_id, "error": str(error)})

    print(
        json.dumps(
            {
                "updatedAt": timestamp(),
                "counts": {"generated": len(generated), "skipped": len(skipped), "failed": len(errors)},
                "generated": generated,
                "skipped": skipped,
                "errors": errors,
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0 if not errors else 1


def command_list_types(_: argparse.Namespace) -> int:
    modules = load_fasteners_modules()
    fasteners_cmd = modules["FastenersCmd"]
    table = fasteners_cmd.FSScrewCommandTable
    rows = []
    for type_id in sorted(table):
        params = fasteners_cmd.FSGetParams(type_id)
        row = table[type_id]
        rows.append(
            {
                "typeId": type_id,
                "normalized": normalize_standard(type_id),
                "description": str(row[0]) if len(row) > 0 else "",
                "group": str(row[1]) if len(row) > 1 else "",
                "parameters": sorted(params),
            }
        )
    print(json.dumps({"count": len(rows), "types": rows}, indent=2, sort_keys=True))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate flat STEP files from the FreeCAD Fasteners workbench.")
    subcommands = parser.add_subparsers(dest="command", required=True)

    generate_parser = subcommands.add_parser("generate", help="Generate STEP files for catalog entries")
    target = generate_parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--all", action="store_true", help="Generate STEP files for all matching catalog entries")
    target.add_argument("--catalog-id", help="Generate one catalog entry")
    generate_parser.add_argument("--output-dir", default=str(DEFAULT_STEPS_DIR), help="Output directory for flat STEP files")
    generate_parser.add_argument("--threads", action="store_true", help="Generate real thread geometry when supported")
    generate_parser.set_defaults(func=command_generate)

    list_types_parser = subcommands.add_parser("list-types", help="List available FreeCAD Fasteners workbench types")
    list_types_parser.set_defaults(func=command_list_types)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
