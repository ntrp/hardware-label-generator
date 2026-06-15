import { describe, expect, it } from 'vitest';
import {
  catalogMatchesSelectedCategories,
  catalogMatchesSelectedFilters,
  catalogMatchesSelectedStandards,
  combinedStandardCode
} from './standards';
import type { StandardCatalogEntry } from '../types';

const catalogEntry: StandardCatalogEntry = {
  id: 'din-912',
  category: 'screw',
  unitSystem: 'metric',
  family: 'DIN',
  code: 'DIN 912',
  standards: { DIN: 'DIN 912', ISO: 'ISO 4762' },
  description: 'Socket head cap screw',
  sizes: { metric: ['M3'], imperial: [] },
  lengths: { metric: ['12'], imperial: [] },
  materials: ['stainless steel'],
  pitches: { metric: ['0.5'], imperial: [] },
  sourceId: 'test'
};

describe('standards', () => {
  it('shows every available standard code when no standard display filter is selected', () => {
    expect(combinedStandardCode(catalogEntry.standards, [])).toBe('ISO 4762 / DIN 912');
  });

  it('treats empty standard and category selections as unfiltered', () => {
    expect(catalogMatchesSelectedStandards(catalogEntry, [])).toBe(true);
    expect(catalogMatchesSelectedCategories(catalogEntry, [])).toBe(true);
    expect(catalogMatchesSelectedFilters(catalogEntry, [], [])).toBe(true);
  });

  it('matches selected standards and categories as active filters', () => {
    expect(catalogMatchesSelectedFilters(catalogEntry, ['DIN'], ['screw'])).toBe(true);
    expect(catalogMatchesSelectedFilters(catalogEntry, ['ASME'], ['screw'])).toBe(false);
    expect(catalogMatchesSelectedFilters(catalogEntry, ['DIN'], ['washer'])).toBe(false);
  });
});
