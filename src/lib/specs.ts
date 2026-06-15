import { standardsCatalog } from '../data/catalog';
import type { HardwareCategory, HardwareItem, HardwareSpecKey, StandardCatalogEntry, UnitSystem } from '../types';
import { defaultLengthUnit, defaultThreadPitchUnit, formatLength, splitLengthAndUnit, splitThreadPitchAndUnit } from './format';
import { metricThreadPitchNamesForSize, metricThreadPitchesForSize } from './metricThreads';

export interface SpecDefinition {
  key: HardwareSpecKey;
  label: string;
  placeholder: string;
  isLength?: boolean;
}

export const specDefinitions: Record<HardwareSpecKey, SpecDefinition> = {
  size: { key: 'size', label: 'Size', placeholder: 'size' },
  length: { key: 'length', label: 'Length', placeholder: 'length', isLength: true },
  threadPitchName: { key: 'threadPitchName', label: 'Pitch name', placeholder: 'threadPitchName' },
  threadPitch: { key: 'threadPitch', label: 'Thread pitch', placeholder: 'threadPitch' },
  threadPitchUnit: { key: 'threadPitchUnit', label: 'Pitch unit', placeholder: 'threadPitchUnit' },
  material: { key: 'material', label: 'Material', placeholder: 'material' },
  materialType: { key: 'materialType', label: 'Material type', placeholder: 'materialType' },
  boltClass: { key: 'boltClass', label: 'Bolt class', placeholder: 'boltClass' },
  thickness: { key: 'thickness', label: 'Thickness', placeholder: 'thickness' },
  innerDiameter: { key: 'innerDiameter', label: 'ID', placeholder: 'innerDiameter' },
  outerDiameter: { key: 'outerDiameter', label: 'OD', placeholder: 'outerDiameter' },
  gripRange: { key: 'gripRange', label: 'Grip range', placeholder: 'gripRange' }
};

export const categorySpecKeys: Record<HardwareCategory, HardwareSpecKey[]> = {
  screw: ['size', 'length', 'threadPitchName', 'threadPitch', 'threadPitchUnit', 'material', 'materialType', 'boltClass'],
  bolt: ['size', 'length', 'threadPitchName', 'threadPitch', 'threadPitchUnit', 'material', 'materialType', 'boltClass'],
  nut: ['size', 'threadPitchName', 'threadPitch', 'threadPitchUnit', 'material', 'materialType'],
  washer: ['size', 'thickness', 'innerDiameter', 'outerDiameter', 'material', 'materialType'],
  rivet: ['size', 'length', 'gripRange', 'material', 'materialType'],
  pin: ['size', 'length', 'material', 'materialType'],
  anchor: ['size', 'length', 'material', 'materialType'],
  insert: ['size', 'length', 'threadPitchName', 'threadPitch', 'threadPitchUnit', 'material', 'materialType'],
  clip: ['size', 'material', 'materialType'],
  custom: ['size', 'length', 'material', 'materialType']
};

export const categoryDefaultPreset: Record<HardwareCategory, string> = {
  screw: 'qr-sidecar',
  bolt: 'qr-sidecar',
  nut: 'compact',
  washer: 'washer',
  rivet: 'compact',
  pin: 'large-size',
  anchor: 'compact',
  insert: 'qr-sidecar',
  clip: 'large-size',
  custom: 'compact'
};

export const getCategorySpecDefinitions = (category: HardwareCategory) => categorySpecKeys[category].map((key) => specDefinitions[key]);

const uniqueValues = (values: string[]) => Array.from(new Set(values)).filter(Boolean);
type CatalogSpecs = NonNullable<StandardCatalogEntry['specs']>;
const specValuesForUnit = (value: CatalogSpecs[HardwareSpecKey] | undefined, unitSystem: UnitSystem) => {
  if (Array.isArray(value)) return value;
  if (value) return value[unitSystem];
  return undefined;
};

const catalogSpecValues = (entry: StandardCatalogEntry | undefined, key: HardwareSpecKey, unitSystem: UnitSystem) => {
  const fromSpecs = specValuesForUnit(entry?.specs?.[key], unitSystem);
  if (fromSpecs) return fromSpecs;
  if (entry && key === 'size') return entry.sizes[unitSystem];
  if (entry && key === 'length') return entry.lengths[unitSystem];
  if (entry && key === 'threadPitch') {
    if (unitSystem === 'metric') {
      const tableValues = [...new Set(entry.sizes.metric.flatMap((size) => metricThreadPitchesForSize(size).map((pitch) => pitch.value)))];
      if (tableValues.length > 0) return tableValues;
    }
    return entry.pitches[unitSystem]
      .map((value) => splitThreadPitchAndUnit(value, defaultThreadPitchUnit(unitSystem)).threadPitch)
      .filter(Boolean);
  }
  if (entry && key === 'threadPitchName') {
    if (unitSystem === 'metric') {
      const tableValues = [...new Set(entry.sizes.metric.flatMap((size) => metricThreadPitchNamesForSize(size)))];
      if (tableValues.length > 0) return tableValues;
    }
    return entry.pitches[unitSystem]
      .map((value) => splitThreadPitchAndUnit(value, defaultThreadPitchUnit(unitSystem)).threadPitch)
      .filter(Boolean);
  }
  if (entry && key === 'threadPitchUnit') {
    return entry.pitches[unitSystem]
      .map((value) => splitThreadPitchAndUnit(value, defaultThreadPitchUnit(unitSystem)).threadPitchUnit)
      .filter(Boolean);
  }
  if (entry && key === 'material') return entry.materials;
  return undefined;
};

