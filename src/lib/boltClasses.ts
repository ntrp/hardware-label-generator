import type { HardwareItem, UnitSystem } from '../types';

export const metricBoltClasses = ['3.6', '4.6', '4.8', '5.6', '5.8', '6.8', '8.8', '8.8.3', '9.8', '10.9', '10.9.3', '12.9'] as const;
export const saeBoltGrades = ['grade 1', 'grade 2', 'grade 4', 'grade 5', 'grade 5.1', 'grade 5.2', 'grade 7', 'grade 8', 'grade 8.1'] as const;
export const stainlessStrengthClasses = ['50', '70', '80'] as const;

const stainlessFamilies = ['A1', 'A2', 'A4'] as const;

export const allBoltClasses = [
  ...metricBoltClasses,
  ...saeBoltGrades,
  ...stainlessFamilies.flatMap((family) => stainlessStrengthClasses.map((strength) => `${family}-${strength}`))
];

export const getBoltClassOptions = (item: Pick<HardwareItem, 'material' | 'materialType' | 'unitSystem'>, unitSystem: UnitSystem = item.unitSystem) => {
  const material = item.material.toLowerCase();
  const materialType = item.materialType.toUpperCase();

  if (material === 'stainless steel') {
    const family = stainlessFamilies.find((candidate) => materialType === candidate);
    return family ? stainlessStrengthClasses.map((strength) => `${family}-${strength}`) : allBoltClasses.filter((value) => value.startsWith('A'));
  }

  if (material === 'steel' || material === 'alloy steel') {
    return unitSystem === 'imperial' ? [...saeBoltGrades] : [...metricBoltClasses];
  }

  return [''];
};

export const defaultBoltClass = (item: Pick<HardwareItem, 'material' | 'materialType' | 'unitSystem'>, unitSystem: UnitSystem = item.unitSystem) =>
  getBoltClassOptions(item, unitSystem)[0] ?? '';

export const isValidBoltClass = (item: Pick<HardwareItem, 'material' | 'materialType' | 'unitSystem' | 'boltClass'>, unitSystem: UnitSystem = item.unitSystem) => {
  if (!item.boltClass) return true;
  return getBoltClassOptions(item, unitSystem).includes(item.boltClass);
};
