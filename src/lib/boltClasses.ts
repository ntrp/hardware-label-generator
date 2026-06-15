import type { HardwareItem, UnitSystem } from '../types';

export const metricBoltClasses = ['3.6', '4.6', '4.8', '5.6', '5.8', '6.8', '8.8', '8.8.3', '9.8', '10.9', '10.9.3', '12.9'] as const;
export const metricSetScrewClasses = ['14H', '22H', '33H', '45H'] as const;
export const saeBoltGrades = ['grade 1', 'grade 2', 'grade 4', 'grade 5', 'grade 5.1', 'grade 5.2', 'grade 7', 'grade 8', 'grade 8.1'] as const;
export const stainlessStrengthClasses = ['50', '70', '80'] as const;

const stainlessFamilies = ['A1', 'A2', 'A4'] as const;
const metricClassRanges: Record<(typeof metricBoltClasses)[number], { min: number; max: number }> = {
  '3.6': { min: 1.6, max: 39 },
  '4.6': { min: 5, max: 39 },
  '4.8': { min: 1.6, max: 16 },
  '5.6': { min: 5, max: 39 },
  '5.8': { min: 5, max: 24 },
  '6.8': { min: 5, max: 39 },
  '8.8': { min: 1.6, max: 39 },
  '8.8.3': { min: 1.6, max: 39 },
  '9.8': { min: 1.6, max: 16 },
  '10.9': { min: 5, max: 39 },
  '10.9.3': { min: 5, max: 39 },
  '12.9': { min: 1.6, max: 39 }
};
const metricSetScrewClassRange = { min: 1.6, max: 24 };
const metricStainlessClassRange = { min: 1.6, max: 39 };
const saeGradeRange = { min: 0.25, max: 1.5 };

export const allBoltClasses = [
  ...metricBoltClasses,
  ...metricSetScrewClasses,
  ...saeBoltGrades,
  ...stainlessFamilies.flatMap((family) => stainlessStrengthClasses.map((strength) => `${family}-${strength}`))
];

const isInRange = (value: number | undefined, range: { min: number; max: number }) =>
  value !== undefined && value >= range.min && value <= range.max;

export const metricDiameterMm = (size: string) => {
  const match = size.trim().match(/^M(\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : undefined;
};

const parseFraction = (value: string) => {
  const [numerator, denominator] = value.split('/').map(Number);
  return denominator ? numerator / denominator : undefined;
};

export const imperialDiameterInches = (size: string) => {
  const trimmed = size.trim().replace(/"$/, '').replace(/-\d+$/, '');
  if (trimmed.startsWith('#')) return undefined;
  if (trimmed.includes('-')) {
    const [whole, fraction] = trimmed.split('-');
    const fractionValue = parseFraction(fraction);
    return fractionValue === undefined ? undefined : Number(whole) + fractionValue;
  }
  if (trimmed.includes('/')) return parseFraction(trimmed);
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
};

export const getBoltClassOptions = (
  item: Pick<HardwareItem, 'material' | 'materialType' | 'size' | 'unitSystem'>,
  unitSystem: UnitSystem = item.unitSystem
) => {
  const material = item.material.toLowerCase();
  const materialType = item.materialType.toUpperCase();

  if (material === 'stainless steel') {
    if (unitSystem === 'imperial' || !isInRange(metricDiameterMm(item.size), metricStainlessClassRange)) return [];
    const family = stainlessFamilies.find((candidate) => materialType === candidate);
    return family ? stainlessStrengthClasses.map((strength) => `${family}-${strength}`) : allBoltClasses.filter((value) => value.startsWith('A'));
  }

  if (material === 'steel' || material === 'alloy steel') {
    if (unitSystem === 'imperial') {
      return isInRange(imperialDiameterInches(item.size), saeGradeRange) ? [...saeBoltGrades] : [];
    }

    const diameter = metricDiameterMm(item.size);
    return [
      ...metricBoltClasses.filter((boltClass) => isInRange(diameter, metricClassRanges[boltClass])),
      ...(isInRange(diameter, metricSetScrewClassRange) ? [...metricSetScrewClasses] : [])
    ];
  }

  return [];
};

export const defaultBoltClass = (
  item: Pick<HardwareItem, 'material' | 'materialType' | 'size' | 'unitSystem'>,
  unitSystem: UnitSystem = item.unitSystem
) =>
  getBoltClassOptions(item, unitSystem)[0] ?? '';

export const isValidBoltClass = (
  item: Pick<HardwareItem, 'material' | 'materialType' | 'size' | 'unitSystem' | 'boltClass'>,
  unitSystem: UnitSystem = item.unitSystem
) => {
  if (!item.boltClass) return true;
  return getBoltClassOptions(item, unitSystem).includes(item.boltClass);
};
