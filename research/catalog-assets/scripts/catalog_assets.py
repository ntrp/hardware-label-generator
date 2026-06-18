#!/usr/bin/env python3
"""Render catalog assets from flat STEP files.

Input STEP files are named with underscores, for example `din_912.step`.
Rendered assets are written by catalog id, for example
`public/catalog-assets/din-912/side.svg`, `top.svg`, `iso.svg`, and
`iso_render.png`.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
import textwrap
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_STEPS_DIR = ROOT / "research" / "catalog-assets" / "steps"
DEFAULT_OUTPUT_DIR = ROOT / "public" / "catalog-assets"
CATALOG_ASSET_MANIFEST = ROOT / "src" / "data" / "catalogAssets.ts"
BLENDER_CANDIDATES = (
    Path("/Applications/Blender.app/Contents/MacOS/Blender"),
    Path("/Applications/Blender.app/Contents/Resources/blender"),
)


def display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def catalog_id_to_step_name(catalog_id: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", catalog_id).strip("_").lower() + ".step"


def catalog_id_from_step_path(step_path: Path) -> str:
    return re.sub(r"_+", "-", step_path.stem.lower()).strip("-")


def find_blender() -> Path | None:
    for candidate in BLENDER_CANDIDATES:
        if candidate.exists():
            return candidate
    return None


def import_freecad() -> tuple[Any, Any, Any]:
    try:
        import FreeCAD  # type: ignore
        import Import  # type: ignore
        import Mesh  # type: ignore

        return FreeCAD, Import, Mesh
    except ImportError as error:
        raise RuntimeError("FreeCAD Python modules are not available. Run through run_freecad.py or FreeCADCmd.") from error


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
    hidden_style = {"stroke": "none", "fill": "none"}
    return TechDraw.projectToSVG(
        shape,
        direction,
        hStyle=hidden_style,
        h0Style=hidden_style,
        h1Style=hidden_style,
        vStyle=visible_style,
        v0Style=visible_style,
        v1Style=visible_style,
    )


def parse_svg_bbox(svg_body: str) -> tuple[float, float, float, float]:
    number = r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?"
    xs: list[float] = []
    ys: list[float] = []

    for match in re.finditer(r'<path\b([^>]*)\bd="([^"]+)"', svg_body):
        if 'stroke="none"' in match.group(1):
            continue
        for command in re.finditer(rf"[ML]\s*({number})\s*,?\s*({number})", match.group(2)):
            xs.append(float(command.group(1)))
            ys.append(-float(command.group(2)))

    for match in re.finditer(rf"<circle\b[^>]*\bcx\s*=\s*\"({number})\"[^>]*\bcy\s*=\s*\"({number})\"[^>]*\br\s*=\s*\"({number})\"", svg_body):
        cx = float(match.group(1))
        cy = -float(match.group(2))
        radius = abs(float(match.group(3)))
        xs.extend([cx - radius, cx + radius])
        ys.extend([cy - radius, cy + radius])

    if not xs or not ys:
        raise RuntimeError("FreeCAD technical projection did not produce drawable SVG geometry.")
    return (min(xs), min(ys), max(xs), max(ys))


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


TECHNICAL_VIEW_DIRECTIONS = {
    "iso": (1, -1, 1),
    "side": (0, -1, 0),
    "top": (0, 0, 1),
}


def render_technical_drawings(doc: Any, output_dir: Path, technical_views: list[str]) -> dict[str, str]:
    import FreeCAD  # type: ignore

    shape = combined_document_shape(doc.Objects)
    output_dir.mkdir(parents=True, exist_ok=True)
    rendered: dict[str, str] = {}
    for name in technical_views:
        direction = FreeCAD.Vector(*TECHNICAL_VIEW_DIRECTIONS[name])
        svg_body = project_shape_to_svg(shape, direction)
        bbox = parse_svg_bbox(svg_body)
        min_x, min_y, max_x, max_y = bbox
        margin = max(max_x - min_x, max_y - min_y, 1.0) * 0.08
        path = output_dir / f"{name}.svg"
        path.write_text(technical_svg_document(svg_body, bbox, margin), encoding="utf-8")
        rendered[name] = display_path(path)
    return rendered


def import_step_document(step_path: Path, document_name: str) -> tuple[Any, Any, Any]:
    if not step_path.exists():
        raise RuntimeError(f"STEP path is missing: {step_path}")
    if step_path.suffix.lower() not in (".step", ".stp"):
        raise RuntimeError(f"Expected a STEP/STP file, got: {step_path}")

    FreeCAD, Import, Mesh = import_freecad()
    doc = FreeCAD.newDocument(re.sub(r"[^A-Za-z0-9_]", "_", document_name))
    Import.insert(str(step_path), doc.Name)
    doc.recompute()
    return FreeCAD, Mesh, doc


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
        size = max((max_corner - min_corner).length, 0.001)
        obj.location -= center
        bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

        for polygon in obj.data.polygons:
            polygon.use_smooth = True

        metal_material = bpy.data.materials.new('polished_stainless_steel')
        metal_material.diffuse_color = (0.72, 0.72, 0.74, 1.0)
        metal_material.use_nodes = True
        shader = metal_material.node_tree.nodes.get('Principled BSDF')
        if shader:
            if 'Base Color' in shader.inputs:
                shader.inputs['Base Color'].default_value = (0.72, 0.72, 0.74, 1.0)
            if 'Metallic' in shader.inputs:
                shader.inputs['Metallic'].default_value = 0.90
            if 'Roughness' in shader.inputs:
                shader.inputs['Roughness'].default_value = 0.18
            for input_name, value in (
                ('Alpha', 1.0),
                ('Specular IOR Level', 1.0),
                ('Coat Weight', 0.35),
                ('Coat Roughness', 0.12),
                ('Anisotropic IOR Level', 0.60),
                ('Anisotropic', 0.60),
            ):
                if input_name in shader.inputs:
                    shader.inputs[input_name].default_value = value
        obj.data.materials.append(metal_material)

        scene = bpy.context.scene
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.film_transparent = True
        scene.render.image_settings.color_mode = 'RGBA'
        scene.render.image_settings.file_format = 'PNG'
        scene.world = bpy.data.worlds.new('catalog_world')
        scene.world.color = (1, 1, 1)
        engines = [item.identifier for item in scene.render.bl_rna.properties['engine'].enum_items]
        for engine in ('CYCLES', 'BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'BLENDER_WORKBENCH'):
            if engine in engines:
                scene.render.engine = engine
                break
        if scene.render.engine == 'CYCLES':
            scene.cycles.samples = 256
            scene.cycles.use_denoising = True
            scene.cycles.max_bounces = 10
            scene.cycles.diffuse_bounces = 4
            scene.cycles.glossy_bounces = 10
            scene.cycles.transparent_max_bounces = 10
        scene.world.use_nodes = True
        world_background = scene.world.node_tree.nodes.get('Background')
        if world_background:
            env_width = 1024
            env_height = 512
            env_image = bpy.data.images.new('studio_reflection_environment', width=env_width, height=env_height, alpha=True, float_buffer=False)
            env_pixels = [0.0] * (env_width * env_height * 4)
            for env_y in range(env_height):
                v = env_y / max(env_height - 1, 1)
                if 0.66 <= v <= 0.78:
                    value = 1.0
                elif 0.48 <= v <= 0.58:
                    value = 0.18
                elif v <= 0.22:
                    value = 0.28
                else:
                    value = 0.64
                for env_x in range(env_width):
                    u = env_x / max(env_width - 1, 1)
                    column_boost = 0.22 if 0.08 <= u <= 0.34 and 0.60 <= v <= 0.86 else 0.0
                    column_cut = -0.18 if 0.58 <= u <= 0.78 and 0.36 <= v <= 0.62 else 0.0
                    final = max(0.02, min(1.0, value + column_boost + column_cut))
                    index = (env_y * env_width + env_x) * 4
                    env_pixels[index:index + 4] = [final, final, min(1.0, final * 1.03), 1.0]
            env_image.pixels.foreach_set(env_pixels)
            env_image.pack()

            env_texture = scene.world.node_tree.nodes.new(type='ShaderNodeTexEnvironment')
            env_texture.image = env_image
            scene.world.node_tree.links.new(env_texture.outputs['Color'], world_background.inputs['Color'])
            world_background.inputs['Strength'].default_value = 1.15
        scene.view_settings.view_transform = 'Standard'
        scene.view_settings.look = 'None'
        scene.view_settings.exposure = 0.0
        scene.view_settings.gamma = 1

        floor_material = bpy.data.materials.new('matte_white_floor')
        floor_material.diffuse_color = (1, 1, 1, 1)
        floor_material.use_nodes = True
        floor_shader = floor_material.node_tree.nodes.get('Principled BSDF')
        if floor_shader:
            if 'Base Color' in floor_shader.inputs:
                floor_shader.inputs['Base Color'].default_value = (1, 1, 1, 1)
            if 'Roughness' in floor_shader.inputs:
                floor_shader.inputs['Roughness'].default_value = 0.62
        bpy.ops.mesh.primitive_plane_add(size=size * 7.0, location=(0, 0, -size * 0.78))
        floor = bpy.context.object
        floor.name = 'white_shadow_floor'
        floor.data.materials.append(floor_material)
        floor.visible_camera = False

        def make_principled_material(name, color, roughness=0.5, metallic=0.0):
            material = bpy.data.materials.new(name)
            material.diffuse_color = color
            material.use_nodes = True
            material_shader = material.node_tree.nodes.get('Principled BSDF')
            if material_shader:
                if 'Base Color' in material_shader.inputs:
                    material_shader.inputs['Base Color'].default_value = color
                if 'Roughness' in material_shader.inputs:
                    material_shader.inputs['Roughness'].default_value = roughness
                if 'Metallic' in material_shader.inputs:
                    material_shader.inputs['Metallic'].default_value = metallic
            return material

        def make_emission_material(name, color, strength):
            material = bpy.data.materials.new(name)
            material.diffuse_color = color
            material.use_nodes = True
            nodes = material.node_tree.nodes
            for node in nodes:
                nodes.remove(node)
            emission = nodes.new(type='ShaderNodeEmission')
            output = nodes.new(type='ShaderNodeOutputMaterial')
            emission.inputs['Color'].default_value = color
            emission.inputs['Strength'].default_value = strength
            material.node_tree.links.new(emission.outputs['Emission'], output.inputs['Surface'])
            return material

        white_reflector = make_emission_material('white_reflection_panel', (1.0, 1.0, 1.0, 1), 8.0)
        dark_reflector = make_principled_material('dark_reflection_panel', (0.18, 0.18, 0.20, 1), 0.28)
        mid_reflector = make_principled_material('mid_reflection_panel', (0.62, 0.62, 0.66, 1), 0.25)

        def add_reflection_card(name, location, rotation, scale, material):
            bpy.ops.mesh.primitive_plane_add(size=1, location=location, rotation=rotation)
            card = bpy.context.object
            card.name = name
            card.scale = scale
            card.data.materials.append(material)
            card.visible_camera = False
            card.visible_shadow = False
            if hasattr(card, 'visible_diffuse'):
                card.visible_diffuse = False
            if hasattr(card, 'visible_glossy'):
                card.visible_glossy = True

        # Hidden reflection panels create the bright/dark studio bands visible on polished metal.
        add_reflection_card('front_long_white_reflection', (0, -size * 2.16, size * 1.02), (math.radians(90), 0, math.radians(0)), (size * 6.2, size * 0.58, 1), white_reflector)
        add_reflection_card('front_low_dark_reflection', (0, -size * 2.48, size * 0.16), (math.radians(90), 0, math.radians(0)), (size * 5.8, size * 0.16, 1), dark_reflector)
        add_reflection_card('front_mid_reflection', (0, -size * 2.34, size * 0.48), (math.radians(90), 0, math.radians(0)), (size * 5.8, size * 0.18, 1), mid_reflector)
        add_reflection_card('overhead_white_softbox_reflection', (0, -size * 0.30, size * 2.05), (0, 0, 0), (size * 6.4, size * 1.05, 1), white_reflector)
        add_reflection_card('overhead_dark_gap_reflection', (0, size * 0.80, size * 1.68), (math.radians(18), 0, 0), (size * 6.2, size * 0.30, 1), dark_reflector)
        add_reflection_card('underside_dark_studio_reflection', (0, -size * 0.20, -size * 1.18), (0, 0, 0), (size * 6.4, size * 1.20, 1), dark_reflector)
        add_reflection_card('top_white_reflection_band', (0, -size * 0.18, size * 1.45), (math.radians(68), 0, math.radians(-8)), (size * 5.8, size * 0.42, 1), white_reflector)
        add_reflection_card('upper_dark_reflection_band', (0, -size * 0.86, size * 1.15), (math.radians(72), 0, math.radians(-12)), (size * 5.2, size * 0.18, 1), dark_reflector)
        add_reflection_card('lower_dark_reflection_band', (0, size * 2.20, -size * 0.08), (math.radians(82), 0, math.radians(8)), (size * 5.4, size * 0.30, 1), dark_reflector)

        def add_area_light(name, location, rotation, energy, light_size, shape='RECTANGLE', size_y=None):
            data = bpy.data.lights.new(name, 'AREA')
            data.energy = energy
            data.shape = shape
            data.size = light_size
            if size_y is not None and hasattr(data, 'size_y'):
                data.size_y = size_y
            light_object = bpy.data.objects.new(name, data)
            bpy.context.collection.objects.link(light_object)
            light_object.location = location
            direction = Vector((0, 0, 0)) - Vector(location)
            light_object.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

        add_area_light('long_top_strip', (size * 0.0, -size * 2.45, size * 2.05), (0, 0, 0), 36000, size * 0.12, 'RECTANGLE', size * 7.0)
        add_area_light('front_softbox', (-size * 2.10, -size * 2.05, size * 1.05), (0, 0, 0), 13000, size * 1.2, 'RECTANGLE', size * 3.2)
        add_area_light('head_face_strip', (-size * 2.0, -size * 1.25, size * 0.34), (0, 0, 0), 6800, size * 0.16, 'RECTANGLE', size * 2.2)
        add_area_light('right_thread_rim', (size * 2.2, -size * 2.65, size * 1.0), (0, 0, 0), 4800, size * 0.26, 'RECTANGLE', size * 3.6)
        add_area_light('low_edge_kicker', (size * 0.2, size * 2.6, size * 0.0), (0, 0, 0), 2600, size * 0.10, 'RECTANGLE', size * 5.0)

        camera_data = bpy.data.cameras.new('camera')
        camera = bpy.data.objects.new('camera', camera_data)
        bpy.context.collection.objects.link(camera)
        scene.camera = camera

        def look_at(target):
            direction = Vector(target) - camera.location
            camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

        obj.modifiers.clear()
        bevel = obj.modifiers.new('soft_edge_bevel', 'BEVEL')
        bevel.width = size * 0.0016
        bevel.segments = 2
        bevel.affect = 'EDGES'
        if hasattr(bevel, 'harden_normals'):
            bevel.harden_normals = True
        weighted_normals = obj.modifiers.new('weighted_normals', 'WEIGHTED_NORMAL')
        if hasattr(weighted_normals, 'keep_sharp'):
            weighted_normals.keep_sharp = True
        obj.rotation_euler = (math.radians(90), 0, math.radians(-28))
        obj.data.materials.clear()
        obj.data.materials.append(metal_material)
        camera.data.type = 'PERSP'
        camera.data.lens = 82
        camera.data.clip_start = size * 0.001
        camera.data.clip_end = size * 30
        camera.location = Vector((size * 1.80, -size * 2.28, size * 1.05))
        look_at((0, 0, 0))
        scene.render.filepath = f"{{output_dir}}/iso_render.png"
        bpy.ops.render.render(write_still=True)
        """
    )


