#!/usr/bin/env python3
"""Catalog CAD model acquisition and rendering pipeline.

This script is intentionally standalone so it can run outside the browser app.
Use plain python for status/discovery/audit commands and FreeCADCmd for render
commands when FreeCAD is installed.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
import textwrap
import time
from dataclasses import dataclass, field
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus, urljoin
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[3]
RESEARCH_DIR = ROOT / "research" / "catalog-assets"
CATALOG_TS = ROOT / "src" / "data" / "catalog.ts"
STATUS_JSON = RESEARCH_DIR / "status.json"
MODELS_DIR = RESEARCH_DIR / "models"
RENDERS_DIR = RESEARCH_DIR / "renders"
FASTENERS_WORKBENCH_DIR = RESEARCH_DIR / "fasteners-workbench"
FASTENERS_STATUS_JSON = FASTENERS_WORKBENCH_DIR / "status.json"
FASTENERS_MODELS_DIR = FASTENERS_WORKBENCH_DIR / "models"
FASTENERS_RENDERS_DIR = FASTENERS_WORKBENCH_DIR / "renders"
BOLTSPARTS_DIR = RESEARCH_DIR / "boltsparts"
BOLTSPARTS_DATA_DIR = BOLTSPARTS_DIR / "data"
BOLTSPARTS_FREECAD_DIR = BOLTSPARTS_DIR / "freecad"

STANDARD_FAMILIES = ("DIN", "ISO", "EN", "ASME", "ASTM", "SAE", "JIS")
ACCEPTED_MODEL_EXTENSIONS = (".step", ".stp", ".stl")
BLOCKED_MARKERS = ("login", "sign in", "register", "account", "captcha", "cloudflare")
USER_AGENT = "standalone-fastener-label-generator-research/0.1"
BOLTSPARTS_API_BASE = "https://api.github.com/repos/boltsparts/boltsparts/contents"
BOLTSPARTS_RAW_BASE = "https://raw.githubusercontent.com/boltsparts/boltsparts/main"
BOLTSPARTS_HTML_BASE = "https://github.com/boltsparts/boltsparts/blob/main"
BLENDER_CANDIDATES = (
    Path("/Applications/Blender.app/Contents/MacOS/Blender"),
    Path("/Applications/Blender.app/Contents/Resources/blender"),
)
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


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def string_field(block: str, name: str, default: str = "") -> str:
    match = re.search(rf"{name}:\s*'([^']*)'", block)
    return match.group(1) if match else default


def standards_field(block: str) -> dict[str, str]:
    match = re.search(r"standards:\s*\{([^}]*)\}", block, re.DOTALL)
    if not match:
        return {}
    return {family: value for family, value in re.findall(r"(DIN|ISO|EN|ASME|ASTM|SAE|JIS):\s*'([^']*)'", match.group(1))}


def catalog_blocks(source: str) -> list[str]:
    start = source.find("export const standardsCatalog")
    assignment = source.find("=", start)
    array_start = source.find("[", assignment)
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
    for block in catalog_blocks(read_text(CATALOG_TS)):
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


def standard_number(family: str, code: str) -> str | None:
    without_family = re.sub(rf"^\s*{family}\s+", "", code, flags=re.IGNORECASE).strip()
    without_prefixes = re.sub(r"^(EN|ISO)\s+", "", without_family, flags=re.IGNORECASE).strip()
    match = re.search(r"[A-Za-z]?\d[A-Za-z0-9./-]*", without_prefixes)
    return match.group(0) if match else None


def standard_refs(entry: CatalogEntry) -> list[dict[str, str]]:
    refs: list[dict[str, str]] = []
    for family in STANDARD_FAMILIES:
        code = entry.standards.get(family)
        if not code:
            continue
        number = standard_number(family, code)
        if not number:
            continue
        refs.append(
            {
                "family": family,
                "number": number,
                "code": code,
                "tracepartsSearchUrl": f"https://www.traceparts.com/search/{quote_plus(code + ' ' + entry.description)}",
                "partcommunitySearchUrl": f"https://b2b.partcommunity.com/community/partcloud/?search={quote_plus(code + ' ' + entry.description)}",
            }
        )
    return refs


def default_status_entry(entry: CatalogEntry) -> dict[str, Any]:
    return {
        "catalogId": entry.id,
        "category": entry.category,
        "unitSystem": entry.unit_system,
        "standardCodes": entry.standards,
        "description": entry.description,
        "modelStatus": "pending",
        "renderStatus": "pending",
        "sourceProvider": "",
        "sourceUrl": "",
        "sourceFormat": "",
        "licenseNote": "",
        "modelPath": "",
        "normalizedModelPath": "",
        "renderPaths": {},
        "candidateSources": standard_refs(entry),
        "boltsparts": None,
        "error": "",
        "updatedAt": "",
    }


def load_status() -> dict[str, Any]:
    status = read_json(STATUS_JSON, {"version": 1, "updatedAt": "", "entries": []})
    if "entries" not in status:
        status["entries"] = []
    return status


def status_index(status: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {entry["catalogId"]: entry for entry in status.get("entries", [])}


def merge_status(catalog: list[CatalogEntry], existing: dict[str, Any]) -> dict[str, Any]:
    existing_by_id = status_index(existing)
    entries: list[dict[str, Any]] = []
    for catalog_entry in catalog:
        base = default_status_entry(catalog_entry)
        current = existing_by_id.get(catalog_entry.id, {})
        merged = {**base, **current}
        merged["category"] = catalog_entry.category
        merged["unitSystem"] = catalog_entry.unit_system
        merged["standardCodes"] = catalog_entry.standards
        merged["description"] = catalog_entry.description
        merged["candidateSources"] = standard_refs(catalog_entry)
        entries.append(merged)

    return apply_boltsparts_matches({"version": 1, "updatedAt": timestamp(), "entries": entries}, catalog)


def sync_boltsparts() -> dict[str, int]:
    BOLTSPARTS_DIR.mkdir(parents=True, exist_ok=True)
    download_text_file(f"{BOLTSPARTS_RAW_BASE}/LICENSE", BOLTSPARTS_DIR / "LICENSE")
    download_text_file(f"{BOLTSPARTS_RAW_BASE}/Readme.rst", BOLTSPARTS_DIR / "Readme.rst")

    data_count = 0
    for item in fetch_json(f"{BOLTSPARTS_API_BASE}/data?ref=main"):
        if item.get("type") == "file" and item.get("name", "").endswith(".blt") and item.get("download_url"):
            download_text_file(item["download_url"], BOLTSPARTS_DATA_DIR / item["name"])
            data_count += 1

    freecad_count = 0
    for item in fetch_json(f"{BOLTSPARTS_API_BASE}/freecad?ref=main"):
        if item.get("type") != "dir":
            continue
        collection = item["name"]
        for backend_file in fetch_json(f"{BOLTSPARTS_API_BASE}/freecad/{collection}?ref=main"):
            if backend_file.get("type") == "file" and backend_file.get("download_url"):
                download_text_file(backend_file["download_url"], BOLTSPARTS_FREECAD_DIR / collection / backend_file["name"])
                freecad_count += 1

    return {"dataFiles": data_count, "freecadFiles": freecad_count}


def timestamp() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def fetch_url(url: str, timeout: int = 20) -> tuple[int, str, bytes]:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        content_type = response.headers.get("content-type", "")
        return response.status, content_type, response.read()


def fetch_json(url: str) -> Any:
    _, _, payload = fetch_url(url)
    return json.loads(payload.decode("utf-8"))


def download_text_file(url: str, output: Path) -> None:
    _, _, payload = fetch_url(url)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(payload)


def direct_model_links(page_url: str, html: str) -> list[str]:
    links = re.findall(r"""(?:href|src)=["']([^"']+\.(?:step|stp|stl)(?:\?[^"']*)?)["']""", html, flags=re.IGNORECASE)
    return [urljoin(page_url, link) for link in links]


