import type { StandardCatalogEntry, StandardCodeMap, StandardFamily } from '../types';

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

export const combinedStandardCode = (standards: StandardCodeMap, selectedStandards: StandardFamily[] = standardFamilies) => {
  const values = selectedStandards.map((family) => standards[family]).filter(Boolean);
  return values.join(' / ');
};

export const catalogMatchesSelectedStandards = (entry: StandardCatalogEntry, selectedStandards: StandardFamily[]) =>
  selectedStandards.some((family) => Boolean(entry.standards[family]));
