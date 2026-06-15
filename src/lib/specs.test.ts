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
  });

  it('includes the full metric thread table sizes for metric screw catalog parts', () => {
    const entry = standardsCatalog.find((candidate) => candidate.id === 'din-912');
    expect(entry).toBeDefined();

    const sizes = getCatalogSpecOptions(entry, 'screw', 'size', 'metric');
    expect(sizes).toEqual(expect.arrayContaining(['M1', 'M1.7', 'M2.2', 'M2.3', 'M2.6', 'M7', 'M9', 'M68', 'M100']));
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