def normalize_standard(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper().replace("DINENISO", "DIN EN ISO").replace("DINISO", "DIN ISO"))


def boltsparts_local_data_files() -> list[Path]:
    if not BOLTSPARTS_DATA_DIR.exists():
        return []
    return sorted(BOLTSPARTS_DATA_DIR.glob("*.blt"))


def normalize_boltsparts_standards(raw: Any) -> list[dict[str, str]]:
    if not raw:
        return []
    values = raw if isinstance(raw, list) else [raw]
    normalized: list[dict[str, str]] = []
    for value in values:
        if not isinstance(value, dict):
            continue
        for standard in standard_strings(value.get("standard")):
            normalized.append({"standard": standard, "kind": "standard"})
        for group in standard_strings(value.get("group")):
            normalized.append({"standard": group, "kind": "group"})
    return normalized


def standard_strings(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, (int, float)):
        return [str(value)]
    if isinstance(value, list):
        return [entry for item in value for entry in standard_strings(item)]
    if isinstance(value, dict):
        return [entry for item in value.values() for entry in standard_strings(item)]
    return []


def load_boltsparts_index() -> list[dict[str, Any]]:
    try:
        import yaml  # type: ignore
    except ImportError:
        return []

    class BoltsLoader(yaml.SafeLoader):  # type: ignore[misc]
        pass

    def ignored_yaml_extension(loader: Any, node: Any) -> Any:
        if isinstance(node, yaml.ScalarNode):
            return loader.construct_scalar(node)
        if isinstance(node, yaml.SequenceNode):
            return loader.construct_sequence(node)
        if isinstance(node, yaml.MappingNode):
            return loader.construct_mapping(node)
        return None

    BoltsLoader.add_constructor("!include", ignored_yaml_extension)
    BoltsLoader.add_constructor("!length", ignored_yaml_extension)

    classes: list[dict[str, Any]] = []
    for path in boltsparts_local_data_files():
        data = yaml.load(path.read_text(encoding="utf-8"), Loader=BoltsLoader)
        if not isinstance(data, dict):
            continue
        collection_id = str(data.get("id") or path.stem)
        for class_entry in data.get("classes", []):
            if not isinstance(class_entry, dict):
                continue
            class_id = class_entry.get("id")
            if not class_id:
                continue
            standards = normalize_boltsparts_standards(class_entry.get("standards"))
            params = class_entry.get("parameters") if isinstance(class_entry.get("parameters"), dict) else {}
            classes.append(
                {
                    "collectionId": collection_id,
                    "classId": str(class_id),
                    "name": class_entry.get("names", {}).get("name", str(class_id)) if isinstance(class_entry.get("names"), dict) else str(class_id),
                    "standards": standards,
                    "freeParameters": params.get("free", []) if isinstance(params, dict) else [],
                    "defaults": params.get("defaults", {}) if isinstance(params, dict) else {},
                    "dataPath": str(path.relative_to(ROOT)),
                    "freecadPath": str((BOLTSPARTS_FREECAD_DIR / collection_id).relative_to(ROOT)),
                    "htmlUrl": f"{BOLTSPARTS_HTML_BASE}/data/{path.name}",
                }
            )
    return classes


def load_bolts_yaml(path: Path) -> Any:
    try:
        import yaml  # type: ignore
    except ImportError as error:
        raise RuntimeError("PyYAML is required for Boltsparts/BOLTS data parsing.") from error

    class BoltsLoader(yaml.SafeLoader):  # type: ignore[misc]
        pass

    def ignored_yaml_extension(loader: Any, node: Any) -> Any:
        if isinstance(node, yaml.ScalarNode):
            return loader.construct_scalar(node)
        if isinstance(node, yaml.SequenceNode):
            return loader.construct_sequence(node)
        if isinstance(node, yaml.MappingNode):
            return loader.construct_mapping(node)
        return None

    BoltsLoader.add_constructor("!include", ignored_yaml_extension)
    BoltsLoader.add_constructor("!length", ignored_yaml_extension)

    return yaml.load(path.read_text(encoding="utf-8"), Loader=BoltsLoader)


def load_boltsparts_class(collection_id: str, class_id: str) -> dict[str, Any]:
    data_path = BOLTSPARTS_DATA_DIR / f"{collection_id}.blt"
    data = load_bolts_yaml(data_path)
    if not isinstance(data, dict):
        raise RuntimeError(f"Invalid BOLTS data file: {display_path(data_path)}")
    for class_entry in data.get("classes", []):
        if isinstance(class_entry, dict) and str(class_entry.get("id")) == class_id:
            return class_entry
    raise RuntimeError(f"Boltsparts class {collection_id}/{class_id} was not found.")


def load_boltsparts_backend(collection_id: str, class_id: str) -> dict[str, str]:
    if collection_id == "nut" and class_id == "hexagonlocknut":
        return {"filename": "nut.py", "functionName": "nut1"}
    if collection_id == "hex_socket" and class_id.startswith("hexsocketsetscrew"):
        return {"filename": "", "functionName": "__builtin_hex_socket_set_screw"}

    base_path = BOLTSPARTS_FREECAD_DIR / collection_id / f"{collection_id}.base"
    base_data = load_bolts_yaml(base_path)
    entries = base_data if isinstance(base_data, list) else [base_data]
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        for function_entry in entry.get("functions", []):
            if not isinstance(function_entry, dict):
                continue
            if class_id in [str(value) for value in function_entry.get("classids", [])]:
                return {
                    "filename": str(entry["filename"]),
                    "functionName": str(function_entry["name"]),
                }
    raise RuntimeError(f"No FreeCAD backend function found for {collection_id}/{class_id}.")


