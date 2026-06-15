import { describe, expect, it } from 'vitest';

import { standardsCatalog } from '../data/catalog';
import { getAllCatalogSpecOptions, getCatalogSpecOptions, getCatalogWasherDimensionValue } from './specs';

describe('catalog spec options', () => {
  it('returns metric and imperial values for a selected catalog part', () => {
    const entry = standardsCatalog.find((candidate) => candidate.id === 'din-912');
    expect(entry).toBeDefined();

    const sizes = getAllCatalogSpecOptions(entry, 'screw', 'size');
    expect(sizes).toEqual(expect.arrayContaining(['M3', '1/4"']));

    const pitchUnits = getAllCatalogSpecOptions(entry, 'screw', 'threadPitchUnit');
    expect(pitchUnits).toEqual(expect.arrayContaining(['mm', 'TPI']));
  });

  it('falls back to all category values when no catalog part is selected', () => {
    const sizes = getAllCatalogSpecOptions(undefined, 'screw', 'size');
    expect(sizes).toEqual(expect.arrayContaining(['M3', '#2-56']));
  });

  it('returns only standard-relevant measures for catalog selects', () => {
    const metricEntry = standardsCatalog.find((candidate) => candidate.id === 'din-912');
    expect(metricEntry).toBeDefined();

    const metricSizes = getCatalogSpecOptions(metricEntry, 'screw', 'size', 'metric');
    expect(metricSizes).toContain('M3');
    expect(metricSizes).not.toContain('1/4"');

    const imperialEntry = standardsCatalog.find((candidate) => candidate.id === 'unc-socket-cap');
    expect(imperialEntry).toBeDefined();

    const imperialSizes = getCatalogSpecOptions(imperialEntry, 'screw', 'size', 'imperial');
    expect(imperialSizes).toContain('#2-56');
    expect(imperialSizes).not.toContain('M3 equivalent');

    const imperialPitches = getCatalogSpecOptions(imperialEntry, 'screw', 'threadPitchName', 'imperial');
    expect(imperialPitches).toContain('UNC (56 TPI)');
    expect(imperialPitches).not.toContain('56');
  });

  it('includes the full metric thread table sizes for metric screw catalog parts', () => {
    const entry = standardsCatalog.find((candidate) => candidate.id === 'din-912');
    expect(entry).toBeDefined();

    const sizes = getCatalogSpecOptions(entry, 'screw', 'size', 'metric');
    expect(sizes).toEqual(expect.arrayContaining(['M1', 'M1.7', 'M2.2', 'M2.3', 'M2.6', 'M7', 'M9', 'M68', 'M100']));
  });

  it('includes intermediate standard metric screw lengths', () => {
    const entry = standardsCatalog.find((candidate) => candidate.id === 'din-912');
    expect(entry).toBeDefined();

    const lengths = getCatalogSpecOptions(entry, 'screw', 'length', 'metric');
    expect(lengths).toEqual(expect.arrayContaining(['5', '18', '22']));
  });

  it('uses nominal imperial sizes so UNC and UNF are selected through pitch name', () => {
    const hexCapEntry = standardsCatalog.find((candidate) => candidate.id === 'asme-b18-2-1-hex-cap');
    expect(hexCapEntry).toBeDefined();

    expect(getCatalogSpecOptions(hexCapEntry, 'bolt', 'size', 'imperial')).toEqual(
      expect.arrayContaining(['1/4"', '5/16"', '3/8"', '1/2"', '1"'])
    );
    expect(getCatalogSpecOptions(hexCapEntry, 'bolt', 'threadPitchName', 'imperial')).toEqual(
      expect.arrayContaining(['UNC (20 TPI)', 'UNF (28 TPI)', 'UNC (13 TPI)', 'UNF (20 TPI)'])
    );
  });

  it('maps catalog washer dimensions from the selected size', () => {
    const entry = standardsCatalog.find((candidate) => candidate.id === 'din-125');
    expect(entry).toBeDefined();

    expect(getCatalogWasherDimensionValue(entry, 'thickness', 'metric', 'M6')).toBe('1.6 mm');
    expect(getCatalogWasherDimensionValue(entry, 'innerDiameter', 'metric', 'M6')).toBe('6.4 mm');
    expect(getCatalogWasherDimensionValue(entry, 'outerDiameter', 'metric', 'M6')).toBe('12 mm');
  });

  it('keeps fixed washer dimensions readonly when the catalog only exposes a standard value', () => {
    const entry = standardsCatalog.find((candidate) => candidate.id === 'din-127');
    expect(entry).toBeDefined();

    expect(getCatalogWasherDimensionValue(entry, 'thickness', 'metric', 'M6')).toBe('standard');
    expect(getCatalogWasherDimensionValue(entry, 'innerDiameter', 'metric', 'M6')).toBe('standard');
    expect(getCatalogWasherDimensionValue(entry, 'outerDiameter', 'metric', 'M6')).toBe('standard');
  });
});
