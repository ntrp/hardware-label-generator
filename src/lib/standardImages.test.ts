import { describe, expect, it } from 'vitest';

import { defaultHardwareItem } from './defaults';
import { missingCatalogAssetDataUrl, standardImageReferenceForItem, standardImageUrlForItem } from './standardImages';

describe('standard images', () => {
  it('builds local asset URLs from the catalog id', () => {
    const item = { ...defaultHardwareItem, catalogId: 'din-912' };

    expect(standardImageReferenceForItem(item)).toEqual({
      catalogId: 'din-912',
      modelUrl: './catalog-assets/din-912/model.glb',
      isoRenderUrl: './catalog-assets/din-912/iso_render.png',
      isoUrl: './catalog-assets/din-912/iso.svg',
      sideUrl: './catalog-assets/din-912/side.svg',
      topUrl: './catalog-assets/din-912/top.svg'
    });
    expect(standardImageUrlForItem(item, 'iso')).toBe('./catalog-assets/din-912/iso.svg');
    expect(standardImageUrlForItem(item, 'side')).toBe('./catalog-assets/din-912/side.svg');
    expect(standardImageUrlForItem(item, 'top')).toBe('./catalog-assets/din-912/top.svg');
  });

  it('returns a placeholder URL for custom items without bundled assets', () => {
    expect(standardImageUrlForItem({ ...defaultHardwareItem, catalogId: undefined }, 'side')).toBe(missingCatalogAssetDataUrl('Side drawing'));
  });
});