def resolve_boltsparts_params(class_entry: dict[str, Any], catalog_id: str) -> dict[str, Any]:
    parameters = class_entry.get("parameters") if isinstance(class_entry.get("parameters"), dict) else {}
    params: dict[str, Any] = {}
    params.update(parameters.get("defaults", {}) if isinstance(parameters.get("defaults"), dict) else {})
    params.update(parameters.get("literal", {}) if isinstance(parameters.get("literal"), dict) else {})

    table = parameters.get("tables")
    if isinstance(table, dict):
        index_name = table.get("index")
        columns = table.get("columns", [])
        data = table.get("data", {})
        if isinstance(index_name, str) and isinstance(columns, list) and isinstance(data, dict):
            index_value = params.get(index_name)
            row = data.get(index_value)
            if row is None and data:
                index_value, row = next(iter(data.items()))
                params[index_name] = index_value
            if isinstance(row, list):
                for column, value in zip(columns, row):
                    params[str(column)] = value

    for table2d in parameters.get("tables2d", []) if isinstance(parameters.get("tables2d"), list) else []:
        if not isinstance(table2d, dict):
            continue
        row_index = table2d.get("rowindex")
        column_index = table2d.get("colindex")
        result = table2d.get("result")
        columns = table2d.get("columns", [])
        data = table2d.get("data", {})
        if not isinstance(row_index, str) or not isinstance(column_index, str) or not isinstance(result, str):
            continue
        if not isinstance(columns, list) or not isinstance(data, dict):
            continue
        row = data.get(params.get(row_index))
        if not isinstance(row, list):
            continue
        try:
            column_position = columns.index(params.get(column_index))
        except ValueError:
            continue
        if column_position < len(row):
            params[result] = row[column_position]

    params["name"] = catalog_id
    return params


