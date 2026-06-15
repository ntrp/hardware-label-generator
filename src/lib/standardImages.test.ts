import { describe, expect, it } from 'vitest';

import { defaultHardwareItem } from './defaults';
import { standardImageReferenceForItem, standardImageUrlForItem } from './standardImages';

describe('standard images', () => {
  it('builds local asset URLs from the catalog id', () => {
    const item = { ...defaultHardwareItem, catalogId: 'din-912' };

    expect(standardImageReferenceForItem(item)).toEqual({
      catalogId: 'din-912',
      isoUrl: './catalog-assets/din-912/iso.png',
      sideUrl: './catalog-assets/din-912/side.svg',
      topUrl: './catalog-assets/din-912/top.svg'
    });
    expect(standardImageUrlForItem(item, 'side')).toBe('./catalog-assets/din-912/side.svg');
    expect(standardImageUrlForItem(item, 'top')).toBe('./catalog-assets/din-912/top.svg');
  });

  it('returns no image URL for custom items without bundled assets', () => {
    expect(standardImageUrlForItem({ ...defaultHardwareItem, catalogId: undefined }, 'side')).toBe('');
  });
});
