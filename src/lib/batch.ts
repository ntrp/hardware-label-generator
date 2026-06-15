import type { HardwareItem, HardwareSpecKey } from '../types';
import { standardsCatalog } from '../data/catalog';
import { createId } from './defaults';
import { parseList, splitLengthAndUnit } from './format';
import { isValidBoltClass } from './boltClasses';
import { isValidMaterialTreatment } from './materials';
import { categorySpecKeys, getCatalogWasherDimensionValue, isWasherDimensionKey, patchItemSpec, syncHardwareSpecs } from './specs';

const cartesian = <T,>(entries: T[][]): T[][] =>
  entries.reduce<T[][]>((sets, values) => sets.flatMap((set) => values.map((value) => [...set, value])), [[]]);

const normalizeSpecList = (base: HardwareItem, key: HardwareSpecKey, text: string | undefined) => {
  const values = parseList(text ?? '');
  if (values.length > 0) return values;
  if (key === 'length') return [base.length].filter(Boolean);
  return [base.specs?.[key] ?? ''].filter(Boolean);
};

const getBatchCatalogEntry = (item: HardwareItem) =>
  item.catalogId ? standardsCatalog.find((entry) => entry.id === item.catalogId) : undefined;

const batchSpecKeys = (base: HardwareItem) => {
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

export const generateBatchItems = (base: HardwareItem, specsText: Partial<Record<HardwareSpecKey, string>>): HardwareItem[] => {
  const keys = batchSpecKeys(base);
  const valueLists = keys.map((key) => normalizeSpecList(base, key, specsText[key]));

  return cartesian(valueLists).flatMap((values) => {
    let item: HardwareItem = {
      ...base,
      id: createId('item'),
      specs: { ...base.specs }
    };

    keys.forEach((key, index) => {
      const value = values[index] ?? '';
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

    const syncedItem = applyCatalogWasherDimensions(syncHardwareSpecs(item));
    return isValidMaterialTreatment(syncedItem.material, syncedItem.materialType) && isValidBoltClass(syncedItem) ? [syncedItem] : [];
  });
};
