export type UnitSystem = 'metric' | 'imperial';

export type HardwareCategory =
  | 'screw'
  | 'bolt'
  | 'nut'
  | 'washer'
  | 'rivet'
  | 'pin'
  | 'anchor'
  | 'insert'
  | 'clip'
  | 'custom';

export type LabelElementKind = 'text' | 'image' | 'frame';
export type ImageSource = 'qr' | 'iso' | 'side' | 'top' | 'custom';
export type FrameShape = 'box' | 'rounded';
export type FrameLineStyle = 'solid' | 'dashed' | 'dotted';

export type LayoutTemplate = 'compact' | 'two-column' | 'large-size' | 'qr-sidecar' | 'custom';
export type HardwareSpecKey =
  | 'size'
  | 'length'
  | 'threadPitch'
  | 'threadPitchName'
  | 'threadPitchUnit'
  | 'material'
  | 'materialType'
  | 'finish'
  | 'boltClass'
  | 'thickness'
  | 'innerDiameter'
  | 'outerDiameter'
  | 'gripRange';
export type StandardFamily = 'ISO' | 'DIN' | 'EN' | 'ASME' | 'ASTM' | 'SAE' | 'JIS';
export type StandardCodeMap = Partial<Record<StandardFamily, string>>;

export type PurchaseLinkState = Record<string, string>;

export interface HardwareItem {
  id: string;
  catalogId?: string;
  category: HardwareCategory;
  standard: string;
  standardCodes: StandardCodeMap;
  size: string;
  length: string;
  lengthUnit: string;
  material: string;
  materialType: string;
  finish: string;
  boltClass: string;
  threadPitch: string;
  threadPitchName: string;
  threadPitchUnit: string;
  specs: Partial<Record<HardwareSpecKey, string>>;
  unitSystem: UnitSystem;
}

export interface FieldStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700 | 800;
  align: 'start' | 'middle' | 'end';
  visible: boolean;
}

export interface FrameStyle {
  shape: FrameShape;
  strokeWidth: number;
  radius: number;
  lineStyle: FrameLineStyle;
}

export interface PlacedField {
  id: string;
  kind: LabelElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  style: FieldStyle;
  text?: string;
  imageSource?: ImageSource;
  imageBase64?: string;
  imageMimeType?: string;
  imageName?: string;
  svgStrokeWidth?: number;
  rotationDeg?: number;
  frameStyle?: FrameStyle;
}

export interface LabelSettings {
  widthMm: number;
  heightMm: number;
  tapeWidthMm: number;
  marginMm: number;
  layout: LayoutTemplate;
  fields: PlacedField[];
}

export interface LabelPreset {
  id: string;
  name: string;
  categories: HardwareCategory[];
  widthMm: number;
  heightMm: number;
  tapeWidthMm: number;
  marginMm: number;
  fields: PlacedField[];
}

export interface StandardCatalogEntry {
  id: string;
  category: HardwareCategory;
  unitSystem: UnitSystem;
  family: string;
  code: string;
  standards: StandardCodeMap;
  description: string;
  sizes: Record<UnitSystem, string[]>;
  lengths: Record<UnitSystem, string[]>;
  materials: string[];
  pitches: Record<UnitSystem, string[]>;
  specs?: Partial<Record<HardwareSpecKey, Record<UnitSystem, string[]> | string[]>>;
  sourceId: string;
}

export interface AppState {
  hardwareItems: HardwareItem[];
  purchaseLinks: PurchaseLinkState;
  labelSettings: LabelSettings;
  customPresets: LabelPreset[];
  unitSystem: UnitSystem;
  selectedStandards: StandardFamily[];
  selectedCategories: HardwareCategory[];
  batchCatalogId: string;
  batchSpecs: Partial<Record<HardwareSpecKey, string>>;
}

export interface AppBackup {
  app: 'makers-label-generator';
  version: 12;
  exportedAt: string;
  state: AppState;
}
