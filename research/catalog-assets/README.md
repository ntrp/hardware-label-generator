# Catalog Asset Pipeline

Offline tooling for generating local fastener model assets. The browser app remains standalone; these scripts are build/research tooling and are not loaded by Vite.

## Pipeline

1. Generate flat STEP files from the installed FreeCAD Fasteners workbench.
2. Render side/top SVG technical drawings from those STEP files.
3. Optionally render an ISO PNG through Blender.
4. Copy or keep generated assets under `public/catalog-assets/<catalog-id>/`.

STEP is the handoff format between generation and rendering. It preserves CAD geometry better than mesh-only formats and keeps the renderer independent from the Fasteners workbench.

## Directory Layout

```text
research/catalog-assets/
  steps/                # ignored by git except .gitkeep; files like din_912.step
  scripts/
    generate_fasteners_steps.py
    catalog_assets.py
    run_freecad.py
```

Rendered app assets live in:

```text
public/catalog-assets/<catalog-id>/
  iso.png
  side.svg
  top.svg
```

## Commands

Generate STEP files from FreeCAD Fasteners Workbench:

```bash
pnpm research:assets:steps
python3 research/catalog-assets/scripts/run_freecad.py generate-fasteners-steps generate --catalog-id din-912 --threads
python3 research/catalog-assets/scripts/run_freecad.py generate-fasteners-steps list-types
```

Render side/top SVGs from flat STEP files:

```bash
pnpm research:assets:technical
python3 research/catalog-assets/scripts/run_freecad.py catalog-assets render --catalog-id din-912
```

Render side/top SVGs plus ISO PNGs:

```bash
pnpm research:assets:render
python3 research/catalog-assets/scripts/run_freecad.py catalog-assets render --catalog-id din-912 --iso
```

Render one explicit STEP file:

```bash
python3 research/catalog-assets/scripts/run_freecad.py catalog-assets render \
  --step-path research/catalog-assets/steps/din_912.step \
  --output-dir public/catalog-assets \
  --iso
```

Audit public asset files referenced by `src/data/catalogAssets.ts`:

```bash
pnpm research:assets:audit
```

Also require matching STEP files for every manifest entry:

```bash
python3 research/catalog-assets/scripts/catalog_assets.py audit --check-steps
```

## File Naming

STEP filenames use underscores and map directly to catalog ids:

- `din_912.step` -> `public/catalog-assets/din-912/`
- `iso_7380.step` -> `public/catalog-assets/iso-7380/`
- `asme_b18_2_1_hex_cap.step` -> `public/catalog-assets/asme-b18-2-1-hex-cap/`

The renderer does not know how a STEP file was created. Any valid `.step` or `.stp` file following this naming convention can be rendered.
