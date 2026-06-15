# Catalog Asset Pipeline

Offline tooling for finding CAD models for catalog parts and generating label-ready images.

The browser app remains standalone. These scripts are research/build tooling and are not loaded by the Vite app.

## Model Format Policy

- Prefer `STEP` (`.step` / `.stp`) as the canonical CAD format.
- Accept `STL` as a fallback when STEP is unavailable.
- Keep original downloads in `models/<catalogId>/original.<ext>`.
- Create `models/<catalogId>/normalized.step` when FreeCAD can import and re-export the source.

STEP is the preferred source because it preserves CAD geometry better than triangle-only mesh formats.

## Directory Layout

```text
research/catalog-assets/
  status.json
  sources.json
  boltsparts/          # mirrored BOLTS data and FreeCAD generator sources
  models/              # ignored by git except .gitkeep
  renders/             # ignored by git except .gitkeep
  scripts/
    catalog_assets.py
```

## Commands

Commands that generate or render geometry require FreeCAD. Rendering uses FreeCAD to export an STL working mesh and Blender in background mode to produce PNG views when available.

Seed or refresh status from the current TypeScript catalog:

```bash
python3 research/catalog-assets/scripts/catalog_assets.py status --write
```

Mirror Boltsparts/BOLTS data and FreeCAD generator files, then refresh status:

```bash
python3 research/catalog-assets/scripts/catalog_assets.py boltsparts-sync --write-status
```

Inspect the local Boltsparts class index:

```bash
python3 research/catalog-assets/scripts/catalog_assets.py boltsparts-index
```

Generate default STEP models for catalog entries that match Boltsparts classes:

```bash
python3 research/catalog-assets/scripts/run_freecad.py boltsparts-generate --all
python3 research/catalog-assets/scripts/run_freecad.py boltsparts-generate --catalog-id din-912
```

Generate STEP models and render images in one pass:

```bash
python3 research/catalog-assets/scripts/run_freecad.py boltsparts-generate --all --render
```

Try to discover/download model sources:

```bash
python3 research/catalog-assets/scripts/catalog_assets.py discover --all
python3 research/catalog-assets/scripts/catalog_assets.py discover --catalog-id din-1587
```

Render images for downloaded models:

```bash
python3 research/catalog-assets/scripts/run_freecad.py render --catalog-id din-912
python3 research/catalog-assets/scripts/run_freecad.py render --all
```

Render any one model directly:

```bash
python3 research/catalog-assets/scripts/run_freecad.py render-file \
  --model-path /path/to/model.step \
  --output-dir research/catalog-assets/renders/manual-test
```

Audit status and referenced local files:

```bash
python3 research/catalog-assets/scripts/catalog_assets.py audit
```

Run discovery then rendering:

```bash
python3 research/catalog-assets/scripts/catalog_assets.py pipeline --all
```

## Output Images

Each rendered catalog part should produce:

- `renders/<catalogId>/iso.png`: orthographic shaded isometric view.
- `renders/<catalogId>/side.png`: orthographic wireframe side view.
- `renders/<catalogId>/top.png`: orthographic wireframe top view.

## Source Policy

The discovery command is deliberately conservative. It does not bypass login walls, paywalls, anti-bot checks, or provider terms. If a model cannot be downloaded directly from a public page, the entry is marked as blocked or missing in `status.json`.

Boltsparts/BOLTS is the preferred model provider when a catalog entry matches one of its standards. The mirrored `.blt` data identifies the part class and parameters, while the mirrored FreeCAD backend contains the procedural generator code needed to create local model geometry.
