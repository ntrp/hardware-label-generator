import { standardsCatalog } from '../../data/catalog';
import { defaultLengthUnit, formatLength } from '../../lib/format';
import { builtInLabelPresets } from '../../lib/presets';
import { defaultFinish, defaultMaterialTreatment, isValidFinish, isValidMaterialTreatment } from '../../lib/materials';
import { defaultBoltClass, isValidBoltClass } from '../../lib/boltClasses';
import { defaultImperialThreadPitch } from '../../lib/imperialThreads';
import { defaultMetricThreadPitch } from '../../lib/metricThreads';
import { combinedStandardCode } from '../../lib/standards';
import {
  categoryDefaultPreset,
  categorySpecKeys,
  firstSpecValue,
  getItemSpecValue,
  normalizeLengthSpec,
  syncHardwareSpecs
} from '../../lib/specs';
import {
  presetAppliesToCategory
} from '../../lib/labelLayout';
import type { HardwareCategory, HardwareItem, HardwareSpecKey, LabelPreset, StandardCatalogEntry } from '../../types';

export const getCatalogEntryForItem = (item: HardwareItem | undefined) =>
  item?.catalogId ? standardsCatalog.find((entry) => entry.id === item.catalogId) : undefined;

export const getCategoryPreset = (category: HardwareCategory, customPresets: LabelPreset[] = []) =>
  [...customPresets, ...Object.values(builtInLabelPresets)].find((preset) => preset.id === categoryDefaultPreset[category] && presetAppliesToCategory(preset, category)) ??
  [...customPresets, ...Object.values(builtInLabelPresets)].find((preset) => presetAppliesToCategory(preset, category));

export const buildCatalogItemPatch = (entry: StandardCatalogEntry, item: HardwareItem): Partial<HardwareItem> => {
  const specs = categorySpecKeys[entry.category].reduce<HardwareItem['specs']>((nextSpecs, key) => {
    const currentValue = getItemSpecValue(item, key);
    return {
      ...nextSpecs,
      [key]: firstSpecValue(entry, key, entry.unitSystem, currentValue)
    };
  }, {});
  const normalizedLength = normalizeLengthSpec(specs.length ?? item.length, defaultLengthUnit(entry.unitSystem));
  const material = specs.material ?? item.material;
  const materialType = isValidMaterialTreatment(material, specs.materialType ?? item.materialType)
    ? specs.materialType ?? item.materialType
    : defaultMaterialTreatment(material);
  const finish = isValidFinish(material, specs.finish ?? item.finish) ? specs.finish ?? item.finish : defaultFinish(material);
  const size = specs.size ?? item.size;
  const boltClassCandidate = specs.boltClass ?? item.boltClass;
  const boltClassItem = { ...item, material, materialType, size, unitSystem: entry.unitSystem, boltClass: boltClassCandidate };
  const boltClass = isValidBoltClass(boltClassItem, entry.unitSystem) ? boltClassCandidate : defaultBoltClass(boltClassItem, entry.unitSystem);
  const metricPitch = entry.unitSystem === 'metric' ? defaultMetricThreadPitch(size) : undefined;
  const imperialPitch = entry.unitSystem === 'imperial' ? defaultImperialThreadPitch(size) : undefined;
  const threadPitchName = metricPitch?.name ?? imperialPitch?.series ?? specs.threadPitchName ?? item.threadPitchName;
  const threadPitch = metricPitch?.value ?? imperialPitch?.tpi ?? specs.threadPitch ?? item.threadPitch;
  const threadPitchUnit = metricPitch ? 'mm' : imperialPitch ? 'TPI' : specs.threadPitchUnit ?? item.threadPitchUnit;

  return {
    catalogId: entry.id,
    category: entry.category,
    standard: combinedStandardCode(entry.standards),
    standardCodes: entry.standards,
    unitSystem: entry.unitSystem,
    specs: {
      ...item.specs,
      ...specs,
      length: normalizedLength.length,
      material,
      materialType,
      finish,
      boltClass,
      threadPitchName,
      threadPitch,
      threadPitchUnit
    },
    size,
    length: normalizedLength.length,
    lengthUnit: normalizedLength.lengthUnit,
    material,
    materialType,
    finish,
    boltClass,
    threadPitchName,
    threadPitch,
    threadPitchUnit
  };
};

export const syncCatalogItem = (entry: StandardCatalogEntry, item: HardwareItem) =>
  syncHardwareSpecs({ ...item, ...buildCatalogItemPatch(entry, item) });

export const getHardwareDescription = (item: HardwareItem) => {
  const catalogEntry = getCatalogEntryForItem(item);
  return catalogEntry?.description ?? item.category;
};

export const getHardwareSpecLine = (item: HardwareItem) => {
  const keys = categorySpecKeys[item.category];
  const main = [getItemSpecValue(item, 'size'), keys.includes('length') ? formatLength(item.length, item.lengthUnit) : '']
    .filter(Boolean)
    .join(' x ');
  const details = keys
    .filter((key) => !['size', 'length'].includes(key))
    .map((key) => getItemSpecValue(item, key))
    .filter(Boolean)
    .join(', ');
  return `${main || item.category}${details ? ` (${details})` : ''}`;
};

export const getHardwareDisplaySpecLine = (
  item: HardwareItem,
  displaySpecValue: (key: HardwareSpecKey, value: string) => string
) => {
  const keys = categorySpecKeys[item.category];
  const main = [getItemSpecValue(item, 'size'), keys.includes('length') ? formatLength(item.length, item.lengthUnit) : '']
    .filter(Boolean)
    .join(' x ');
  const details = keys
    .filter((key) => !['size', 'length'].includes(key))
    .map((key) => displaySpecValue(key, getItemSpecValue(item, key)))
    .filter(Boolean)
    .join(', ');
  return `${main || item.category}${details ? ` (${details})` : ''}`;
};
