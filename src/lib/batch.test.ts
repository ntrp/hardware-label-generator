import { describe, expect, it } from 'vitest';
import { encodeBatchOptionValue, generateBatchItems, resolveEffectiveHardwareItems } from './batch';
import { defaultHardwareItem } from './defaults';
import type { HardwareSpecKey } from '../types';

describe('batch generation', () => {
  it('creates all size and length combinations', () => {
    const items = generateBatchItems({
      ...defaultHardwareItem,
      batch: {
        enabled: true,
        activeKeys: ['size', 'length'] as HardwareSpecKey[],
        specs: {
          size: 'M1, M2',
          length: '6, 12'
        }
      }
    });

    expect(items).toHaveLength(4);
    expect(items.map((item) => `${item.size}x${item.length}`)).toEqual(['M1x6', 'M1x12', 'M2x6', 'M2x12']);
  });

  it('keeps unchecked properties at the current part value', () => {
    const items = generateBatchItems({
      ...defaultHardwareItem,
      length: '16',
      specs: { ...defaultHardwareItem.specs, length: '16' },
      batch: {
        enabled: true,
        activeKeys: ['size'] as HardwareSpecKey[],
        specs: {
          size: 'M2, M3',
          length: '6, 12'
        }
      }
    });

    expect(items.map((item) => `${item.size}x${item.length}`)).toEqual(['M2x16', 'M3x16']);
  });

  it('keeps only full valid pitch combinations', () => {
    const items = generateBatchItems({
      ...defaultHardwareItem,
      batch: {
        enabled: true,
        activeKeys: ['size', 'threadPitchName'] as HardwareSpecKey[],
        specs: {
          size: 'M1, M2',
          threadPitchName: [
            encodeBatchOptionValue('fine (0.20 mm)', { size: 'M1' }),
            encodeBatchOptionValue('coarse (0.40 mm)', { size: 'M2' })
          ].join(', ')
        }
      }
    });

    expect(items).toHaveLength(2);
    expect(items.map((item) => `${item.size}:${item.threadPitchName}:${item.threadPitch}`)).toEqual([
      'M1:fine:0.20',
      'M2:coarse:0.40'
    ]);
  });

  it('applies material-owned batch keys', () => {
    const items = generateBatchItems({
      ...defaultHardwareItem,
      batch: {
        enabled: true,
        activeKeys: ['size', 'threadPitchName', 'material', 'materialType', 'finish', 'boltClass'] as HardwareSpecKey[],
        specs: {
          size: 'M2',
          threadPitchName: encodeBatchOptionValue('coarse (0.40 mm)', { size: 'M2' }),
          material: 'steel',
          materialType: encodeBatchOptionValue('low carbon', { material: 'steel' }),
          finish: encodeBatchOptionValue('zinc plated', { material: 'steel' }),
          boltClass: encodeBatchOptionValue('3.6', { size: 'M2', material: 'steel', materialType: 'low carbon' })
        }
      }
    });

    expect(items.map((item) => `${item.size}:${item.material}:${item.materialType}:${item.finish}:${item.boltClass}`)).toEqual(['M2:steel:low carbon:zinc plated:3.6']);
  });

  it('uses current material-owned values when material-owned fields are ignored', () => {
    const items = generateBatchItems({
      ...defaultHardwareItem,
      batch: {
        enabled: true,
        activeKeys: ['size', 'threadPitchName'] as HardwareSpecKey[],
        specs: {
          size: 'M1, M2',
          threadPitchName: [
            encodeBatchOptionValue('coarse (0.25 mm)', { size: 'M1' }),
            encodeBatchOptionValue('coarse (0.40 mm)', { size: 'M2' })
          ].join(', ')
        }
      }
    });

    expect(items.map((item) => `${item.size}:${item.material}:${item.materialType}:${item.finish}:${item.boltClass}`)).toEqual([
      'M1:stainless steel:A2:plain:',
      'M2:stainless steel:A2:plain:A2-70'
    ]);
  });

  it('resolves disabled batches to the original item only', () => {
    const result = resolveEffectiveHardwareItems([
      {
        ...defaultHardwareItem,
        batch: {
          enabled: false,
          activeKeys: ['size', 'length'] as HardwareSpecKey[],
          specs: {
            size: 'M1, M2',
            length: '6, 12'
          }
        }
      }
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].size).toBe(defaultHardwareItem.size);
    expect(result.duplicateCount).toBe(0);
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
      materialType: 'low carbon',
      finish: 'zinc plated',
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
        materialType: 'low carbon',
        finish: 'zinc plated'
      },
      batch: {
        enabled: true,
        activeKeys: ['size'] as HardwareSpecKey[],
        specs: {
          size: 'M2, M6',
          thickness: '0.3 mm, 1.6 mm',
          innerDiameter: '2.2 mm, 6.4 mm',
          outerDiameter: '5 mm, 12 mm',
          material: 'steel',
          materialType: 'low carbon',
          finish: 'zinc plated'
        }
      }
    };

    const items = generateBatchItems(washerBase);

    expect(items).toHaveLength(2);
    expect(items.map((item) => [item.size, item.specs.thickness, item.specs.innerDiameter, item.specs.outerDiameter])).toEqual([
      ['M2', '0.3 mm', '2.2 mm', '5 mm'],
      ['M6', '1.6 mm', '6.4 mm', '12 mm']
    ]);
  });

  it('deduplicates effective parts produced by different source configs', () => {
    const first = {
      ...defaultHardwareItem,
      id: 'item-a',
      batch: {
        enabled: true,
        activeKeys: ['size', 'length'] as HardwareSpecKey[],
        specs: { size: 'M2', length: '6, 12' }
      }
    };
    const second = {
      ...defaultHardwareItem,
      id: 'item-b',
      batch: {
        enabled: true,
        activeKeys: ['size', 'length'] as HardwareSpecKey[],
        specs: { size: 'M2', length: '12' }
      }
    };

    const result = resolveEffectiveHardwareItems([first, second]);

    expect(result.items.map((item) => `${item.size}x${item.length}`)).toEqual(['M2x6', 'M2x12']);
    expect(result.duplicateCount).toBe(1);
    expect(result.duplicateGroups).toHaveLength(1);
  });

  it('sorts generated parts by size, length, pitch, material, type, finish, and bolt class', () => {
    const items = generateBatchItems({
      ...defaultHardwareItem,
      batch: {
        enabled: true,
        activeKeys: ['size', 'length', 'threadPitchName', 'material', 'materialType', 'finish', 'boltClass'] as HardwareSpecKey[],
        specs: {
          size: 'M2, M1',
          length: '12, 6',
          threadPitchName: [
            encodeBatchOptionValue('fine (0.20 mm)', { size: 'M1' }),
            encodeBatchOptionValue('coarse (0.25 mm)', { size: 'M1' }),
            encodeBatchOptionValue('coarse (0.40 mm)', { size: 'M2' })
          ].join(', '),
          material: 'steel, stainless steel',
          materialType: [
            encodeBatchOptionValue('low carbon', { material: 'steel' }),
            encodeBatchOptionValue('A2', { material: 'stainless steel' })
          ].join(', '),
          finish: [
            encodeBatchOptionValue('zinc plated', { material: 'steel' }),
            encodeBatchOptionValue('plain', { material: 'steel' }),
            encodeBatchOptionValue('plain', { material: 'stainless steel' })
          ].join(', '),
          boltClass: encodeBatchOptionValue('3.6', { size: 'M2', material: 'steel', materialType: 'low carbon' })
        }
      }
    });

    expect(items.slice(0, 6).map((item) => `${item.size}:${item.length}:${item.threadPitch}:${item.material}:${item.materialType}:${item.finish}:${item.boltClass}`)).toEqual([
      'M1:6:0.20:stainless steel:A2:plain:',
      'M1:6:0.20:steel:low carbon:plain:',
      'M1:6:0.20:steel:low carbon:zinc plated:',
      'M1:6:0.25:stainless steel:A2:plain:',
      'M1:6:0.25:steel:low carbon:plain:',
      'M1:6:0.25:steel:low carbon:zinc plated:'
    ]);
  });
});