def flatten_render_background(output_dir: Path, names: tuple[str, ...]) -> None:
    try:
        from PIL import Image  # type: ignore
    except ImportError as error:
        raise RuntimeError("Pillow is required to flatten transparent Blender renders onto a white background.") from error

    for name in names:
        path = output_dir / name
        image = Image.open(path).convert("RGBA")
        bbox = image.getchannel("A").getbbox()
        if bbox is None:
            raise RuntimeError(f"{name} has no visible rendered pixels.")
        if bbox:
            cropped = image.crop(bbox)
            centered = Image.new("RGBA", image.size, (255, 255, 255, 0))
            centered.alpha_composite(cropped, ((image.width - cropped.width) // 2, (image.height - cropped.height) // 2))
            image = centered
        background = Image.new("RGBA", image.size, (255, 255, 255, 255))
        background.alpha_composite(image)
        flattened = background.convert("RGB")
        diff_bbox = flattened.point(lambda value: 255 - value).getbbox()
        if diff_bbox is None:
            raise RuntimeError(f"{name} is blank after flattening.")
        flattened.save(path)


def run_blender_script(script_source: str) -> None:
    blender = find_blender()
    if blender is None:
        raise RuntimeError("Blender was not found.")
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as script:
        script.write(script_source)
        script_path = Path(script.name)
    try:
        subprocess.run([str(blender), "--background", "--python", str(script_path)], check=True, cwd=ROOT)
    finally:
        script_path.unlink(missing_ok=True)


def render_stl_with_blender(stl_path: Path, output_dir: Path, width: int, height: int) -> str:
    run_blender_script(blender_render_script(stl_path, output_dir, width, height))
    iso_path = output_dir / "iso_render.png"
    if not iso_path.exists():
        raise RuntimeError("Blender render did not create iso_render.png.")
    flatten_render_background(output_dir, ("iso_render.png",))
    return display_path(iso_path)


def blender_glb_script(stl_path: Path, glb_path: Path) -> str:
    return textwrap.dedent(
        f"""
        import bpy

        stl_path = {str(stl_path)!r}
        glb_path = {str(glb_path)!r}

        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete()

        if hasattr(bpy.ops.wm, 'stl_import'):
            bpy.ops.wm.stl_import(filepath=stl_path)
        else:
            bpy.ops.import_mesh.stl(filepath=stl_path)

        for obj in bpy.context.scene.objects:
            if obj.type == 'MESH':
                obj.select_set(True)
                bpy.context.view_layer.objects.active = obj
            else:
                obj.select_set(False)

        bpy.ops.object.shade_smooth_by_angle(angle=0.523599)
        bpy.ops.export_scene.gltf(
            filepath=glb_path,
            export_format='GLB',
            use_selection=True,
            export_apply=True,
            export_materials='EXPORT',
            export_yup=True
        )
        """
    )


def convert_stl_to_glb(stl_path: Path, output_dir: Path) -> str:
    output_dir.mkdir(parents=True, exist_ok=True)
    glb_path = output_dir / "model.glb"
    run_blender_script(blender_glb_script(stl_path, glb_path))
    if not glb_path.exists():
        raise RuntimeError("Blender did not create model.glb.")
    return display_path(glb_path)


def convert_step_to_glb(step_path: Path, output_root: Path) -> dict[str, str]:
    catalog_id = catalog_id_from_step_path(step_path)
    output_dir = output_root / catalog_id
    FreeCAD, Mesh, doc = import_step_document(step_path, f"catalog_model_{catalog_id}")
    output_dir.mkdir(parents=True, exist_ok=True)
    stl_path = output_dir / "model-source.stl"
    try:
        Mesh.export(doc.Objects, str(stl_path))
        return {"model": convert_stl_to_glb(stl_path, output_dir)}
    finally:
        stl_path.unlink(missing_ok=True)
        FreeCAD.closeDocument(doc.Name)


def render_step(step_path: Path, output_root: Path, include_iso: bool, include_technical: bool, technical_views: list[str], width: int, height: int) -> dict[str, str]:
    catalog_id = catalog_id_from_step_path(step_path)
    output_dir = output_root / catalog_id
    FreeCAD, Mesh, doc = import_step_document(step_path, f"catalog_asset_{catalog_id}")
    output_dir.mkdir(parents=True, exist_ok=True)
    rendered: dict[str, str] = {}
    stl_path = output_dir / "render-source.stl"
    try:
        if include_technical:
            rendered.update(render_technical_drawings(doc, output_dir, technical_views))
        if include_iso:
            Mesh.export(doc.Objects, str(stl_path))
            rendered["isoRender"] = render_stl_with_blender(stl_path, output_dir, width, height)
    finally:
        stl_path.unlink(missing_ok=True)
        FreeCAD.closeDocument(doc.Name)
    return rendered


def step_paths_for_args(args: argparse.Namespace) -> list[Path]:
    if args.step_path:
        return [Path(args.step_path).resolve()]

    steps_dir = Path(args.steps_dir).resolve()
    if args.catalog_id:
        return [steps_dir / catalog_id_to_step_name(args.catalog_id)]
    if args.all:
        return sorted(steps_dir.glob("*.step")) + sorted(steps_dir.glob("*.stp"))
    raise RuntimeError("Choose --all, --catalog-id, or --step-path.")


def manifest_entries() -> dict[str, dict[str, str]]:
    source = CATALOG_ASSET_MANIFEST.read_text(encoding="utf-8")
    entries: dict[str, dict[str, str]] = {}
    for entry_match in re.finditer(r"'([^']+)':\s*\{([^}]*)\}", source):
        catalog_id = entry_match.group(1)
        body = entry_match.group(2)
        entries[catalog_id] = {key: value for key, value in re.findall(r"(model|isoRender|iso|side|top):\s*'([^']+)'", body)}
    return entries


def audit_public_assets(output_dir: Path, check_steps: bool, steps_dir: Path) -> tuple[dict[str, int], list[str]]:
    entries = manifest_entries()
    errors: list[str] = []
    asset_count = 0
    for catalog_id, assets in entries.items():
        for label, filename in assets.items():
            asset_count += 1
            path = output_dir / catalog_id / filename
            if not path.exists():
                errors.append(f"{catalog_id}: missing {label} asset {display_path(path)}")
        if check_steps:
            step_path = steps_dir / catalog_id_to_step_name(catalog_id)
            if not step_path.exists():
                errors.append(f"{catalog_id}: missing STEP file {display_path(step_path)}")
    return {"manifestEntries": len(entries), "assetFiles": asset_count}, errors


def command_render(args: argparse.Namespace) -> int:
    output_dir = Path(args.output_dir).resolve()
    if args.technical_view is None:
        args.technical_view = list(TECHNICAL_VIEW_DIRECTIONS)
    rendered = []
    errors = []
    for step_path in step_paths_for_args(args):
        try:
            rendered.append({"stepPath": display_path(step_path), "renderPaths": render_step(step_path, output_dir, args.iso, not args.iso_only, args.technical_view, args.width, args.height)})
        except Exception as error:  # noqa: BLE001 - batch command should report all failures.
            errors.append({"stepPath": display_path(step_path), "error": str(error)})
    print(json.dumps({"rendered": rendered, "errors": errors}, indent=2, sort_keys=True))
    return 0 if not errors else 1


def command_convert(args: argparse.Namespace) -> int:
    output_dir = Path(args.output_dir).resolve()
    converted = []
    errors = []
    for step_path in step_paths_for_args(args):
        try:
            converted.append({"stepPath": display_path(step_path), "assetPaths": convert_step_to_glb(step_path, output_dir)})
        except Exception as error:  # noqa: BLE001 - batch command should report all failures.
            errors.append({"stepPath": display_path(step_path), "error": str(error)})
    print(json.dumps({"converted": converted, "errors": errors}, indent=2, sort_keys=True))
    return 0 if not errors else 1


def command_audit(args: argparse.Namespace) -> int:
    counts, errors = audit_public_assets(Path(args.output_dir).resolve(), args.check_steps, Path(args.steps_dir).resolve())
    print(json.dumps({"counts": counts, "errors": errors}, indent=2, sort_keys=True))
    return 0 if not errors else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Render catalog ISO/side/top SVGs and optional ISO render PNGs from flat STEP files.")
    subcommands = parser.add_subparsers(dest="command", required=True)

    render_parser = subcommands.add_parser("render", help="Render one or more STEP files")
    target = render_parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--all", action="store_true", help="Render every STEP/STP file in --steps-dir")
    target.add_argument("--catalog-id", help="Render one catalog id, for example din-912")
    target.add_argument("--step-path", help="Render one explicit STEP/STP file")
    render_parser.add_argument("--steps-dir", default=str(DEFAULT_STEPS_DIR), help="Directory containing flat STEP files like din_912.step")
    render_parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Output root for catalog assets")
    render_parser.add_argument("--iso", action="store_true", help="Also render iso_render.png through Blender")
    render_parser.add_argument("--iso-only", action="store_true", help="Render only iso_render.png and leave existing technical SVGs untouched")
    render_parser.add_argument(
        "--technical-view",
        action="append",
        choices=sorted(TECHNICAL_VIEW_DIRECTIONS),
        default=None,
        help="Technical SVG view to render. Repeat for multiple views. Defaults to iso, side, and top.",
    )
    render_parser.add_argument("--width", type=int, default=1280, help="ISO render width in pixels")
    render_parser.add_argument("--height", type=int, default=768, help="ISO render height in pixels")
    render_parser.set_defaults(func=command_render)

    convert_parser = subcommands.add_parser("convert", help="Convert one or more STEP files to GLB model assets")
    convert_target = convert_parser.add_mutually_exclusive_group(required=True)
    convert_target.add_argument("--all", action="store_true", help="Convert every STEP/STP file in --steps-dir")
    convert_target.add_argument("--catalog-id", help="Convert one catalog id, for example din-912")
    convert_target.add_argument("--step-path", help="Convert one explicit STEP/STP file")
    convert_parser.add_argument("--steps-dir", default=str(DEFAULT_STEPS_DIR), help="Directory containing flat STEP files like din_912.step")
    convert_parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Output root for catalog assets")
    convert_parser.set_defaults(func=command_convert)

    audit_parser = subcommands.add_parser("audit", help="Validate public catalog assets referenced by the TypeScript manifest")
    audit_parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Output root for catalog assets")
    audit_parser.add_argument("--steps-dir", default=str(DEFAULT_STEPS_DIR), help="Directory containing flat STEP files")
    audit_parser.add_argument("--check-steps", action="store_true", help="Also require a STEP file for every manifest entry")
    audit_parser.set_defaults(func=command_audit)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
