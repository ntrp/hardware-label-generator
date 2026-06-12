import type { HardwareItem, UnitSystem } from '../types';
import { standardFamilies, standardPlaceholderKeys } from './standards';

const mmPerInch = 25.4;

const formatDecimal = (value: number, maximumFractionDigits: number) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: 0
  }).format(value);

export const parseList = (value: string) =>
  value
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

export const defaultLengthUnit = (unitSystem: UnitSystem) => (unitSystem === 'metric' ? 'mm' : 'in');

export const splitLengthAndUnit = (value: string, fallbackUnit: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { length: '', lengthUnit: fallbackUnit };
  }

  if (/^(standard|n\/a)$/i.test(trimmed)) {
    return { length: trimmed, lengthUnit: '' };
  }

  const inchMatch = trimmed.match(/^(.+?)\s*(?:"|in|inch|inches)$/i);
  if (inchMatch) {
    return { length: inchMatch[1].trim(), lengthUnit: 'in' };
  }

  const metricMatch = trimmed.match(/^(.+?)\s*(mm|millimeter|millimeters)$/i);
  if (metricMatch) {
    return { length: metricMatch[1].trim(), lengthUnit: 'mm' };
  }

  return { length: trimmed, lengthUnit: fallbackUnit };
};

export const defaultThreadPitchUnit = (unitSystem: UnitSystem) => (unitSystem === 'metric' ? 'mm' : 'TPI');

export const splitThreadPitchAndUnit = (value: string, fallbackUnit: string) => {
  const trimmed = value.trim();
  if (!trimmed || /^(n\/a)$/i.test(trimmed)) {
    return { threadPitch: '', threadPitchUnit: '' };
  }

  const match = trimmed.match(/^(.+?)\s+(mm approx|mm|TPI|threads\/inch)$/i);
  if (match) {
    return { threadPitch: match[1].trim(), threadPitchUnit: match[2].trim() };
  }

  return { threadPitch: trimmed, threadPitchUnit: fallbackUnit };
};

export const formatLength = (length: string, lengthUnit: string) => {
  if (!length.trim()) {
    return '';
  }

  return lengthUnit ? `${length} ${lengthUnit}` : length;
};

export const formatLabelSize = (widthMm: number, heightMm: number, unitSystem: UnitSystem) => {
  if (unitSystem === 'imperial') {
    return `${formatDecimal(widthMm / mmPerInch, 2)} × ${formatDecimal(heightMm / mmPerInch, 2)} in`;
  }

  return `${formatDecimal(widthMm, 1)} × ${formatDecimal(heightMm, 1)} mm`;
};

export const placeholderLabels = {
  standard: 'Standard',
  standardIso: 'ISO',
  standardDin: 'DIN',
  standardEn: 'EN',
  standardAsme: 'ASME',
  standardAstm: 'ASTM',
  standardSae: 'SAE',
  standardJis: 'JIS',
  size: 'Size',
  length: 'Length',
  lengthUnit: 'Length unit',
  material: 'Material',
  threadPitch: 'Pitch',
  threadPitchUnit: 'Pitch unit',
  thickness: 'Thickness',
  innerDiameter: 'ID',
  id: 'ID',
  outerDiameter: 'OD',
  od: 'OD',
  gripRange: 'Grip range',
  category: 'Category'
};

export type PlaceholderKey = keyof typeof placeholderLabels;

export const getPlaceholderValue = (item: HardwareItem, key: string, unitSystem: UnitSystem) => {
  switch (key) {
    case 'standard':
      return standardFamilies.map((family) => item.standardCodes[family]).find(Boolean) ?? item.standard;
    case standardPlaceholderKeys.ISO:
      return item.standardCodes.ISO ?? '';
    case standardPlaceholderKeys.DIN:
      return item.standardCodes.DIN ?? '';
    case standardPlaceholderKeys.EN:
      return item.standardCodes.EN ?? '';
    case standardPlaceholderKeys.ASME:
      return item.standardCodes.ASME ?? '';
    case standardPlaceholderKeys.ASTM:
      return item.standardCodes.ASTM ?? '';
    case standardPlaceholderKeys.SAE:
      return item.standardCodes.SAE ?? '';
    case standardPlaceholderKeys.JIS:
      return item.standardCodes.JIS ?? '';
    case 'size':
      return item.size;
    case 'length':
      return item.length;
    case 'lengthUnit':
      return item.lengthUnit;
    case 'material':
      return item.material;
    case 'threadPitch':
      return item.threadPitch;
    case 'threadPitchUnit':
      return item.threadPitchUnit;
    case 'thickness':
      return item.specs?.thickness ?? '';
    case 'innerDiameter':
    case 'id':
      return item.specs?.innerDiameter ?? '';
    case 'outerDiameter':
    case 'od':
      return item.specs?.outerDiameter ?? '';
    case 'gripRange':
      return item.specs?.gripRange ?? '';
    case 'category':
      return item.category;
    default:
      return '';
  }
};

export const renderTextTemplate = (template: string, item: HardwareItem, unitSystem: UnitSystem) =>
  template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_match, key: string) => getPlaceholderValue(item, key, unitSystem));

export const safeFilePart = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'label';
