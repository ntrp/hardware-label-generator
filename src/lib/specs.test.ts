import { describe, expect, it } from 'vitest';

import { standardsCatalog } from '../data/catalog';
import { getAllCatalogSpecOptions, getCatalogSpecOptions } from './specs';

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
});
