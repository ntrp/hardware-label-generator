import { describe, expect, it } from 'vitest';
import { generateBatchItems } from './batch';
import { defaultHardwareItem } from './defaults';

describe('batch generation', () => {
  it('creates all size and length combinations', () => {
    const items = generateBatchItems(defaultHardwareItem, {
      size: 'M2, M3',
      length: '6, 8, 10',
      threadPitch: '0.5',
      threadPitchUnit: 'mm',
      material: 'stainless steel',
      materialType: 'A2',
      boltClass: 'A2-70'
    });

    expect(items).toHaveLength(6);
    expect(items.map((item) => `${item.size}x${item.length}`)).toEqual(['M2x6', 'M2x8', 'M2x10', 'M3x6', 'M3x8', 'M3x10']);
  });
});