def import_freecad_backend(collection_id: str, backend: dict[str, str]) -> Any:
    if backend["functionName"].startswith("__builtin_"):
        return None

    backend_path = BOLTSPARTS_FREECAD_DIR / collection_id / backend["filename"]
    module_name = f"boltsparts_{collection_id}_{backend['functionName']}"
    spec = importlib.util.spec_from_file_location(module_name, backend_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load FreeCAD backend {display_path(backend_path)}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def generate_hex_socket_set_screw(params: dict[str, Any], document: Any) -> None:
    import Part  # type: ignore
    from FreeCAD import Vector  # type: ignore

    diameter = float(params.get("d") or params.get("d1"))
    length = float(params["l"])
    socket_width = float(params["s"])
    socket_depth = float(params["t"])
    point = str(params.get("point", "flat"))

    shaft = Part.makeCylinder(0.5 * diameter, length)
    if point == "cone":
        tip_depth = min(length * 0.2, diameter * 0.5)
        cone = Part.makeCone(0.5 * diameter, 0, tip_depth)
        cone.translate(Vector(0, 0, -tip_depth))
        shaft = shaft.fuse(cone)
    elif point in ("dog", "cup"):
        point_diameter = float(params.get("d1") or diameter * 0.7)
        point_depth = min(length * 0.2, diameter * 0.5)
        point_shape = Part.makeCylinder(0.5 * point_diameter, point_depth)
        point_shape.translate(Vector(0, 0, -point_depth))
        shaft = shaft.fuse(point_shape)

    socket_radius = socket_width / 3**0.5
    socket = Part.makeCylinder(socket_radius, socket_depth, Vector(0, 0, length - socket_depth), Vector(0, 0, 1), 6)
    socket.rotate(Vector(0, 0, length - socket_depth), Vector(0, 0, 1), 30)
    part = document.addObject("Part::Feature", "BOLTS_part")
    part.Label = params["name"]
    part.Shape = shaft.cut(socket).removeSplitter()


def generate_boltsparts_step(entry_status: dict[str, Any]) -> dict[str, str]:
    boltsparts = entry_status.get("boltsparts")
    if not boltsparts:
        raise RuntimeError("Catalog entry has no Boltsparts match.")

    try:
        import FreeCAD  # type: ignore
        import Import  # type: ignore
    except ImportError as error:
        raise RuntimeError("FreeCAD Python modules are not available. Run this command with FreeCADCmd.") from error

    collection_id = boltsparts["collectionId"]
    class_id = boltsparts["classId"]
    class_entry = load_boltsparts_class(collection_id, class_id)
    backend = load_boltsparts_backend(collection_id, class_id)
    module = import_freecad_backend(collection_id, backend)
    generate = generate_hex_socket_set_screw if backend["functionName"] == "__builtin_hex_socket_set_screw" else getattr(module, backend["functionName"])
    params = resolve_boltsparts_params(class_entry, entry_status["catalogId"])

    document_name = re.sub(r"[^A-Za-z0-9_]", "_", entry_status["catalogId"])
    doc = FreeCAD.newDocument(document_name)
    try:
        generate(params, doc)
        doc.recompute()
        model_dir = MODELS_DIR / entry_status["catalogId"]
        model_dir.mkdir(parents=True, exist_ok=True)
        step_path = model_dir / "normalized.step"
        Import.export(doc.Objects, str(step_path))
    finally:
        FreeCAD.closeDocument(doc.Name)

    return {
        "path": display_path(step_path),
        "backendFunction": backend["functionName"],
        "parameters": params,
    }


def generate_boltsparts_models(status: dict[str, Any], selected_ids: set[str], render_images: bool, width: int, height: int) -> dict[str, Any]:
    for entry_status in status["entries"]:
        if selected_ids and entry_status["catalogId"] not in selected_ids:
            continue
        if not entry_status.get("boltsparts"):
            continue
        try:
            generated = generate_boltsparts_step(entry_status)
            entry_status.update(
                {
                    "modelStatus": "normalized",
                    "sourceProvider": "boltsparts",
                    "sourceFormat": "step",
                    "normalizedModelPath": generated["path"],
                    "boltspartsParameters": generated["parameters"],
                    "error": "",
                    "updatedAt": timestamp(),
                }
            )
            if render_images:
                try:
                    render_one(entry_status, width, height)
                except Exception as error:  # noqa: BLE001 - keep generated STEP status intact.
                    entry_status.update({"renderStatus": "failed", "error": str(error), "updatedAt": timestamp()})
        except Exception as error:  # noqa: BLE001 - status should capture tooling failures.
            entry_status.update({"modelStatus": "failed", "renderStatus": "failed" if render_images else entry_status.get("renderStatus", "pending"), "error": str(error), "updatedAt": timestamp()})
    status["updatedAt"] = timestamp()
    return status


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
        "workbenchPath": workbench,
        "FastenersCmd": FastenersCmd,
        "FSutils": FSutils,
        "FSGetTypeAlias": FSGetTypeAlias,
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


def generate_fasteners_workbench_step(entry: CatalogEntry, type_id: str, modules: dict[str, Any], real_threads: bool) -> dict[str, Any]:
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
        model_dir = FASTENERS_MODELS_DIR / entry.id
        model_dir.mkdir(parents=True, exist_ok=True)
        step_path = model_dir / "normalized.step"
        Import.export([part], str(step_path))
    finally:
        FreeCAD.closeDocument(doc.Name)

    return {
        "modelPath": display_path(step_path),
        "parameters": {key: value for key, value in vars(attrs).items() if value is not None},
    }


def fasteners_status_entry(entry: CatalogEntry, type_id: str | None) -> dict[str, Any]:
    return {
        "catalogId": entry.id,
        "category": entry.category,
        "standardCodes": entry.standards,
        "description": entry.description,
        "fastenersType": type_id,
        "modelStatus": "matched" if type_id else "pending",
        "renderStatus": "pending",
        "normalizedModelPath": "",
        "renderPaths": {},
        "parameters": {},
        "error": "",
        "updatedAt": "",
    }


def generate_fasteners_workbench_models(catalog: list[CatalogEntry], selected_ids: set[str], render_images: bool, width: int, height: int, real_threads: bool) -> dict[str, Any]:
    modules = load_fasteners_modules()
    index = fasteners_type_index(modules)
    previous = status_index(read_json(FASTENERS_STATUS_JSON, {"entries": []}))
    entries: list[dict[str, Any]] = []
    for catalog_entry in catalog:
        type_id = match_fasteners_type(catalog_entry, index)
        entry_status = {**fasteners_status_entry(catalog_entry, type_id), **previous.get(catalog_entry.id, {})}
        entry_status["category"] = catalog_entry.category
        entry_status["standardCodes"] = catalog_entry.standards
        entry_status["description"] = catalog_entry.description
        entry_status["fastenersType"] = type_id
        if selected_ids and catalog_entry.id not in selected_ids:
            entries.append(entry_status)
            continue
        if not type_id:
            entries.append(entry_status)
            continue
        try:
            generated = generate_fasteners_workbench_step(catalog_entry, type_id, modules, real_threads)
            entry_status.update(
                {
                    "modelStatus": "normalized",
                    "normalizedModelPath": generated["modelPath"],
                    "parameters": generated["parameters"],
                    "error": "",
                    "updatedAt": timestamp(),
                }
            )
            if render_images:
                render_paths = render_model_file(ROOT / generated["modelPath"], FASTENERS_RENDERS_DIR / catalog_entry.id, f"fasteners_{catalog_entry.id}", width, height)
                entry_status.update({"renderStatus": "rendered", "renderPaths": render_paths, "updatedAt": timestamp()})
        except Exception as error:  # noqa: BLE001 - experiment status should capture failures.
            entry_status.update({"modelStatus": "failed", "renderStatus": "failed" if render_images else entry_status.get("renderStatus", "pending"), "error": str(error), "updatedAt": timestamp()})
        entries.append(entry_status)

    counts = {
        "total": len(entries),
        "matched": sum(1 for entry in entries if entry.get("fastenersType")),
        "normalized": sum(1 for entry in entries if entry.get("modelStatus") == "normalized"),
        "rendered": sum(1 for entry in entries if entry.get("renderStatus") == "rendered"),
        "failed": sum(1 for entry in entries if entry.get("modelStatus") == "failed" or entry.get("renderStatus") == "failed"),
        "pending": sum(1 for entry in entries if not entry.get("fastenersType")),
    }
    status = {"version": 1, "provider": "freecad-fasteners-workbench", "updatedAt": timestamp(), "counts": counts, "entries": entries}
    write_json(FASTENERS_STATUS_JSON, status)
    return status


def match_boltsparts_entry(entry: CatalogEntry, index: list[dict[str, Any]]) -> dict[str, Any] | None:
    wanted = {normalize_standard(code) for code in entry.standards.values()}
    if not wanted:
        return None
    best_match: dict[str, Any] | None = None
    best_score = 0
    for candidate in index:
        candidate_standards = {normalize_standard(standard["standard"]) for standard in candidate.get("standards", [])}
        score = len(wanted.intersection(candidate_standards))
        if score > best_score:
            best_score = score
            best_match = candidate
    return best_match


def apply_boltsparts_matches(status: dict[str, Any], catalog: list[CatalogEntry]) -> dict[str, Any]:
    index = load_boltsparts_index()
    catalog_by_id = {entry.id: entry for entry in catalog}
    for entry_status in status.get("entries", []):
        catalog_entry = catalog_by_id.get(entry_status["catalogId"])
        if not catalog_entry:
            continue
        match = match_boltsparts_entry(catalog_entry, index)
        if not match:
            entry_status["boltsparts"] = None
            continue
        entry_status["boltsparts"] = {
            "collectionId": match["collectionId"],
            "classId": match["classId"],
            "name": match["name"],
            "standards": match["standards"],
            "freeParameters": match["freeParameters"],
            "defaults": match["defaults"],
            "dataPath": match["dataPath"],
            "freecadPath": match["freecadPath"],
            "htmlUrl": match["htmlUrl"],
        }
        if entry_status.get("modelStatus") in ("pending", "missing"):
            entry_status.update(
                {
                    "modelStatus": "found",
                    "sourceProvider": "boltsparts",
                    "sourceUrl": match["htmlUrl"],
                    "sourceFormat": "procedural-freecad",
                    "licenseNote": "Boltsparts/BOLTS data and FreeCAD generators are mirrored locally; review GPL/LGPL license files before redistribution.",
                    "error": "",
                    "updatedAt": timestamp(),
                }
            )
    return status


def find_downloadable_model(entry_status: dict[str, Any]) -> tuple[str, str, str] | None:
    return None


def download_model(entry_status: dict[str, Any], url: str, extension: str) -> None:
    catalog_id = entry_status["catalogId"]
    model_dir = MODELS_DIR / catalog_id
    model_dir.mkdir(parents=True, exist_ok=True)
    output = model_dir / f"original.{extension}"
    _, _, payload = fetch_url(url)
    output.write_bytes(payload)
    entry_status.update(
        {
            "modelStatus": "downloaded",
            "sourceProvider": provider_from_url(url),
            "sourceUrl": url,
            "sourceFormat": extension,
            "modelPath": str(output.relative_to(ROOT)),
            "licenseNote": "Downloaded from a direct public model link; review provider terms before committing or redistribution.",
            "error": "",
            "updatedAt": timestamp(),
        }
    )


def provider_from_url(url: str) -> str:
    if "traceparts" in url:
        return "traceparts"
    if "partcommunity" in url or "cadenas" in url:
        return "partcommunity"
    return "unknown"


def discover(status: dict[str, Any], selected_ids: set[str], dry_run: bool) -> dict[str, Any]:
    for entry_status in status["entries"]:
        if selected_ids and entry_status["catalogId"] not in selected_ids:
            continue
        if not entry_status.get("candidateSources"):
            entry_status.update(
                {
                    "modelStatus": "missing",
                    "renderStatus": "skipped",
                    "error": "No standard code available for automated lookup.",
                    "updatedAt": timestamp(),
                }
            )
            continue
        result = find_downloadable_model(entry_status)
        if result is None:
            entry_status.update(
                {
                    "modelStatus": "missing",
                    "renderStatus": "skipped",
                    "error": entry_status.get("error") or "No direct downloadable STEP/STL model found.",
                    "updatedAt": timestamp(),
                }
            )
            continue
        action, url, extension = result
        if action == "blocked_auth":
            entry_status.update(
                {
                    "modelStatus": "blocked_auth",
                    "renderStatus": "skipped",
                    "sourceProvider": provider_from_url(url),
                    "sourceUrl": url,
                    "error": "Source appears to require login, registration, or interactive access.",
                    "updatedAt": timestamp(),
                }
            )
            continue
        if action == "download":
            if dry_run:
                entry_status.update(
                    {
                        "modelStatus": "found",
                        "sourceProvider": provider_from_url(url),
                        "sourceUrl": url,
                        "sourceFormat": extension,
                        "error": "",
                        "updatedAt": timestamp(),
                    }
                )
            else:
                download_model(entry_status, url, extension)
    status["updatedAt"] = timestamp()
    return status


def import_freecad() -> tuple[Any, Any, Any]:
    try:
        import FreeCAD  # type: ignore
        import Import  # type: ignore
        import Mesh  # type: ignore

        return FreeCAD, Import, Mesh
    except ImportError as error:
        raise RuntimeError("FreeCAD Python modules are not available. Run render with FreeCADCmd.") from error


def display_and_render(doc: Any, output_dir: Path, width: int, height: int) -> None:
    try:
        import FreeCADGui  # type: ignore
    except ImportError as error:
        raise RuntimeError("FreeCADGui is required for PNG rendering. Use a FreeCAD build with GUI/offscreen support.") from error

    FreeCADGui.showMainWindow()
    view = FreeCADGui.ActiveDocument.ActiveView
    view.setBackgroundColor((1.0, 1.0, 1.0))

    for obj in doc.Objects:
        if hasattr(obj, "ViewObject"):
            obj.ViewObject.DisplayMode = "Shaded"
    view.viewAxometric()
    view.fitAll()
    view.saveImage(str(output_dir / "iso.png"), width, height, "White")

    for obj in doc.Objects:
        if hasattr(obj, "ViewObject"):
            obj.ViewObject.DisplayMode = "Wireframe"
            obj.ViewObject.LineColor = (0.0, 0.0, 0.0)
            obj.ViewObject.LineWidth = 1.0
    view.viewFront()
    view.fitAll()
    view.saveImage(str(output_dir / "side.png"), width, height, "White")
    view.viewTop()
    view.fitAll()
    view.saveImage(str(output_dir / "top.png"), width, height, "White")


def find_blender() -> Path | None:
    for candidate in BLENDER_CANDIDATES:
        if candidate.exists():
            return candidate
    return None


def blender_render_script(stl_path: Path, output_dir: Path, width: int, height: int) -> str:
    return textwrap.dedent(
        f"""
        import math
        import bpy
        from mathutils import Vector

        stl_path = {str(stl_path)!r}
        output_dir = {str(output_dir)!r}
        width = {width}
        height = {height}

        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete()
        try:
            bpy.ops.wm.stl_import(filepath=stl_path)
        except Exception:
            bpy.ops.import_mesh.stl(filepath=stl_path)

        objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
        if not objects:
            raise RuntimeError('No mesh objects were imported from STL.')

        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
        if len(objects) > 1:
            bpy.ops.object.join()
        obj = bpy.context.object

        min_corner = Vector((min((obj.matrix_world @ Vector(corner)).x for corner in obj.bound_box),
                             min((obj.matrix_world @ Vector(corner)).y for corner in obj.bound_box),
                             min((obj.matrix_world @ Vector(corner)).z for corner in obj.bound_box)))
        max_corner = Vector((max((obj.matrix_world @ Vector(corner)).x for corner in obj.bound_box),
                             max((obj.matrix_world @ Vector(corner)).y for corner in obj.bound_box),
                             max((obj.matrix_world @ Vector(corner)).z for corner in obj.bound_box)))
        center = (min_corner + max_corner) * 0.5
        size = max((max_corner - min_corner).length, 1.0)
        obj.location -= center

        metal_material = bpy.data.materials.new('brushed_metal')
        metal_material.diffuse_color = (0.52, 0.53, 0.53, 1.0)
        metal_material.use_nodes = True
        shader = metal_material.node_tree.nodes.get('Principled BSDF')
        if shader:
            if 'Base Color' in shader.inputs:
                shader.inputs['Base Color'].default_value = (0.52, 0.53, 0.53, 1.0)
            if 'Metallic' in shader.inputs:
                shader.inputs['Metallic'].default_value = 0.85
            if 'Roughness' in shader.inputs:
                shader.inputs['Roughness'].default_value = 0.24
        wire_material = bpy.data.materials.new('black_wire')
        wire_material.diffuse_color = (0.03, 0.035, 0.04, 1.0)
        obj.data.materials.append(metal_material)

        scene = bpy.context.scene
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.film_transparent = True
        scene.render.image_settings.color_mode = 'RGBA'
        scene.world = bpy.data.worlds.new('catalog_world')
        scene.world.color = (1, 1, 1)
        if hasattr(scene, 'display') and hasattr(scene.display, 'shading'):
            scene.display.shading.background_type = 'VIEWPORT'
            scene.display.shading.background_color = (1, 1, 1)
            scene.display.shading.color_type = 'MATERIAL'
            if hasattr(scene.display.shading, 'light'):
                scene.display.shading.light = 'STUDIO'
        engines = [item.identifier for item in scene.render.bl_rna.properties['engine'].enum_items]
        for engine in ('CYCLES', 'BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'BLENDER_WORKBENCH'):
            if engine in engines:
                scene.render.engine = engine
                break
        if scene.render.engine == 'CYCLES':
            scene.cycles.samples = 96
            scene.cycles.use_denoising = True
        scene.world.use_nodes = True
        world_background = scene.world.node_tree.nodes.get('Background')
        if world_background:
            world_background.inputs['Color'].default_value = (1, 1, 1, 1)
            world_background.inputs['Strength'].default_value = 0.25
        scene.view_settings.view_transform = 'Standard'
        scene.view_settings.look = 'None'
        scene.view_settings.exposure = 0
        scene.view_settings.gamma = 1
        if hasattr(scene, 'eevee'):
            for name, value in (
                ('use_gtao', True),
                ('gtao_distance', size * 1.5),
                ('gtao_factor', 1.3),
                ('use_raytracing', True),
            ):
                if hasattr(scene.eevee, name):
                    setattr(scene.eevee, name, value)

        light_data = bpy.data.lights.new('key', 'AREA')
        light = bpy.data.objects.new('key', light_data)
        bpy.context.collection.objects.link(light)
        light.location = (size * 2.5, -size * 3.0, size * 3.2)
        light.data.energy = 2200
        light.data.size = size * 2.2

        fill_data = bpy.data.lights.new('fill', 'AREA')
        fill = bpy.data.objects.new('fill', fill_data)
        bpy.context.collection.objects.link(fill)
        fill.location = (-size * 2.5, size * 2.0, size * 1.5)
        fill.data.energy = 700
        fill.data.size = size * 3

        rim_data = bpy.data.lights.new('rim', 'POINT')
        rim = bpy.data.objects.new('rim', rim_data)
        bpy.context.collection.objects.link(rim)
        rim.location = (-size * 1.8, -size * 2.2, size * 2.4)
        rim.data.energy = 450

        camera_data = bpy.data.cameras.new('camera')
        camera = bpy.data.objects.new('camera', camera_data)
        bpy.context.collection.objects.link(camera)
        scene.camera = camera

        def look_at(target):
            direction = Vector(target) - camera.location
            camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

        def render(name, location, perspective=False, rotation=(0, 0, 0)):
            obj.modifiers.clear()
            obj.rotation_euler = rotation
            obj.data.materials.clear()
            obj.data.materials.append(metal_material)
            if perspective:
                camera.data.type = 'PERSP'
                camera.data.lens = 85
            else:
                camera.data.type = 'ORTHO'
                camera.data.ortho_scale = size * 1.35
            camera.location = Vector(location)
            look_at((0, 0, 0))
            scene.render.filepath = f"{{output_dir}}/{{name}}.png"
            bpy.ops.render.render(write_still=True)

        render('iso', (size * 1.9, -size * 2.35, size * 1.45), True, (math.radians(90), 0, math.radians(-28)))
        """
    )


def render_stl_with_blender(stl_path: Path, output_dir: Path, width: int, height: int) -> None:
    blender = find_blender()
    if blender is None:
        raise RuntimeError("FreeCADGui rendering failed and Blender was not found for fallback rendering.")
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as script:
        script.write(blender_render_script(stl_path, output_dir, width, height))
        script_path = Path(script.name)
    try:
        subprocess.run([str(blender), "--background", "--python", str(script_path)], check=True, cwd=ROOT)
        missing = [name for name in ("iso.png",) if not (output_dir / name).exists()]
        if missing:
            raise RuntimeError(f"Blender render did not create expected files: {', '.join(missing)}")
        flatten_render_background(output_dir, ("iso.png",))
    finally:
        script_path.unlink(missing_ok=True)


def flatten_render_background(output_dir: Path, names: tuple[str, ...] = ("iso.png", "side.png", "top.png")) -> None:
    try:
        from PIL import Image  # type: ignore
    except ImportError as error:
        raise RuntimeError("Pillow is required to flatten transparent Blender renders onto a white background.") from error

    for name in names:
        path = output_dir / name
        image = Image.open(path).convert("RGBA")
        bbox = image.getchannel("A").getbbox()
        if bbox:
            cropped = image.crop(bbox)
            centered = Image.new("RGBA", image.size, (255, 255, 255, 0))
            left = (image.width - cropped.width) // 2
            top = (image.height - cropped.height) // 2
            centered.alpha_composite(cropped, (left, top))
            image = centered
        background = Image.new("RGBA", image.size, (255, 255, 255, 255))
        background.alpha_composite(image)
        background.convert("RGB").save(path)


def combined_document_shape(objects: list[Any]) -> Any:
    import Part  # type: ignore

    shapes = [obj.Shape for obj in objects if hasattr(obj, "Shape") and not obj.Shape.isNull()]
    if not shapes:
        raise RuntimeError("No renderable shapes were found in the FreeCAD document.")
    if len(shapes) == 1:
        return shapes[0]
    return Part.makeCompound(shapes)


def project_shape_to_svg(shape: Any, direction: Any) -> str:
    import TechDraw  # type: ignore

    visible_style = {"stroke": "rgb(0, 0, 0)", "stroke-width": "0.35"}
    hidden_style = {"stroke": "rgb(165, 165, 165)", "stroke-width": "0.25", "stroke-dasharray": "1.2,0.8"}
    return TechDraw.projectToSVG(
        shape,
        direction,
        "ShowHiddenLines",
        0.01,
        visible_style,
        visible_style,
        visible_style,
        hidden_style,
        hidden_style,
        hidden_style,
    )


def technical_svg_document(svg_body: str, bbox: tuple[float, float, float, float], margin: float) -> str:
    min_x, min_y, max_x, max_y = bbox
    width = max(max_x - min_x, 1.0)
    height = max(max_y - min_y, 1.0)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{min_x - margin} {min_y - margin} {width + 2 * margin} {height + 2 * margin}">\n'
        '<rect width="100%" height="100%" fill="white"/>\n'
        f"{svg_body}\n"
        "</svg>\n"
    )


