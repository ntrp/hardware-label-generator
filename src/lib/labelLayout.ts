import { builtInLabelPresets, clonePlacedFields } from './defaults';
import type { AppState, HardwareCategory, LabelPreset, PlacedField } from '../types';

export const mmToPx = 3.7795275591;
export const mmPerInch = 25.4;
export const minLabelWidthMm = 10;
export const minLabelHeightMm = 6;
export const maxLabelWidthMm = 200;
export const maxLabelHeightMm = 120;
export const minElementWidthMm = 3;
export const minElementHeightMm = 3;
export const modifiedPresetValue = '__modified-preset';

const textElementLineHeight = 1.05;

export type LabelResizeMode = 'width' | 'height' | 'both';
export type ElementResizeMode = LabelResizeMode;
export type LabelDimensionKey = 'widthMm' | 'heightMm' | 'marginMm';

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const isBuiltInPresetId = (value: string) => value in builtInLabelPresets;
export const uniqueValues = (values: string[]) => Array.from(new Set(values)).filter(Boolean);

export const normalizedRotationDeg = (value: number) => {
  const normalized = value % 360;
  return Number((normalized < 0 ? normalized + 360 : normalized).toFixed(1));
};

export const formatMmInput = (value: number) => String(Number(value.toFixed(2))).replace('.', ',');
export const parseMmInput = (value: string) => Number(value.trim().replace(',', '.'));

export const formatLabelDimensionInput = (valueMm: number, unitSystem: AppState['unitSystem']) =>
  formatMmInput(unitSystem === 'imperial' ? valueMm / mmPerInch : valueMm);

export const parseLabelDimensionInput = (value: string, unitSystem: AppState['unitSystem']) => {
  const numericValue = parseMmInput(value);
  return unitSystem === 'imperial' ? numericValue * mmPerInch : numericValue;
};

export const labelDimensionUnit = (unitSystem: AppState['unitSystem']) => (unitSystem === 'imperial' ? 'in' : 'mm');
export const labelDimensionStepMm = (unitSystem: AppState['unitSystem']) => (unitSystem === 'imperial' ? mmPerInch / 10 : 1);

export const maxMarginForSettings = (settings: Pick<AppState['labelSettings'], 'widthMm' | 'heightMm'>) =>
  Math.max(0, Math.min((settings.widthMm - minElementWidthMm) / 2, (settings.heightMm - minElementHeightMm) / 2));

export const normalizedMarginMm = (settings: Pick<AppState['labelSettings'], 'widthMm' | 'heightMm' | 'marginMm'>) =>
  Number(clamp(settings.marginMm, 0, maxMarginForSettings(settings)).toFixed(2));

export const autoTextElementHeight = (field: Pick<PlacedField, 'style'>) =>
  Number(Math.max(minElementHeightMm, field.style.fontSize * textElementLineHeight).toFixed(2));

export const constrainFieldToSettings = (field: PlacedField, settings: AppState['labelSettings']): PlacedField => {
  if (field.kind === 'frame') {
    return {
      ...field,
      x: 0,
      y: 0,
      width: settings.widthMm,
      height: settings.heightMm
    };
  }

  const marginMm = normalizedMarginMm(settings);
  const maxWidth = Math.max(minElementWidthMm, settings.widthMm - marginMm * 2);
  const maxHeight = Math.max(minElementHeightMm, settings.heightMm - marginMm * 2);
  const width = Number(clamp(field.width, minElementWidthMm, maxWidth).toFixed(2));
  const height = Number(clamp(field.height, minElementHeightMm, maxHeight).toFixed(2));
  const maxX = Math.max(marginMm, settings.widthMm - marginMm - width);
  const maxY = Math.max(marginMm, settings.heightMm - marginMm - height);

  return {
    ...field,
    x: Number(clamp(field.x, marginMm, maxX).toFixed(2)),
    y: Number(clamp(field.y, marginMm, maxY).toFixed(2)),
    width,
    height
  };
};

export const constrainLabelSettings = (settings: AppState['labelSettings']): AppState['labelSettings'] => {
  const marginMm = normalizedMarginMm(settings);
  const nextSettings = { ...settings, marginMm };

  return {
    ...nextSettings,
    fields: nextSettings.fields.map((field) => constrainFieldToSettings(field, nextSettings))
  };
};

export const presetAppliesToCategory = (preset: LabelPreset, category: HardwareCategory) => (preset.categories ?? ['custom']).includes(category);

export const presetToLabelSettings = (preset: LabelPreset, isBuiltIn: boolean): AppState['labelSettings'] => ({
  widthMm: preset.widthMm,
  heightMm: preset.heightMm,
  tapeWidthMm: preset.tapeWidthMm,
  marginMm: preset.marginMm,
  layout: isBuiltIn && ['compact', 'two-column', 'large-size', 'qr-sidecar'].includes(preset.id) ? (preset.id as AppState['labelSettings']['layout']) : 'custom',
  fields: clonePlacedFields(preset.fields)
});

export const presetMatchesSettings = (preset: LabelPreset, settings: AppState['labelSettings']) => {
  const presetSettings = constrainLabelSettings(presetToLabelSettings(preset, isBuiltInPresetId(preset.id)));

  return (
    presetSettings.widthMm === settings.widthMm &&
    presetSettings.heightMm === settings.heightMm &&
    presetSettings.tapeWidthMm === settings.tapeWidthMm &&
    presetSettings.marginMm === settings.marginMm &&
    JSON.stringify(presetSettings.fields) === JSON.stringify(settings.fields)
  );
};
