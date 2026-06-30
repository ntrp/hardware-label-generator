import { builtInLabelPresets, defaultPresetId } from './presets';
import type { AppState, FieldStyle, FrameStyle, HardwareItem, LabelSettings, PlacedField } from '../types';

export const defaultFieldStyle: FieldStyle = {
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: 4,
  fontWeight: 700,
  align: 'start',
  visible: true
};

export const defaultFrameStyle: FrameStyle = {
  shape: 'rounded',
  strokeWidth: 0.5,
  radius: 3,
  lineStyle: 'solid'
};

export const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const clonePlacedFields = (fields: PlacedField[]) =>
  fields.map((field) => ({
    ...field,
    style: { ...field.style },
    frameStyle: field.frameStyle ? { ...field.frameStyle } : undefined
  }));

const defaultPreset = builtInLabelPresets[defaultPresetId];

export const defaultLabelSettings: LabelSettings = {
  widthMm: defaultPreset.widthMm,
  heightMm: defaultPreset.heightMm,
  tapeWidthMm: defaultPreset.tapeWidthMm,
  marginMm: defaultPreset.marginMm,
  layout: defaultPresetId,
  fields: clonePlacedFields(defaultPreset.fields)
};

export const cloneLabelSettings = (settings: LabelSettings): LabelSettings => ({
  ...settings,
  fields: clonePlacedFields(settings.fields)
});

export const defaultHardwareItem: HardwareItem = {
  id: 'item-socket-cap-m3',
  catalogId: 'din-912',
  category: 'screw',
  standard: 'DIN 912 / ISO 4762',
  standardCodes: { DIN: 'DIN 912', ISO: 'ISO 4762', EN: 'EN ISO 4762' },
  size: 'M3',
  length: '12',
  lengthUnit: 'mm',
  material: 'stainless steel',
  materialType: 'A2',
  finish: 'plain',
  boltClass: 'A2-70',
  threadPitch: '0.5',
  threadPitchName: 'coarse',
  threadPitchUnit: 'mm',
  specs: {
    size: 'M3',
    length: '12',
    material: 'stainless steel',
    materialType: 'A2',
    finish: 'plain',
    boltClass: 'A2-70',
    threadPitch: '0.5',
    threadPitchName: 'coarse',
    threadPitchUnit: 'mm'
  },
  batch: {
    enabled: false,
    specs: {},
    activeKeys: []
  },
  unitSystem: 'metric',
  labelSettings: cloneLabelSettings(defaultLabelSettings)
};

export const defaultAppState: AppState = {
  hardwareItems: [defaultHardwareItem],
  purchaseLinks: {},
  labelSettings: defaultLabelSettings,
  customPresets: [],
  unitSystem: 'metric',
  locale: 'en',
  selectedStandards: [],
  selectedCategories: []
};