def parse_svg_bbox(svg_body: str) -> tuple[float, float, float, float]:
    number = r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?"
    xs: list[float] = []
    ys: list[float] = []

    for match in re.finditer(r'<path\b[^>]*\bd="([^"]+)"', svg_body):
        for command in re.finditer(rf"[ML]\s*({number})\s*,?\s*({number})", match.group(1)):
            x = float(command.group(1))
            y = -float(command.group(2))
            xs.append(x)
            ys.append(y)

    for match in re.finditer(rf"<circle\b[^>]*\bcx\s*=\s*\"({number})\"[^>]*\bcy\s*=\s*\"({number})\"[^>]*\br\s*=\s*\"({number})\"", svg_body):
        cx = float(match.group(1))
        cy = -float(match.group(2))
        radius = abs(float(match.group(3)))
        xs.extend([cx - radius, cx + radius])
        ys.extend([cy - radius, cy + radius])

    if not xs or not ys:
        raise RuntimeError("FreeCAD technical projection did not produce drawable SVG geometry.")
    return (min(xs), min(ys), max(xs), max(ys))


def render_technical_drawings(doc: Any, output_dir: Path) -> None:
    import FreeCAD  # type: ignore

    shape = combined_document_shape(doc.Objects)
    views = {
        "side": FreeCAD.Vector(0, -1, 0),
        "top": FreeCAD.Vector(0, 0, 1),
    }
    for name, direction in views.items():
        svg_body = project_shape_to_svg(shape, direction)
        bbox = parse_svg_bbox(svg_body)
        min_x, min_y, max_x, max_y = bbox
        margin = max(max_x - min_x, max_y - min_y, 1.0) * 0.08
        (output_dir / f"{name}.svg").write_text(technical_svg_document(svg_body, bbox, margin), encoding="utf-8")


