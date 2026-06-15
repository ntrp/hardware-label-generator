import type { AppState, FieldStyle, FrameStyle, HardwareItem, LabelPreset, LabelSettings, PlacedField } from '../types';

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
  unitSystem: 'metric'
};

export const templateFields: Record<string, PlacedField[]> = {
  compact: [
    { id: 'field-standard', kind: 'text', text: '{standardDin} {standardIso}', x: 3, y: 4, width: 44, height: 6, style: { ...defaultFieldStyle, fontSize: 5, fontWeight: 600 } },
    { id: 'field-size', kind: 'text', text: '{size}', x: 3, y: 12, width: 25, height: 10, style: { ...defaultFieldStyle, fontSize: 10, fontWeight: 800 } },
    { id: 'field-length', kind: 'text', text: '{length} {lengthUnit}', x: 29, y: 13, width: 18, height: 8, style: { ...defaultFieldStyle, fontSize: 8, align: 'end' } },
    { id: 'field-material', kind: 'text', text: '{material}', x: 3, y: 23, width: 44, height: 6, style: { ...defaultFieldStyle, fontSize: 5, fontWeight: 600 } }
  ],
  'two-column': [
    { id: 'field-standard', kind: 'text', text: '{standardDin} {standardIso}', x: 3, y: 4, width: 44, height: 6, style: { ...defaultFieldStyle, fontSize: 5, fontWeight: 700 } },
    { id: 'field-size', kind: 'text', text: '{size}', x: 3, y: 12, width: 20, height: 8, style: { ...defaultFieldStyle, fontSize: 9, fontWeight: 800 } },
    { id: 'field-length', kind: 'text', text: '{length} {lengthUnit}', x: 28, y: 12, width: 19, height: 8, style: { ...defaultFieldStyle, fontSize: 8, align: 'end' } },
    { id: 'field-pitch', kind: 'text', text: '{threadPitchName}', x: 3, y: 22, width: 20, height: 5, style: { ...defaultFieldStyle, fontSize: 4.5, fontWeight: 600 } },
    { id: 'field-material', kind: 'text', text: '{material}', x: 27, y: 22, width: 20, height: 5, style: { ...defaultFieldStyle, fontSize: 4.5, align: 'end' } }
  ],
  'large-size': [
    { id: 'field-size', kind: 'text', text: '{size}', x: 3, y: 6, width: 44, height: 13, style: { ...defaultFieldStyle, fontSize: 14, fontWeight: 800, align: 'middle' } },
    { id: 'field-standard', kind: 'text', text: '{standardIso} {standardDin} {standardJis}', x: 3, y: 21, width: 44, height: 5, style: { ...defaultFieldStyle, fontSize: 4.8, fontWeight: 600, align: 'middle' } },
    { id: 'field-length', kind: 'text', text: '{length} {lengthUnit}', x: 3, y: 27, width: 44, height: 5, style: { ...defaultFieldStyle, fontSize: 5.5, align: 'middle' } }
  ],
  'qr-sidecar': [
    { id: 'field-standard', kind: 'text', text: '{standardDin} {standardIso}', x: 3, y: 4, width: 29, height: 5, style: { ...defaultFieldStyle, fontSize: 4.5, fontWeight: 600 } },
    { id: 'field-size', kind: 'text', text: '{size}', x: 3, y: 11, width: 28, height: 10, style: { ...defaultFieldStyle, fontSize: 10, fontWeight: 800 } },
    { id: 'field-length', kind: 'text', text: '{length} {lengthUnit}', x: 3, y: 22, width: 28, height: 6, style: { ...defaultFieldStyle, fontSize: 5.5, fontWeight: 700 } },
    { id: 'field-qr', kind: 'image', imageSource: 'qr', x: 35, y: 5, width: 17, height: 17, style: { ...defaultFieldStyle } },
    { id: 'field-material', kind: 'text', text: '{materialType}', x: 35, y: 25, width: 17, height: 4, style: { ...defaultFieldStyle, fontSize: 4, align: 'middle' } }
  ],
  washer: [
    { id: 'field-standard', kind: 'text', text: '{standardDin} {standardIso}', x: 3, y: 4, width: 48, height: 5, style: { ...defaultFieldStyle, fontSize: 4.5, fontWeight: 600 } },
    { id: 'field-size', kind: 'text', text: '{size}', x: 3, y: 11, width: 20, height: 10, style: { ...defaultFieldStyle, fontSize: 10, fontWeight: 800 } },
    { id: 'field-diameter', kind: 'text', text: 'ID {innerDiameter}  OD {outerDiameter}', x: 24, y: 12, width: 27, height: 6, style: { ...defaultFieldStyle, fontSize: 4.4, align: 'end' } },
    { id: 'field-thickness', kind: 'text', text: '{thickness} {material}', x: 3, y: 23, width: 48, height: 5, style: { ...defaultFieldStyle, fontSize: 5, fontWeight: 700, align: 'middle' } }
  ],
  rivet: [
    { id: 'field-standard', kind: 'text', text: '{standardDin} {standardIso}', x: 3, y: 4, width: 44, height: 6, style: { ...defaultFieldStyle, fontSize: 5, fontWeight: 700 } },
    { id: 'field-size', kind: 'text', text: '{size} x {length} {lengthUnit}', x: 3, y: 12, width: 44, height: 9, style: { ...defaultFieldStyle, fontSize: 8.5, fontWeight: 800, align: 'middle' } },
    { id: 'field-grip', kind: 'text', text: 'Grip {gripRange}', x: 3, y: 22, width: 24, height: 5, style: { ...defaultFieldStyle, fontSize: 4.7, fontWeight: 600 } },
    { id: 'field-material', kind: 'text', text: '{material}', x: 28, y: 22, width: 19, height: 5, style: { ...defaultFieldStyle, fontSize: 4.7, align: 'end' } }
  ],
  custom: []
};

