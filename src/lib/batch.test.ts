import { describe, expect, it } from 'vitest';
import { generateBatchItems } from './batch';
import { defaultHardwareItem } from './defaults';

describe('batch generation', () => {
  it('creates all size and length combinations', () => {
    const items = generateBatchItems(defaultHardwareItem, {
      size: 'M2, M3',
      length: '6, 8, 10',
      threadPitchName: 'coarse',
      threadPitch: '0.5',
      threadPitchUnit: 'mm',
      material: 'stainless steel',
      materialType: 'A2',
      boltClass: 'A2-70'
    });

    expect(items).toHaveLength(6);
    expect(items.map((item) => `${item.size}x${item.length}`)).toEqual(['M2x6', 'M2x8', 'M2x10', 'M3x6', 'M3x8', 'M3x10']);
  });

  it('derives catalog washer dimensions from size during batch generation', () => {
    const washerBase = {
      ...defaultHardwareItem,
      id: 'item-din-125-washer',
      catalogId: 'din-125',
      category: 'washer' as const,
      standard: 'DIN 125 / ISO 7089',
      standardCodes: { DIN: 'DIN 125', ISO: 'ISO 7089', EN: 'EN ISO 7089' },
      size: 'M2',
      material: 'steel',
      materialType: 'zinc plated',
      boltClass: '',
      threadPitch: '',
      threadPitchName: '',
      threadPitchUnit: '',
      specs: {
        size: 'M2',
        thickness: '0.3 mm',
        innerDiameter: '2.2 mm',
        outerDiameter: '5 mm',
        material: 'steel',
        materialType: 'zinc plated'
      }
    };

    const items = generateBatchItems(washerBase, {
      size: 'M2, M6',
      thickness: '0.3 mm, 1.6 mm',
      innerDiameter: '2.2 mm, 6.4 mm',
      outerDiameter: '5 mm, 12 mm',
      material: 'steel',
      materialType: 'zinc plated'
    });

    expect(items).toHaveLength(2);
    expect(items.map((item) => [item.size, item.specs.thickness, item.specs.innerDiameter, item.specs.outerDiameter])).toEqual([
      ['M2', '0.3 mm', '2.2 mm', '5 mm'],
      ['M6', '1.6 mm', '6.4 mm', '12 mm']
    ]);
  });
});
