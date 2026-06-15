import type { HardwareCategory, StandardCatalogEntry, StandardCodeMap, StandardFamily } from '../types';

export const standardFamilies: StandardFamily[] = ['ISO', 'DIN', 'EN', 'ASME', 'ASTM', 'SAE', 'JIS'];

export const standardPlaceholderKeys: Record<StandardFamily, string> = {
  ISO: 'standardIso',
  DIN: 'standardDin',
  EN: 'standardEn',
  ASME: 'standardAsme',
  ASTM: 'standardAstm',
  SAE: 'standardSae',
  JIS: 'standardJis'
};

const effectiveStandardFamilies = (selectedStandards: StandardFamily[] = standardFamilies) =>
  selectedStandards.length > 0 ? selectedStandards : standardFamilies;

export const combinedStandardCode = (standards: StandardCodeMap, selectedStandards: StandardFamily[] = standardFamilies) => {
  const values = effectiveStandardFamilies(selectedStandards).map((family) => standards[family]).filter(Boolean);
  return values.join(' / ');
};

export const catalogMatchesSelectedStandards = (entry: StandardCatalogEntry, selectedStandards: StandardFamily[]) =>
  selectedStandards.length === 0 || selectedStandards.some((family) => Boolean(entry.standards[family]));

export const catalogMatchesSelectedCategories = (entry: StandardCatalogEntry, selectedCategories: HardwareCategory[]) =>
  selectedCategories.length === 0 || selectedCategories.includes(entry.category);

export const catalogMatchesSelectedFilters = (
  entry: StandardCatalogEntry,
  selectedStandards: StandardFamily[],
  selectedCategories: HardwareCategory[]
) => catalogMatchesSelectedStandards(entry, selectedStandards) && catalogMatchesSelectedCategories(entry, selectedCategories);