export const builtInLabelPresets: Record<string, LabelPreset> = {
  'gridfinity-text': {
    id: 'gridfinity-text',
    name: 'Gridfinity 36x12',
    categories: [
      'screw'
    ],
    widthMm: 36,
    heightMm: 12,
    tapeWidthMm: 12,
    marginMm: 2,
    fields: [
      {
        id: 'field-standard',
        kind: 'text',
        text: '{standardIso}',
        x: 2,
        y: 2,
        width: 30,
        height: 4.73,
        style: {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: 4.5,
          fontWeight: 600,
          align: 'start',
          visible: true
        }
      },
      {
        id: 'field-size',
        kind: 'text',
        text: '{size} x {length} {lengthUnit}',
        x: 2,
        y: 7,
        width: 25,
        height: 3,
        style: {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: 3,
          fontWeight: 800,
          align: 'start',
          visible: true
        }
      },
      {
        id: 'field-mqb4do1x-y5bt8d',
        kind: 'text',
        text: '{material}',
        x: 31,
        y: 2,
        width: 3,
        height: 3,
        style: {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: 2,
          fontWeight: 700,
          align: 'start',
          visible: true
        }
      }
    ]
  },
  compact: {
    id: 'compact',
    name: 'Compact text stack',
    categories: ['nut', 'anchor', 'clip', 'custom'],
    widthMm: 50,
    heightMm: 25,
    tapeWidthMm: 24,
    marginMm: 2,
    fields: templateFields.compact
  },
  'two-column': {
    id: 'two-column',
    name: 'Two-column specs',
    categories: ['screw', 'bolt', 'insert'],
    widthMm: 54,
    heightMm: 30,
    tapeWidthMm: 24,
    marginMm: 2,
    fields: templateFields['two-column']
  },
  'large-size': {
    id: 'large-size',
    name: 'Large size label',
    categories: ['pin', 'clip', 'custom'],
    widthMm: 54,
    heightMm: 30,
    tapeWidthMm: 24,
    marginMm: 2,
    fields: templateFields['large-size']
  },
  'qr-sidecar': {
    id: 'qr-sidecar',
    name: 'QR sidecar',
    categories: ['screw', 'bolt', 'insert'],
    widthMm: 54,
    heightMm: 30,
    tapeWidthMm: 24,
    marginMm: 2,
    fields: templateFields['qr-sidecar']
  },
  washer: {
    id: 'washer',
    name: 'Washer dimensions',
    categories: ['washer'],
    widthMm: 54,
    heightMm: 30,
    tapeWidthMm: 24,
    marginMm: 2,
    fields: templateFields.washer
  },
  rivet: {
    id: 'rivet',
    name: 'Rivet grip',
    categories: ['rivet'],
    widthMm: 50,
    heightMm: 25,
    tapeWidthMm: 24,
    marginMm: 2,
    fields: templateFields.rivet
  }
};

const defaultPreset = builtInLabelPresets['qr-sidecar'];

export const defaultLabelSettings: LabelSettings = {
  widthMm: defaultPreset.widthMm,
  heightMm: defaultPreset.heightMm,
  tapeWidthMm: defaultPreset.tapeWidthMm,
  marginMm: defaultPreset.marginMm,
  layout: 'qr-sidecar',
  fields: clonePlacedFields(defaultPreset.fields)
};

export const defaultAppState: AppState = {
  hardwareItems: [defaultHardwareItem],
  purchaseLinks: {},
  labelSettings: defaultLabelSettings,
  customPresets: [],
  unitSystem: 'metric',
  selectedStandards: [],
  selectedCategories: []
};
