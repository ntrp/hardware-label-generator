import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { catalogAssetManifest } from '../data/catalogAssets';

const root = resolve(process.cwd());
const scriptPath = resolve(root, 'research/catalog-assets/scripts/catalog_assets.py');

describe('catalog asset pipeline', () => {
  it('keeps manifest entries backed by public asset files', () => {
    for (const [catalogId, assets] of Object.entries(catalogAssetManifest)) {
      for (const filename of Object.values(assets)) {
        expect(existsSync(resolve(root, 'public/catalog-assets', catalogId, filename)), `${catalogId}/${filename}`).toBe(true);
      }
    }
  });

  it('uses model assets for every bundled catalog asset set and consistent names when drawings are present', () => {
    for (const [catalogId, assets] of Object.entries(catalogAssetManifest)) {
      expect(assets.model, catalogId).toBe('model.glb');
      if (assets.isoRender || assets.iso || assets.side || assets.top) {
        expect(assets.isoRender, catalogId).toBe('iso_render.png');
        expect(assets.iso, catalogId).toBe('iso.svg');
        expect(assets.side, catalogId).toBe('side.svg');
        expect(assets.top, catalogId).toBe('top.svg');
      }
    }
  });

  it('can audit the public asset manifest without missing files', () => {
    const output = execFileSync('python3', [scriptPath, 'audit'], { cwd: root, encoding: 'utf8' });
    const audit = JSON.parse(output) as { counts: { manifestEntries: number; assetFiles: number }; errors: string[] };

    expect(audit.counts.manifestEntries).toBe(Object.keys(catalogAssetManifest).length);
    expect(audit.counts.assetFiles).toBe(Object.values(catalogAssetManifest).reduce((count, assets) => count + Object.keys(assets).length, 0));
    expect(audit.errors).toEqual([]);
  });
});
