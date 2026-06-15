import type { HardwareItem, HardwareSpecKey } from '../types';
import { standardsCatalog } from '../data/catalog';
import { parseList, splitLengthAndUnit } from './format';
import { defaultBoltClass, getBoltClassOptions, isValidBoltClass } from './boltClasses';
import { defaultImperialThreadPitch, findImperialThreadPitch } from './imperialThreads';
import { defaultMetricThreadPitch, findMetricThreadPitch } from './metricThreads';
import { defaultFinish, defaultMaterialTreatment, isValidFinish, isValidMaterialTreatment } from './materials';
import { categorySpecKeys, getCatalogWasherDimensionValue, getItemSpecValue, isWasherDimensionKey, patchItemSpec, syncHardwareSpecs } from './specs';

type BatchOptionDependencyKey = 'size' | 'material' | 'materialType';
type BatchOptionDependencies = Partial<Record<BatchOptionDependencyKey, string>>;

const batchOptionPrefix = 'batchctx:';
const batchOptionSeparator = '|';

const cartesian = <T,>(entries: T[][]): T[][] =>
  entries.reduce<T[][]>((sets, values) => sets.flatMap((set) => values.map((value) => [...set, value])), [[]]);

export const encodeBatchOptionValue = (value: string, dependencies: BatchOptionDependencies = {}) => {
  const dependencyText = Object.entries(dependencies)
    .filter(([, dependencyValue]) => dependencyValue)
    .map(([key, dependencyValue]) => `${encodeURIComponent(key)}=${encodeURIComponent(dependencyValue)}`)
    .join('&');

  if (!dependencyText) return value;
  return `${batchOptionPrefix}${dependencyText}${batchOptionSeparator}${encodeURIComponent(value)}`;
};

export const decodeBatchOptionValue = (encodedValue: string): { value: string; dependencies: BatchOptionDependencies } => {
  if (!encodedValue.startsWith(batchOptionPrefix)) return { value: encodedValue, dependencies: {} };

  const payload = encodedValue.slice(batchOptionPrefix.length);
  const separatorIndex = payload.indexOf(batchOptionSeparator);
  if (separatorIndex === -1) return { value: encodedValue, dependencies: {} };

  const dependencyText = payload.slice(0, separatorIndex);
  const value = decodeURIComponent(payload.slice(separatorIndex + batchOptionSeparator.length));
  const dependencies = Object.fromEntries(
    dependencyText
      .split('&')
      .filter(Boolean)
      .map((entry) => {
        const [key, dependencyValue = ''] = entry.split('=');
        return [decodeURIComponent(key), decodeURIComponent(dependencyValue)];
      })
  ) as BatchOptionDependencies;

  return { value, dependencies };
};

export const batchOptionLabel = (encodedValue: string) => {
  const { value, dependencies } = decodeBatchOptionValue(encodedValue);
  const prefix = [dependencies.size, dependencies.material, dependencies.materialType].filter(Boolean).join(' / ');
  return prefix ? `${prefix}: ${value}` : value;
};

const optionMatchesItem = (encodedValue: string, item: HardwareItem) => {
  const { dependencies } = decodeBatchOptionValue(encodedValue);
  if (dependencies.size && dependencies.size !== item.size) return false;
  if (dependencies.material && dependencies.material !== item.material) return false;
  if (dependencies.materialType && dependencies.materialType !== item.materialType) return false;
  return true;
};

const normalizeSpecList = (base: HardwareItem, key: HardwareSpecKey, text: string | undefined) => {
  const values = parseList(text ?? '');
  if (values.length > 0) return values;
  if (key === 'length') return [base.length].filter(Boolean);
  return [getItemSpecValue(base, key)].filter(Boolean);
};

const getBatchCatalogEntry = (item: HardwareItem) =>
  item.catalogId ? standardsCatalog.find((entry) => entry.id === item.catalogId) : undefined;

export const batchSpecKeys = (base: HardwareItem) => {
  const entry = getBatchCatalogEntry(base);
  const keys = categorySpecKeys[base.category];
  if (entry?.category !== 'washer') return keys;
  return keys.filter((key) => !isWasherDimensionKey(key));
};

const applyCatalogWasherDimensions = (item: HardwareItem): HardwareItem => {
  const entry = getBatchCatalogEntry(item);
  if (entry?.category !== 'washer') return item;

  const specs = { ...item.specs };
  for (const key of ['thickness', 'innerDiameter', 'outerDiameter'] as HardwareSpecKey[]) {
    const value = getCatalogWasherDimensionValue(entry, key, entry.unitSystem, item.size);
    if (value) specs[key] = value;
  }

  return syncHardwareSpecs({ ...item, specs });
};

