import { describe, expect, it } from 'vitest';

import { defaultHardwareItem } from './defaults';
import { standardImageReferenceForItem, standardImageUrlForItem } from './standardImages';

describe('standard images', () => {
  it('builds fasteners.eu page and image URLs from catalog standard codes', () => {
    const item = {
      ...defaultHardwareItem,
      standardCodes: { DIN: 'DIN 1587', ISO: 'ISO 4032' }
    };

    expect(standardImageReferenceForItem(item)).toEqual({
      family: 'DIN',
      number: '1587',
      pageUrl: 'https://www.fasteners.eu/standards/DIN/1587/',
      sideUrl: 'https://www.fasteners.eu/img/products/3d/din1587.jpg',
      topUrl: 'https://www.fasteners.eu/img/products/din-1587.jpg'
    });
    expect(standardImageUrlForItem(item, 'side')).toBe('https://www.fasteners.eu/img/products/3d/din1587.jpg');
    expect(standardImageUrlForItem(item, 'top')).toBe('https://www.fasteners.eu/img/products/din-1587.jpg');
  });

  it('returns no image URL for custom items without standard codes', () => {
    expect(standardImageUrlForItem({ ...defaultHardwareItem, standardCodes: {} }, 'side')).toBe('');
  });
});