def render_model_file(model_path: Path, output_dir: Path, document_name: str, width: int, height: int) -> dict[str, str]:
    if not model_path.exists():
        raise RuntimeError(f"Model path is missing: {model_path}")

    FreeCAD, Import, Mesh = import_freecad()
    doc = FreeCAD.newDocument(re.sub(r"[^A-Za-z0-9_]", "_", document_name))
    extension = model_path.suffix.lower()
    if extension in (".step", ".stp"):
        Import.insert(str(model_path), doc.Name)
    elif extension == ".stl":
        Mesh.insert(str(model_path), doc.Name)
    else:
        raise RuntimeError(f"Unsupported model format for rendering: {extension}")

    doc.recompute()
    output_dir.mkdir(parents=True, exist_ok=True)
    stl_path = output_dir / "render-source.stl"
    try:
        Mesh.export(doc.Objects, str(stl_path))
        render_stl_with_blender(stl_path, output_dir, width, height)
        render_technical_drawings(doc, output_dir)
    except RuntimeError:
        display_and_render(doc, output_dir, width, height)
    finally:
        stl_path.unlink(missing_ok=True)
    FreeCAD.closeDocument(doc.Name)

    return {
        "iso": display_path(output_dir / "iso.png"),
        "side": display_path(output_dir / "side.svg"),
        "top": display_path(output_dir / "top.svg"),
    }