const catalogSpecValuesForAllUnits = (entry: StandardCatalogEntry | undefined, key: HardwareSpecKey) =>
  uniqueValues([
    ...(catalogSpecValues(entry, key, 'metric') ?? []),
    ...(catalogSpecValues(entry, key, 'imperial') ?? [])
  ]);

export const getCatalogSpecOptions = (
  entry: StandardCatalogEntry | undefined,
  category: HardwareCategory,
  key: HardwareSpecKey,
  unitSystem: UnitSystem
) => {
  const direct = catalogSpecValues(entry, key, unitSystem);
  if (direct) return uniqueValues(direct);

  return uniqueValues(
    standardsCatalog
      .filter((candidate) => candidate.category === category)
      .flatMap((candidate) => catalogSpecValues(candidate, key, unitSystem) ?? [])
  );
};

export const getAllCatalogSpecOptions = (entry: StandardCatalogEntry | undefined, category: HardwareCategory, key: HardwareSpecKey) => {
  const direct = catalogSpecValuesForAllUnits(entry, key);
  if (direct.length > 0) return direct;

  return uniqueValues(
    standardsCatalog
      .filter((candidate) => candidate.category === category)
      .flatMap((candidate) => catalogSpecValuesForAllUnits(candidate, key))
  );
};

export const getItemSpecValue = (item: HardwareItem, key: HardwareSpecKey) => {
  if (key === 'size') return item.specs?.size ?? item.size;
  if (key === 'length') return item.specs?.length ?? item.length;
  if (key === 'threadPitch') return item.specs?.threadPitch ?? item.threadPitch;
  if (key === 'threadPitchName') return item.specs?.threadPitchName ?? item.threadPitchName;
  if (key === 'threadPitchUnit') return item.specs?.threadPitchUnit ?? item.threadPitchUnit;
  if (key === 'material') return item.specs?.material ?? item.material;
  if (key === 'materialType') return item.specs?.materialType ?? item.materialType;
  if (key === 'boltClass') return item.specs?.boltClass ?? item.boltClass;
  return item.specs?.[key] ?? '';
};

export const washerDimensionKeys: HardwareSpecKey[] = ['thickness', 'innerDiameter', 'outerDiameter'];

export const isWasherDimensionKey = (key: HardwareSpecKey) => washerDimensionKeys.includes(key);

export const getCatalogWasherDimensionValue = (
  entry: StandardCatalogEntry | undefined,
  key: HardwareSpecKey,
  unitSystem: UnitSystem,
  size: string
) => {
  if (!entry || entry.category !== 'washer' || !isWasherDimensionKey(key)) return undefined;

  const values = catalogSpecValues(entry, key, unitSystem) ?? [];
  if (values.length === 0) return undefined;
  if (values.length === 1) return values[0];

  const sizes = entry.sizes[unitSystem] ?? [];
  const sizeIndex = sizes.indexOf(size);
  if (sizeIndex < 0) return values[0];

  return values[sizeIndex] ?? values[values.length - 1];
};

export const syncHardwareSpecs = (item: HardwareItem): HardwareItem => ({
  ...item,
  size: getItemSpecValue(item, 'size'),
  length: getItemSpecValue(item, 'length'),
  threadPitch: getItemSpecValue(item, 'threadPitch'),
  threadPitchName: getItemSpecValue(item, 'threadPitchName'),
  threadPitchUnit: getItemSpecValue(item, 'threadPitchUnit'),
  material: getItemSpecValue(item, 'material'),
  materialType: getItemSpecValue(item, 'materialType'),
  boltClass: getItemSpecValue(item, 'boltClass'),
  specs: {
    ...item.specs,
    size: getItemSpecValue(item, 'size'),
    length: getItemSpecValue(item, 'length'),
    threadPitch: getItemSpecValue(item, 'threadPitch'),
    threadPitchName: getItemSpecValue(item, 'threadPitchName'),
    threadPitchUnit: getItemSpecValue(item, 'threadPitchUnit'),
    material: getItemSpecValue(item, 'material'),
    materialType: getItemSpecValue(item, 'materialType'),
    boltClass: getItemSpecValue(item, 'boltClass')
  }
});

export const patchItemSpec = (item: HardwareItem, key: HardwareSpecKey, value: string): Partial<HardwareItem> => {
  const specs = { ...item.specs, [key]: value };
  const patch: Partial<HardwareItem> = { specs };
  if (key === 'size') patch.size = value;
  if (key === 'threadPitch') patch.threadPitch = value;
  if (key === 'threadPitchName') patch.threadPitchName = value;
  if (key === 'threadPitchUnit') patch.threadPitchUnit = value;
  if (key === 'material') patch.material = value;
  if (key === 'materialType') patch.materialType = value;
  if (key === 'boltClass') patch.boltClass = value;
  if (key === 'length') patch.length = value;
  return patch;
};

export const firstSpecValue = (entry: StandardCatalogEntry, key: HardwareSpecKey, unitSystem: UnitSystem, fallback = '') =>
  getCatalogSpecOptions(entry, entry.category, key, unitSystem)[0] ?? fallback;

export const specValueForDisplay = (item: HardwareItem, key: HardwareSpecKey) =>
  key === 'length' ? formatLength(item.length, item.lengthUnit) : getItemSpecValue(item, key);

export const normalizeLengthSpec = (value: string, fallbackUnit: string) => splitLengthAndUnit(value, fallbackUnit);

export const defaultSpecValue = (category: HardwareCategory, key: HardwareSpecKey, unitSystem: UnitSystem) =>
  key === 'length' ? '' : getCatalogSpecOptions(undefined, category, key, unitSystem)[0] ?? '';

export const defaultLengthUnitForSpecs = defaultLengthUnit;