const normalizeGeneratedSize = (item: HardwareItem): HardwareItem => {
  const metricPitch = item.unitSystem === 'metric'
    ? findMetricThreadPitch(item.size, item.threadPitchName) ?? findMetricThreadPitch(item.size, item.threadPitch) ?? defaultMetricThreadPitch(item.size)
    : undefined;
  const imperialPitch = item.unitSystem === 'imperial'
    ? findImperialThreadPitch(item.size, item.threadPitchName) ?? findImperialThreadPitch(item.size, item.threadPitch) ?? defaultImperialThreadPitch(item.size)
    : undefined;
  const boltClass = isValidBoltClass(item) ? item.boltClass : defaultBoltClass(item);

  return {
    ...item,
    boltClass,
    ...(metricPitch
      ? { threadPitchName: metricPitch.name, threadPitch: metricPitch.value, threadPitchUnit: 'mm' }
      : imperialPitch
        ? { threadPitchName: imperialPitch.series, threadPitch: imperialPitch.tpi, threadPitchUnit: 'TPI' }
        : {}),
    specs: {
      ...item.specs,
      boltClass,
      ...(metricPitch
        ? { threadPitchName: metricPitch.name, threadPitch: metricPitch.value, threadPitchUnit: 'mm' }
        : imperialPitch
          ? { threadPitchName: imperialPitch.series, threadPitch: imperialPitch.tpi, threadPitchUnit: 'TPI' }
          : {})
    }
  };
};

const enabledBatchKeys = (base: HardwareItem) =>
  batchSpecKeys(base).filter((key) => base.batch.activeKeys.includes(key));

export const generateBatchItems = (base: HardwareItem): HardwareItem[] => {
  const keys = batchSpecKeys(base);
  const activeKeys = enabledBatchKeys(base);
  const specsText = base.batch.specs;
  const valueLists = keys.map((key) =>
    activeKeys.includes(key) ? normalizeSpecList(base, key, specsText[key]) : [getItemSpecValue(base, key)].filter(Boolean)
  );

  return cartesian(valueLists).flatMap((values) => {
    let item: HardwareItem = {
      ...base,
      id: base.id,
      specs: { ...base.specs }
    };

    let validCombination = true;

    keys.forEach((key, index) => {
      const activeKey = activeKeys.includes(key);
      const encodedValue = values[index] ?? '';
      if (!optionMatchesItem(encodedValue, item)) {
        if (key === 'boltClass' && getBoltClassOptions(item).length === 0) return;
        validCombination = false;
        return;
      }

      let value = decodeBatchOptionValue(encodedValue).value;
      if (!activeKey && key === 'materialType' && !isValidMaterialTreatment(item.material, value)) {
        value = defaultMaterialTreatment(item.material);
      }
      if (!activeKey && key === 'finish' && !isValidFinish(item.material, value)) {
        value = defaultFinish(item.material);
      }
      if (!activeKey && key === 'boltClass' && !isValidBoltClass({ ...item, boltClass: value })) {
        value = defaultBoltClass(item);
      }

      if (key === 'length') {
        const { length, lengthUnit } = splitLengthAndUnit(value, base.lengthUnit);
        item = {
          ...item,
          ...patchItemSpec(item, key, length),
          lengthUnit
        };
        return;
      }

      item = {
        ...item,
        ...patchItemSpec(item, key, value)
      };
    });

    if (!validCombination) return [];

    const syncedItem = applyCatalogWasherDimensions(syncHardwareSpecs(normalizeGeneratedSize(item)));
    return isValidMaterialTreatment(syncedItem.material, syncedItem.materialType) && isValidFinish(syncedItem.material, syncedItem.finish) && isValidBoltClass(syncedItem)
      ? [syncedItem]
      : [];
  });
};

const effectivePartKey = (item: HardwareItem) =>
  JSON.stringify({
    catalogId: item.catalogId ?? '',
    category: item.category,
    standard: item.standard,
    standardCodes: item.standardCodes,
    size: item.size,
    length: item.length,
    lengthUnit: item.lengthUnit,
    material: item.material,
    materialType: item.materialType,
    finish: item.finish,
    boltClass: item.boltClass,
    threadPitch: item.threadPitch,
    threadPitchName: item.threadPitchName,
    threadPitchUnit: item.threadPitchUnit,
    specs: Object.fromEntries(Object.entries(item.specs).sort(([left], [right]) => left.localeCompare(right))),
    unitSystem: item.unitSystem
  });

export interface EffectiveHardwareItemsResult {
  items: HardwareItem[];
  duplicateCount: number;
  duplicateGroups: HardwareItem[][];
}

export const resolveEffectiveHardwareItems = (items: HardwareItem[]): EffectiveHardwareItemsResult => {
  const seen = new Map<string, HardwareItem[]>();
  const resolved: HardwareItem[] = [];
  let duplicateCount = 0;

  for (const sourceItem of items) {
    const candidates = sourceItem.batch.enabled ? generateBatchItems(sourceItem) : [sourceItem];

    for (const item of candidates) {
      const key = effectivePartKey(item);
      const group = seen.get(key);
      if (group) {
        group.push(item);
        duplicateCount += 1;
        continue;
      }

      seen.set(key, [item]);
      resolved.push(item);
    }
  }

  return {
    items: resolved,
    duplicateCount,
    duplicateGroups: [...seen.values()].filter((group) => group.length > 1)
  };
};

export const batchPreviewLabel = (item: HardwareItem) => {
  const parts = [item.size];
  if (item.length) parts.push(`x ${formatLengthForPreview(item)}`);
  return parts.filter(Boolean).join(' ');
};

const formatLengthForPreview = (item: HardwareItem) =>
  item.lengthUnit && item.lengthUnit !== 'standard' ? `${item.length} ${item.lengthUnit}` : item.length;