def render_one(entry_status: dict[str, Any], width: int, height: int) -> None:
    model_path_text = entry_status.get("normalizedModelPath") or entry_status.get("modelPath")
    if not model_path_text:
        entry_status.update({"renderStatus": "skipped", "error": "No local model path to render.", "updatedAt": timestamp()})
        return

    render_paths = render_model_file(ROOT / model_path_text, RENDERS_DIR / entry_status["catalogId"], entry_status["catalogId"], width, height)
    entry_status.update({"renderStatus": "rendered", "renderPaths": render_paths, "error": "", "updatedAt": timestamp()})


def render(status: dict[str, Any], selected_ids: set[str], width: int, height: int) -> dict[str, Any]:
    for entry_status in status["entries"]:
        if selected_ids and entry_status["catalogId"] not in selected_ids:
            continue
        try:
            render_one(entry_status, width, height)
        except Exception as error:  # noqa: BLE001 - status should capture tooling failures.
            entry_status.update({"renderStatus": "failed", "error": str(error), "updatedAt": timestamp()})
    status["updatedAt"] = timestamp()
    return status


def audit(status: dict[str, Any]) -> tuple[dict[str, int], list[str]]:
    counts = {
        "total": len(status["entries"]),
        "pending": 0,
        "found": 0,
        "downloaded": 0,
        "normalized": 0,
        "missing": 0,
        "blocked": 0,
        "failed": 0,
        "rendered": 0,
    }
    errors: list[str] = []
    for entry_status in status["entries"]:
        model_status = entry_status.get("modelStatus", "pending")
        render_status = entry_status.get("renderStatus", "pending")
        if model_status in counts:
            counts[model_status] += 1
        if model_status.startswith("blocked"):
            counts["blocked"] += 1
        if model_status == "failed" or render_status == "failed":
            counts["failed"] += 1
        if render_status == "rendered":
            counts["rendered"] += 1

        for key in ("modelPath", "normalizedModelPath"):
            value = entry_status.get(key)
            if value and not (ROOT / value).exists():
                errors.append(f"{entry_status['catalogId']}: missing {key} {value}")
        for label, value in entry_status.get("renderPaths", {}).items():
            if value and not (ROOT / value).exists():
                errors.append(f"{entry_status['catalogId']}: missing render {label} {value}")

    return counts, errors


def selected_ids_from_args(args: argparse.Namespace) -> set[str]:
    if args.all:
        return set()
    if args.catalog_id:
        return {args.catalog_id}
    return set()


def command_status(args: argparse.Namespace) -> int:
    status = merge_status(load_catalog(), load_status())
    if args.write:
        write_json(STATUS_JSON, status)
    else:
        print(json.dumps(status, indent=2, sort_keys=True))
    return 0


def command_boltsparts_sync(args: argparse.Namespace) -> int:
    counts = sync_boltsparts()
    if args.write_status:
        write_json(STATUS_JSON, merge_status(load_catalog(), load_status()))
    print(json.dumps(counts, indent=2, sort_keys=True))
    return 0


def command_boltsparts_index(_: argparse.Namespace) -> int:
    index = load_boltsparts_index()
    print(json.dumps({"classes": index, "count": len(index)}, indent=2, sort_keys=True))
    return 0


def command_discover(args: argparse.Namespace) -> int:
    status = merge_status(load_catalog(), load_status())
    status = discover(status, selected_ids_from_args(args), args.dry_run)
    write_json(STATUS_JSON, status)
    counts, errors = audit(status)
    print(json.dumps({"counts": counts, "errors": errors}, indent=2, sort_keys=True))
    return 0 if not errors else 1


