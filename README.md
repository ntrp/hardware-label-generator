# Standalone Fastener Label Generator

Browser-only React/Vite app for creating organizer labels for fasteners and hardware bins.

## Features

- Hardware item editor for screws, bolts, nuts, washers, rivets, pins, anchors, inserts, clips, and custom bins.
- Configurable label width, height, and Brother tape width in millimeters.
- Metric and imperial display mode.
- Layout templates plus editable placed fields.
- Per-field font family, size, weight, visibility, and geometry controls.
- Purchase links stored in browser `localStorage`.
- QR codes embed a self-contained purchase-link page, so printed labels can be scanned from another device without a backend.
- Batch generation from size and length lists.
- SVG, PNG, LBX, multi-label ZIP, and browser print sheet export.
- Static standards catalog with provenance notes and user-editable item data.

## Development

```bash
pnpm install
pnpm dev --host 127.0.0.1 --port 4321
```

Run checks:

```bash
pnpm test
pnpm build
```

## Deployment

The app is configured for GitHub Pages through `.github/workflows/deploy-pages.yml`.

1. Push the repository to GitHub.
2. In the GitHub repository, open **Settings → Pages**.
3. Set **Build and deployment → Source** to **GitHub Actions**.
4. Push to `main` or `master`, or run **Deploy to GitHub Pages** manually from the Actions tab.

The Vite build uses relative asset paths, so the same build works for both user/organization Pages sites and project Pages sites.

## LBX Export

The LBX exporter is intentionally isolated in `src/lib/lbx.ts`. Without Brother P-touch Editor-generated golden `.lbx` samples, the app emits a structured XML-based LBX template marked as unverified. Full-fidelity LBX support should be completed by adding representative fixture files for each target tape/layout and teaching the adapter to merge generated objects into those fixture structures.
