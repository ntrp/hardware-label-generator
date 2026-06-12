import type { HardwareItem, HardwareSpecKey } from '../types';
import { createId } from './defaults';
import { parseList, splitLengthAndUnit } from './format';
import { categorySpecKeys, patchItemSpec, syncHardwareSpecs } from './specs';

const cartesian = <T,>(entries: T[][]): T[][] =>
  entries.reduce<T[][]>((sets, values) => sets.flatMap((set) => values.map((value) => [...set, value])), [[]]);

const normalizeSpecList = (base: HardwareItem, key: HardwareSpecKey, text: string | undefined) => {
  const values = parseList(text ?? '');
  if (values.length > 0) return values;
  if (key === 'length') return [base.length].filter(Boolean);
  return [base.specs?.[key] ?? ''].filter(Boolean);
};

export const generateBatchItems = (base: HardwareItem, specsText: Partial<Record<HardwareSpecKey, string>>): HardwareItem[] => {
  const keys = categorySpecKeys[base.category];
  const valueLists = keys.map((key) => normalizeSpecList(base, key, specsText[key]));

  return cartesian(valueLists).map((values) => {
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

    return syncHardwareSpecs(item);
  });
};
