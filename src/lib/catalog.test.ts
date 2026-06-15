import { describe, expect, it } from 'vitest';

import { standardsCatalog } from '../data/catalog';
import { hardwareCategories } from '../components/hardware/hardwareConstants';
import { baseMaterials } from './materials';
import { getCatalogSpecOptions, getCatalogWasherDimensionValue, isWasherDimensionKey } from './specs';
import { metricThreadPitchesForSize } from './metricThreads';
import { imperialThreadPitchesForSize } from './imperialThreads';

const materialTypeFinishTerms = new Set([
  'zinc plated',
  'yellow zinc plated',
  'hot-dip galvanized',
  'mechanically galvanized',
  'zinc flake',
  'black oxide',
  'phosphate',
  'nickel plated',
  'chrome plated',
  'cadmium plated',
  'passivated',
  'anodized',
  'clear anodized',
  'black anodized',
  'natural',
  'black',
  'clear',
  'gray'
]);

const specValues = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((entry) => (Array.isArray(entry) ? entry : []));
  }
  return [];
};

describe('standards catalog', () => {
  it('is one canonical catalog with unique IDs', () => {
    expect(standardsCatalog.length).toBeGreaterThan(100);
    const ids = standardsCatalog.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps all entries inside supported categories, units, and base materials', () => {
    for (const entry of standardsCatalog) {
      expect(hardwareCategories, entry.id).toContain(entry.category);
      expect(['metric', 'imperial'], entry.id).toContain(entry.unitSystem);
      expect(entry.sizes[entry.unitSystem].length, `${entry.id} sizes`).toBeGreaterThan(0);
      expect(entry.lengths[entry.unitSystem].length, `${entry.id} lengths`).toBeGreaterThan(0);
      expect(entry.pitches[entry.unitSystem].length, `${entry.id} pitches`).toBeGreaterThan(0);

      for (const material of entry.materials) {
        expect(baseMaterials, `${entry.id} material ${material}`).toContain(material);
      }
    }
  });

  it('keeps material types separate from finishes', () => {
    for (const entry of standardsCatalog) {
      const materialTypes = specValues(entry.specs?.materialType);
      for (const materialType of materialTypes) {
        expect(materialTypeFinishTerms.has(String(materialType)), `${entry.id} materialType ${materialType}`).toBe(false);
      }
    }
  });

  it('keeps washer dimension rows aligned with washer sizes', () => {
    for (const entry of standardsCatalog.filter((candidate) => candidate.category === 'washer')) {
      for (const unitSystem of ['metric', 'imperial'] as const) {
        for (const key of ['thickness', 'innerDiameter', 'outerDiameter'] as const) {
          const spec = entry.specs?.[key];
          if (!isWasherDimensionKey(key) || !spec || Array.isArray(spec)) continue;

          const values = spec[unitSystem] ?? [];
          expect(values.length, `${entry.id} ${unitSystem} ${key}`).toBe(entry.sizes[unitSystem].length);
          expect(getCatalogWasherDimensionValue(entry, key, unitSystem, entry.sizes[unitSystem][0])).toBe(values[0]);
        }
      }
    }
  });

  it('matches public ISO 262 metric thread pitch examples', () => {
    expect(metricThreadPitchesForSize('M3')).toEqual([
      { size: 'M3', name: 'coarse', value: '0.50' },
      { size: 'M3', name: 'fine', value: '0.35' }
    ]);
    expect(metricThreadPitchesForSize('M10')).toEqual([
      { size: 'M10', name: 'coarse', value: '1.50' },
      { size: 'M10', name: 'fine', value: '1.25' },
      { size: 'M10', name: 'extra fine', value: '1.00' },
      { size: 'M10', name: 'extra fine 2', value: '0.75' }
    ]);
    expect(metricThreadPitchesForSize('M24')).toEqual([
      { size: 'M24', name: 'coarse', value: '3.00' },
      { size: 'M24', name: 'fine', value: '2.00' },
      { size: 'M24', name: 'extra fine', value: '1.50' },
      { size: 'M24', name: 'extra fine 2', value: '1.00' }
    ]);
  });

  it('matches public UTS UNC and UNF thread pitch examples', () => {
    expect(imperialThreadPitchesForSize('1/4"')).toEqual([
      { size: '1/4"', series: 'UNC', tpi: '20' },
      { size: '1/4"', series: 'UNF', tpi: '28' }
    ]);
    expect(imperialThreadPitchesForSize('1/2"')).toEqual([
      { size: '1/2"', series: 'UNC', tpi: '13' },
      { size: '1/2"', series: 'UNF', tpi: '20' }
    ]);
    expect(imperialThreadPitchesForSize('1"')).toEqual([
      { size: '1"', series: 'UNC', tpi: '8' },
      { size: '1"', series: 'UNF', tpi: '12' }
    ]);
  });

  it('uses nominal sizes and UNC/UNF choices for ASME B18.2.1 hex cap screws', () => {
    const entry = standardsCatalog.find((candidate) => candidate.id === 'asme-b18-2-1-hex-cap');
    expect(entry).toBeDefined();
    expect(entry?.sizes.imperial).toEqual(['1/4"', '5/16"', '3/8"', '7/16"', '1/2"', '9/16"', '5/8"', '3/4"', '7/8"', '1"']);
    expect(getCatalogSpecOptions(entry, 'bolt', 'threadPitchName', 'imperial')).toEqual([
      'UNC (20 TPI)',
      'UNF (28 TPI)',
      'UNC (18 TPI)',
      'UNF (24 TPI)',
      'UNC (16 TPI)',
      'UNC (14 TPI)',
      'UNF (20 TPI)',
      'UNC (13 TPI)',
      'UNC (12 TPI)',
      'UNF (18 TPI)',
      'UNC (11 TPI)',
      'UNC (10 TPI)',
      'UNF (16 TPI)',
      'UNC (9 TPI)',
      'UNF (14 TPI)',
      'UNC (8 TPI)',
      'UNF (12 TPI)'
    ]);
  });

  it('matches DIN 125 / ISO 7089 flat washer dimension examples', () => {
    const entry = standardsCatalog.find((candidate) => candidate.id === 'din-125');
    expect(entry).toBeDefined();
    expect(getCatalogWasherDimensionValue(entry, 'innerDiameter', 'metric', 'M2')).toBe('2.2 mm');
    expect(getCatalogWasherDimensionValue(entry, 'outerDiameter', 'metric', 'M2')).toBe('5 mm');
    expect(getCatalogWasherDimensionValue(entry, 'thickness', 'metric', 'M2')).toBe('0.3 mm');
    expect(getCatalogWasherDimensionValue(entry, 'innerDiameter', 'metric', 'M16')).toBe('17 mm');
    expect(getCatalogWasherDimensionValue(entry, 'outerDiameter', 'metric', 'M16')).toBe('30 mm');
    expect(getCatalogWasherDimensionValue(entry, 'thickness', 'metric', 'M16')).toBe('3 mm');
  });
});