def command_render(args: argparse.Namespace) -> int:
    status = merge_status(load_catalog(), load_status())
    status = render(status, selected_ids_from_args(args), args.width, args.height)
    write_json(STATUS_JSON, status)
    counts, errors = audit(status)
    print(json.dumps({"counts": counts, "errors": errors}, indent=2, sort_keys=True))
    return 0 if not errors else 1


def command_boltsparts_generate(args: argparse.Namespace) -> int:
    status = merge_status(load_catalog(), load_status())
    status = generate_boltsparts_models(status, selected_ids_from_args(args), args.render, args.width, args.height)
    write_json(STATUS_JSON, status)
    counts, errors = audit(status)
    print(json.dumps({"counts": counts, "errors": errors}, indent=2, sort_keys=True))
    return 0 if not errors else 1


def command_fasteners_generate(args: argparse.Namespace) -> int:
    status = generate_fasteners_workbench_models(load_catalog(), selected_ids_from_args(args), args.render, args.width, args.height, args.threads)
    print(json.dumps({"counts": status["counts"], "statusPath": display_path(FASTENERS_STATUS_JSON)}, indent=2, sort_keys=True))
    return 0 if status["counts"]["failed"] == 0 else 1


def command_render_file(args: argparse.Namespace) -> int:
    paths = render_model_file(Path(args.model_path).resolve(), Path(args.output_dir).resolve(), args.document_name, args.width, args.height)
    print(json.dumps({"renderPaths": paths}, indent=2, sort_keys=True))
    return 0


def command_audit(_: argparse.Namespace) -> int:
    status = merge_status(load_catalog(), load_status())
    counts, errors = audit(status)
    print(json.dumps({"counts": counts, "errors": errors}, indent=2, sort_keys=True))
    return 0 if not errors else 1


def command_pipeline(args: argparse.Namespace) -> int:
    status = merge_status(load_catalog(), load_status())
    selected_ids = selected_ids_from_args(args)
    status = discover(status, selected_ids, args.dry_run)
    if not args.dry_run:
        status = render(status, selected_ids, args.width, args.height)
    write_json(STATUS_JSON, status)
    counts, errors = audit(status)
    print(json.dumps({"counts": counts, "errors": errors}, indent=2, sort_keys=True))
    return 0 if not errors else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Catalog CAD model acquisition and rendering pipeline")
    subcommands = parser.add_subparsers(dest="command", required=True)

    status_parser = subcommands.add_parser("status", help="Seed or print status from the TypeScript catalog")
    status_parser.add_argument("--write", action="store_true", help="Write research/catalog-assets/status.json")
    status_parser.set_defaults(func=command_status)

    boltsparts_sync_parser = subcommands.add_parser("boltsparts-sync", help="Mirror Boltsparts data and FreeCAD generator files")
    boltsparts_sync_parser.add_argument("--write-status", action="store_true", help="Refresh status.json after syncing")
    boltsparts_sync_parser.set_defaults(func=command_boltsparts_sync)

    boltsparts_index_parser = subcommands.add_parser("boltsparts-index", help="Print indexed Boltsparts classes from local data")
    boltsparts_index_parser.set_defaults(func=command_boltsparts_index)

    boltsparts_generate_parser = subcommands.add_parser("boltsparts-generate", help="Generate STEP models from matched Boltsparts FreeCAD classes")
    target = boltsparts_generate_parser.add_mutually_exclusive_group()
    target.add_argument("--all", action="store_true", help="Process all Boltsparts-matched catalog entries")
    target.add_argument("--catalog-id", help="Process one catalog entry")
    boltsparts_generate_parser.add_argument("--render", action="store_true", help="Render ISO PNG plus side/top SVG images after STEP generation")
    boltsparts_generate_parser.add_argument("--width", type=int, default=1024, help="Render width in pixels")
    boltsparts_generate_parser.add_argument("--height", type=int, default=1024, help="Render height in pixels")
    boltsparts_generate_parser.set_defaults(func=command_boltsparts_generate)

    fasteners_generate_parser = subcommands.add_parser("fasteners-generate", help="Generate STEP models from the FreeCAD Fasteners workbench")
    target = fasteners_generate_parser.add_mutually_exclusive_group()
    target.add_argument("--all", action="store_true", help="Process all Fasteners-matched catalog entries")
    target.add_argument("--catalog-id", help="Process one catalog entry")
    fasteners_generate_parser.add_argument("--render", action="store_true", help="Render ISO PNG plus side/top SVG images after STEP generation")
    fasteners_generate_parser.add_argument("--threads", action="store_true", help="Generate real thread geometry for Fasteners workbench parts that support it")
    fasteners_generate_parser.add_argument("--width", type=int, default=1024, help="Render width in pixels")
    fasteners_generate_parser.add_argument("--height", type=int, default=1024, help="Render height in pixels")
    fasteners_generate_parser.set_defaults(func=command_fasteners_generate)

    for name, help_text in (
        ("discover", "Discover direct model downloads"),
        ("render", "Render model images"),
        ("pipeline", "Run discovery and rendering"),
    ):
        command_parser = subcommands.add_parser(name, help=help_text)
        target = command_parser.add_mutually_exclusive_group()
        target.add_argument("--all", action="store_true", help="Process all catalog entries")
        target.add_argument("--catalog-id", help="Process one catalog entry")
        command_parser.add_argument("--dry-run", action="store_true", help="Do not download or render assets")
        command_parser.add_argument("--width", type=int, default=1024, help="Render width in pixels")
        command_parser.add_argument("--height", type=int, default=1024, help="Render height in pixels")
        command_parser.set_defaults(func={"discover": command_discover, "render": command_render, "pipeline": command_pipeline}[name])

    audit_parser = subcommands.add_parser("audit", help="Validate status file references")
    audit_parser.set_defaults(func=command_audit)

    render_file_parser = subcommands.add_parser("render-file", help="Render one arbitrary STEP/STL model")
    render_file_parser.add_argument("--model-path", required=True, help="Path to a STEP/STP/STL model")
    render_file_parser.add_argument("--output-dir", required=True, help="Directory for iso.png, side.svg, and top.svg")
    render_file_parser.add_argument("--document-name", default="catalog_asset_model", help="FreeCAD document name")
    render_file_parser.add_argument("--width", type=int, default=1024, help="Render width in pixels")
    render_file_parser.add_argument("--height", type=int, default=1024, help="Render height in pixels")
    render_file_parser.set_defaults(func=command_render_file)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
