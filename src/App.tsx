import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  Archive,
  Code2,
  Copy,
  Download,
  FileArchive,
  FileImage,
  FileText,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { standardsCatalog } from './data/catalog';
import { generateBatchItems } from './lib/batch';
import { builtInLabelPresets, clonePlacedFields, createId, defaultAppState, defaultFieldStyle, defaultFrameStyle } from './lib/defaults';
import { downloadBlob, effectivePurchaseLink, exportSingle, exportZip, type ExportFormat } from './lib/export';
import {
  defaultLengthUnit,
  formatLabelSize,
  formatLength,
  placeholderLabels,
  parseList,
  splitLengthAndUnit
} from './lib/format';
import { buildQrPayload } from './lib/qr';
import {
  categoryDefaultPreset,
  categorySpecKeys,
  firstSpecValue,
  getAllCatalogSpecOptions,
  getCatalogSpecOptions,
  getCatalogWasherDimensionValue,
  getCategorySpecDefinitions,
  getItemSpecValue,
  isWasherDimensionKey,
  normalizeLengthSpec,
  patchItemSpec,
  syncHardwareSpecs
} from './lib/specs';
import { baseMaterials, defaultMaterialTreatment, getMaterialTreatmentOptions, isValidMaterialTreatment } from './lib/materials';
import { defaultBoltClass, getBoltClassOptions, isValidBoltClass } from './lib/boltClasses';
import { defaultMetricThreadPitch, findMetricThreadPitch, formatMetricThreadPitchOption, metricThreadPitchNamesForSize } from './lib/metricThreads';
import { catalogMatchesSelectedStandards, combinedStandardCode, standardFamilies, standardPlaceholderKeys } from './lib/standards';
import { loadState, parseBackup, saveState, serializeBackup, storageMeta } from './lib/storage';
import { renderLabelSvg } from './lib/svg';
import { catalogAssetLabel, catalogAssetSources, catalogAssetUrlForEntry, standardImageLabel, standardImageReferenceForItem, standardImageSources, standardImageUrlForItem } from './lib/standardImages';
import type {
  AppState,
  FrameLineStyle,
  FrameShape,
  HardwareCategory,
  LabelPreset,
  HardwareItem,
  HardwareSpecKey,
  LabelElementKind,
  PlacedField,
  StandardCatalogEntry
} from './types';

const categories: HardwareCategory[] = ['screw', 'bolt', 'nut', 'washer', 'rivet', 'pin', 'anchor', 'insert', 'clip', 'custom'];
const elementKinds: LabelElementKind[] = ['text', 'image', 'frame'];
const fontFamilies = [
  'Inter, Arial, sans-serif',
  'Arial, sans-serif',
  'Helvetica, Arial, sans-serif',
  'Aptos, Arial, sans-serif',
  'Calibri, Arial, sans-serif',
  'Segoe UI, Arial, sans-serif',
  'San Francisco, Helvetica, Arial, sans-serif',
  'Roboto, Arial, sans-serif',
  'Verdana, Geneva, sans-serif',
  'Tahoma, Geneva, sans-serif',
  'Trebuchet MS, Arial, sans-serif',
  'Gill Sans, Arial, sans-serif',
  'DIN Alternate, Arial Narrow, Arial, sans-serif',
  'Arial Narrow, Arial, sans-serif',
  'Impact, Haettenschweiler, sans-serif',
  'Times New Roman, Times, serif',
  'Georgia, serif',
  'Garamond, Georgia, serif',
  'Courier New, Courier, monospace',
  'Roboto Mono, monospace',
  'Menlo, Consolas, monospace',
  'Consolas, Courier New, monospace',
  'Monaco, Menlo, monospace',
  'Helsinki, Arial, sans-serif',
  'Brussels, Arial, sans-serif',
  'Letter Gothic, Courier New, monospace',
  'Brougham, Courier New, monospace'
];
const mmToPx = 3.7795275591;
const mmPerInch = 25.4;
const minLabelWidthMm = 10;
const minLabelHeightMm = 6;
const maxLabelWidthMm = 200;
const maxLabelHeightMm = 120;
const minElementWidthMm = 3;
const minElementHeightMm = 3;
const textElementLineHeight = 1.05;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isBuiltInPresetId = (value: string) => value in builtInLabelPresets;
const modifiedPresetValue = '__modified-preset';
type LabelResizeMode = 'width' | 'height' | 'both';
type ElementResizeMode = LabelResizeMode;
type LabelDimensionKey = 'widthMm' | 'heightMm' | 'marginMm';
type LocalFontAccessWindow = Window & {
  queryLocalFonts?: () => Promise<Array<{ family: string }>>;
};

const uniqueValues = (values: string[]) => Array.from(new Set(values)).filter(Boolean);
const formatTsString = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const tsIdentifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const formatTsKey = (key: string) => (tsIdentifierPattern.test(key) ? key : formatTsString(key));
const formatTsValue = (value: unknown, indent = 0): string => {
  const space = ' '.repeat(indent);
  const nextSpace = ' '.repeat(indent + 2);

  if (typeof value === 'string') return formatTsString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[\n${value.map((entry) => `${nextSpace}${formatTsValue(entry, indent + 2)}`).join(',\n')}\n${space}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== undefined);
    if (entries.length === 0) return '{}';
    return `{\n${entries.map(([key, entry]) => `${nextSpace}${formatTsKey(key)}: ${formatTsValue(entry, indent + 2)}`).join(',\n')}\n${space}}`;
  }

  return 'undefined';
};
const slugifyPresetId = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'custom-preset';
const formatMmInput = (value: number) => String(Number(value.toFixed(2))).replace('.', ',');
const parseMmInput = (value: string) => Number(value.trim().replace(',', '.'));
const formatLabelDimensionInput = (valueMm: number, unitSystem: AppState['unitSystem']) =>
  formatMmInput(unitSystem === 'imperial' ? valueMm / mmPerInch : valueMm);
const parseLabelDimensionInput = (value: string, unitSystem: AppState['unitSystem']) => {
  const numericValue = parseMmInput(value);
  return unitSystem === 'imperial' ? numericValue * mmPerInch : numericValue;
};
const labelDimensionUnit = (unitSystem: AppState['unitSystem']) => (unitSystem === 'imperial' ? 'in' : 'mm');
const labelDimensionStepMm = (unitSystem: AppState['unitSystem']) => (unitSystem === 'imperial' ? mmPerInch / 10 : 1);

const maxMarginForSettings = (settings: Pick<AppState['labelSettings'], 'widthMm' | 'heightMm'>) =>
  Math.max(0, Math.min((settings.widthMm - minElementWidthMm) / 2, (settings.heightMm - minElementHeightMm) / 2));

const normalizedMarginMm = (settings: Pick<AppState['labelSettings'], 'widthMm' | 'heightMm' | 'marginMm'>) =>
  Number(clamp(settings.marginMm, 0, maxMarginForSettings(settings)).toFixed(2));

const autoTextElementHeight = (field: Pick<PlacedField, 'style'>) =>
  Number(Math.max(minElementHeightMm, field.style.fontSize * textElementLineHeight).toFixed(2));

const constrainFieldToSettings = (field: PlacedField, settings: AppState['labelSettings']): PlacedField => {
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

const constrainLabelSettings = (settings: AppState['labelSettings']): AppState['labelSettings'] => {
  const marginMm = normalizedMarginMm(settings);
  const nextSettings = { ...settings, marginMm };

  return {
    ...nextSettings,
    fields: nextSettings.fields.map((field) => constrainFieldToSettings(field, nextSettings))
  };
};

const presetAppliesToCategory = (preset: LabelPreset, category: HardwareCategory) => (preset.categories ?? ['custom']).includes(category);

const getCatalogEntryForItem = (item: HardwareItem | undefined) =>
  item?.catalogId ? standardsCatalog.find((entry) => entry.id === item.catalogId) : undefined;

const getCategoryPreset = (category: HardwareCategory, customPresets: LabelPreset[] = []) =>
  [...customPresets, ...Object.values(builtInLabelPresets)].find((preset) => preset.id === categoryDefaultPreset[category] && presetAppliesToCategory(preset, category)) ??
  [...customPresets, ...Object.values(builtInLabelPresets)].find((preset) => presetAppliesToCategory(preset, category));

const presetToLabelSettings = (preset: LabelPreset, isBuiltIn: boolean): AppState['labelSettings'] => ({
  widthMm: preset.widthMm,
  heightMm: preset.heightMm,
  tapeWidthMm: preset.tapeWidthMm,
  marginMm: preset.marginMm,
  layout: isBuiltIn && ['compact', 'two-column', 'large-size', 'qr-sidecar'].includes(preset.id) ? (preset.id as AppState['labelSettings']['layout']) : 'custom',
  fields: clonePlacedFields(preset.fields)
});

const getHardwareDescription = (item: HardwareItem) => {
  const catalogEntry = item.catalogId ? standardsCatalog.find((entry) => entry.id === item.catalogId) : undefined;
  return catalogEntry?.description ?? item.category;
};

const getHardwareSpecLine = (item: HardwareItem) => {
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

const getElementSummary = (field: PlacedField) => {
  if (field.kind === 'text') {
    return field.text?.trim() || 'Text';
  }

  if (field.kind === 'image') {
    return field.imageSource === 'custom' ? field.imageName || 'Custom image' : standardImageLabel(field.imageSource);
  }

  const frameShape = field.frameStyle?.shape === 'rounded' ? 'Rounded' : 'Box';
  return `${frameShape} frame`;
};

const presetMatchesSettings = (preset: LabelPreset, settings: AppState['labelSettings']) => {
  const presetSettings = constrainLabelSettings(presetToLabelSettings(preset, isBuiltInPresetId(preset.id)));

  return (
    presetSettings.widthMm === settings.widthMm &&
    presetSettings.heightMm === settings.heightMm &&
    presetSettings.tapeWidthMm === settings.tapeWidthMm &&
    presetSettings.marginMm === settings.marginMm &&
    JSON.stringify(presetSettings.fields) === JSON.stringify(settings.fields)
  );
};

const catalogSearchText = (entry: StandardCatalogEntry, selectedStandards: AppState['selectedStandards']) =>
  [
    entry.id,
    entry.family,
    entry.code,
    combinedStandardCode(entry.standards, selectedStandards),
    ...Object.values(entry.standards),
    entry.category,
    entry.description
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const fuzzyScore = (text: string, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 1;
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  let score = 0;

  for (const term of terms) {
    const index = text.indexOf(term);
    if (index >= 0) {
      score += 100 - Math.min(index, 60);
      continue;
    }

    let cursor = 0;
    let matched = 0;
    for (const character of term) {
      const nextIndex = text.indexOf(character, cursor);
      if (nextIndex === -1) break;
      matched += 1;
      cursor = nextIndex + 1;
    }

    if (matched !== term.length) return 0;
    score += matched * 3;
  }

  return score;
};

const drawingKindForEntry = (entry: StandardCatalogEntry) => {
  const text = `${entry.code} ${entry.description}`.toLowerCase();
  if (entry.category === 'washer') return text.includes('spring') || text.includes('lock') || text.includes('conical') ? 'lock-washer' : 'washer';
  if (entry.category === 'nut') return text.includes('cap') ? 'cap-nut' : text.includes('flange') ? 'flange-nut' : 'nut';
  if (entry.category === 'pin') return text.includes('cotter') || text.includes('split') ? 'cotter-pin' : text.includes('spring') || text.includes('coiled') || text.includes('slotted') ? 'spring-pin' : 'pin';
  if (entry.category === 'rivet') return 'rivet';
  if (entry.category === 'clip') return 'clip';
  if (entry.category === 'anchor') return 'anchor';
  if (entry.category === 'insert') return 'insert';
  if (text.includes('countersunk')) return 'countersunk-screw';
  if (text.includes('button')) return 'button-screw';
  if (text.includes('set screw')) return 'set-screw';
  if (text.includes('hex head') || text.includes('hex cap') || entry.category === 'bolt') return 'hex-bolt';
  return 'socket-screw';
};

const CatalogDrawing = ({ entry }: { entry: StandardCatalogEntry }) => {
  const sideUrl = catalogAssetUrlForEntry(entry, 'side');
  if (sideUrl) {
    return <img className="catalog-drawing" src={sideUrl} alt={`${entry.description} side drawing`} loading="lazy" />;
  }

  const kind = drawingKindForEntry(entry);

  return (
    <svg className="catalog-drawing" viewBox="0 0 80 44" role="img" aria-label={`${entry.description} drawing`}>
      <rect x="0" y="0" width="80" height="44" rx="4" fill="#f8fafb" />
      {kind === 'washer' && (
        <>
          <circle cx="40" cy="22" r="16" fill="none" stroke="#1f2933" strokeWidth="3" />
          <circle cx="40" cy="22" r="7" fill="none" stroke="#1f2933" strokeWidth="3" />
        </>
      )}
      {kind === 'lock-washer' && (
        <>
          <path d="M24 22a16 16 0 1 1 29 9" fill="none" stroke="#1f2933" strokeWidth="3" />
          <path d="M49 12l8-5M24 32l8-5" stroke="#1f2933" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {(kind === 'nut' || kind === 'flange-nut' || kind === 'cap-nut') && (
        <>
          {kind === 'flange-nut' && <rect x="18" y="28" width="44" height="5" fill="#1f2933" />}
          <polygon points="25,12 55,12 66,22 55,32 25,32 14,22" fill="none" stroke="#1f2933" strokeWidth="3" />
          <circle cx="40" cy="22" r="7" fill="none" stroke="#1f2933" strokeWidth="3" />
          {kind === 'cap-nut' && <path d="M27 14q13-13 26 0" fill="none" stroke="#1f2933" strokeWidth="3" />}
        </>
      )}
      {(kind === 'pin' || kind === 'spring-pin' || kind === 'cotter-pin') && (
        <>
          <rect x="15" y="17" width="50" height="10" rx="5" fill="none" stroke="#1f2933" strokeWidth="3" />
          {kind === 'spring-pin' && <path d="M24 17v10M35 17v10M46 17v10M57 17v10" stroke="#1f2933" strokeWidth="2" />}
          {kind === 'cotter-pin' && <path d="M58 17q12 5 0 10M22 17v10" fill="none" stroke="#1f2933" strokeWidth="3" />}
        </>
      )}
      {kind === 'rivet' && (
        <>
          <path d="M18 22h36" stroke="#1f2933" strokeWidth="8" strokeLinecap="round" />
          <circle cx="18" cy="22" r="10" fill="none" stroke="#1f2933" strokeWidth="3" />
          <path d="M54 16l12 6-12 6" fill="none" stroke="#1f2933" strokeWidth="3" strokeLinejoin="round" />
        </>
      )}
      {kind === 'clip' && <path d="M24 14h30q8 0 8 8t-8 8H28q-9 0-9-8t9-8" fill="none" stroke="#1f2933" strokeWidth="4" strokeLinecap="round" />}
      {kind === 'anchor' && (
        <>
          <path d="M16 22h48" stroke="#1f2933" strokeWidth="8" strokeLinecap="round" />
          <path d="M31 12l8 20 8-20" fill="none" stroke="#1f2933" strokeWidth="3" />
        </>
      )}
      {kind === 'insert' && (
        <>
          <rect x="24" y="10" width="32" height="24" rx="4" fill="none" stroke="#1f2933" strokeWidth="3" />
          <path d="M30 15h20M30 22h20M30 29h20" stroke="#1f2933" strokeWidth="2" />
        </>
      )}
      {['hex-bolt', 'socket-screw', 'countersunk-screw', 'button-screw', 'set-screw'].includes(kind) && (
        <>
          {kind === 'hex-bolt' && <polygon points="10,14 24,14 30,22 24,30 10,30 4,22" fill="none" stroke="#1f2933" strokeWidth="3" />}
          {kind === 'socket-screw' && <rect x="6" y="12" width="20" height="20" rx="4" fill="none" stroke="#1f2933" strokeWidth="3" />}
          {kind === 'countersunk-screw' && <path d="M6 12h24l-8 20h-8z" fill="none" stroke="#1f2933" strokeWidth="3" />}
          {kind === 'button-screw' && <path d="M6 24q10-18 24 0v6H6z" fill="none" stroke="#1f2933" strokeWidth="3" />}
          {kind === 'set-screw' && <rect x="9" y="16" width="48" height="12" rx="2" fill="none" stroke="#1f2933" strokeWidth="3" />}
          {kind !== 'set-screw' && <rect x="28" y="18" width="42" height="8" fill="none" stroke="#1f2933" strokeWidth="3" />}
          <path d="M37 18v8M46 18v8M55 18v8M64 18v8" stroke="#1f2933" strokeWidth="2" />
        </>
      )}
    </svg>
  );
};

const catalogAssetPreviewUrl = (reference: NonNullable<ReturnType<typeof standardImageReferenceForItem>>, source: (typeof catalogAssetSources)[number]) => {
  if (source === 'iso') return reference.isoUrl;
  if (source === 'side') return reference.sideUrl;
  return reference.topUrl;
};

interface CatalogPartPickerProps {
  entries: StandardCatalogEntry[];
  selectedId: string;
  selectedStandards: AppState['selectedStandards'];
  onSelect: (id: string) => void;
  includeCustom?: boolean;
}

const CatalogPartPicker = ({ entries, selectedId, selectedStandards, onSelect, includeCustom = false }: CatalogPartPickerProps) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selectedEntry = entries.find((entry) => entry.id === selectedId);
  const matches = entries
    .map((entry) => ({ entry, score: fuzzyScore(catalogSearchText(entry, selectedStandards), query) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.entry.code.localeCompare(right.entry.code))
    .slice(0, 80);

  const selectedLabel = selectedEntry ? `${combinedStandardCode(selectedEntry.standards, selectedStandards)} · ${selectedEntry.description}` : 'Custom item';

  return (
    <div className="catalog-picker" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setOpen(false);
      }
    }}>
      <button type="button" className="catalog-picker-button" onClick={() => setOpen((current) => !current)}>
        {selectedEntry ? <CatalogDrawing entry={selectedEntry} /> : <span className="catalog-custom-drawing">Custom</span>}
        <span>
          <strong>{selectedLabel}</strong>
          <small>{selectedEntry ? selectedEntry.code : 'Free text hardware item'}</small>
        </span>
      </button>
      {open && (
        <div className="catalog-picker-popover">
          <input
            autoFocus
            value={query}
            placeholder="Search standard or description..."
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="catalog-picker-list">
            {includeCustom && (
              <button
                type="button"
                className={!selectedId ? 'catalog-picker-row active' : 'catalog-picker-row'}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect('');
                  setOpen(false);
                  setQuery('');
                }}
              >
                <span className="catalog-custom-drawing">Custom</span>
                <span>
                  <strong>Custom item</strong>
                  <small>Use free text with completions</small>
                </span>
              </button>
            )}
            {matches.map(({ entry }) => (
              <button
                type="button"
                key={entry.id}
                className={entry.id === selectedId ? 'catalog-picker-row active' : 'catalog-picker-row'}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(entry.id);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <CatalogDrawing entry={entry} />
                <span>
                  <strong>{combinedStandardCode(entry.standards, selectedStandards) || entry.code}</strong>
                  <small>{entry.description}</small>
                </span>
                <em>{entry.category}</em>
              </button>
            ))}
            {matches.length === 0 && <p className="catalog-empty">No catalog parts match.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export function App() {
  const [state, setState] = useState<AppState>(() => {
    const loadedState = loadState();
    return {
      ...loadedState,
      labelSettings: constrainLabelSettings(loadedState.labelSettings)
    };
  });
  const [selectedId, setSelectedId] = useState(state.hardwareItems[0]?.id ?? '');
  const [previewSvg, setPreviewSvg] = useState('');
  const [previewScale, setPreviewScale] = useState(1);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [zipFormats, setZipFormats] = useState<ExportFormat[]>(['svg', 'png', 'lbx']);
  const [printSvgs, setPrintSvgs] = useState<string[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetCodeModalOpen, setPresetCodeModalOpen] = useState(false);
  const [systemFontFamilies, setSystemFontFamilies] = useState<string[]>([]);
  const [presetName, setPresetName] = useState('');
  const [presetCategories, setPresetCategories] = useState<HardwareCategory[]>([]);
  const [isResizingLabel, setIsResizingLabel] = useState(false);
  const [isResizingElement, setIsResizingElement] = useState(false);
  const [labelWidthInput, setLabelWidthInput] = useState(() => formatLabelDimensionInput(state.labelSettings.widthMm, state.unitSystem));
  const [labelHeightInput, setLabelHeightInput] = useState(() => formatLabelDimensionInput(state.labelSettings.heightMm, state.unitSystem));
  const [labelMarginInput, setLabelMarginInput] = useState(() => formatLabelDimensionInput(state.labelSettings.marginMm, state.unitSystem));
  const [successToast, setSuccessToast] = useState('');
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const successToastTimeoutRef = useRef<number | null>(null);
  const dragRef = useRef<{
    fieldId: string;
    pointerId: number;
    startX: number;
    startY: number;
    fieldX: number;
    fieldY: number;
    moved: boolean;
    wasSelected: boolean;
  } | null>(null);
  const labelResizeRef = useRef<{
    mode: LabelResizeMode;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    widthMm: number;
    heightMm: number;
    scale: number;
  } | null>(null);
  const elementResizeRef = useRef<{
    fieldId: string;
    mode: ElementResizeMode;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    width: number;
    height: number;
    scale: number;
  } | null>(null);

  const selectedItem = useMemo(
    () => state.hardwareItems.find((item) => item.id === selectedId) ?? state.hardwareItems[0],
    [selectedId, state.hardwareItems]
  );
  const selectedField = useMemo(
    () => state.labelSettings.fields.find((field) => field.id === selectedFieldId),
    [selectedFieldId, state.labelSettings.fields]
  );

  const selectedPurchaseLink = selectedItem ? effectivePurchaseLink(state.purchaseLinks, selectedItem) : '';
  const selectedCatalogEntry = getCatalogEntryForItem(selectedItem);
  const selectedStandardImageReference = selectedItem ? standardImageReferenceForItem(selectedItem) : undefined;
  const selectedSpecUnitSystem = selectedCatalogEntry?.unitSystem ?? state.unitSystem;
  const filteredCatalog = standardsCatalog.filter((entry) => catalogMatchesSelectedStandards(entry, state.selectedStandards));
  const batchCatalogEntry = filteredCatalog.find((entry) => entry.id === state.batchCatalogId) ?? filteredCatalog[0] ?? standardsCatalog[0];
  const selectedCatalogLocked = Boolean(selectedCatalogEntry);
  const activeSpecDefinitions = getCategorySpecDefinitions(selectedItem?.category ?? 'custom');
  const batchSpecDefinitions = getCategorySpecDefinitions(batchCatalogEntry.category);
  const isBatchReadonlyWasherDimension = (key: HardwareSpecKey) => batchCatalogEntry.category === 'washer' && isWasherDimensionKey(key);
  const batchCombinationSpecDefinitions = batchSpecDefinitions.filter((definition) => !isBatchReadonlyWasherDimension(definition.key));
  const hasQrElement = state.labelSettings.fields.some((field) => field.kind === 'image' && field.imageSource === 'qr' && field.style.visible);
  const qrInfo = hasQrElement ? buildQrPayload(selectedPurchaseLink) : undefined;
  const previewBaseWidth = state.labelSettings.widthMm * mmToPx;
  const previewBaseHeight = state.labelSettings.heightMm * mmToPx;
  const builtInPresetOptions = Object.values(builtInLabelPresets).filter((preset) => presetAppliesToCategory(preset, selectedItem.category));
  const customPresetOptions = state.customPresets.filter((preset) => presetAppliesToCategory(preset, selectedItem.category));
  const presetOptions = [...builtInPresetOptions, ...customPresetOptions];
  const activePreset = presetOptions.find((preset) => presetMatchesSettings(preset, state.labelSettings));
  const activeCustomPreset = activePreset ? state.customPresets.find((preset) => preset.id === activePreset.id) : undefined;
  const presetIsModified = !activePreset;
  const activePresetValue = activePreset?.id ?? modifiedPresetValue;
  const availableFontFamilies = useMemo(() => uniqueValues([...fontFamilies, ...systemFontFamilies]), [systemFontFamilies]);
  const presetCode = useMemo(() => {
    const name = activePreset?.name ?? `Preset ${formatLabelSize(state.labelSettings.widthMm, state.labelSettings.heightMm, state.unitSystem)}`;
    const id = activePreset?.id ?? slugifyPresetId(`${selectedItem.category}-${name}`);
    const preset: LabelPreset = {
      id,
      name,
      categories: activePreset?.categories.length ? activePreset.categories : [selectedItem.category],
      widthMm: state.labelSettings.widthMm,
      heightMm: state.labelSettings.heightMm,
      tapeWidthMm: state.labelSettings.tapeWidthMm,
      marginMm: state.labelSettings.marginMm,
      fields: clonePlacedFields(state.labelSettings.fields)
    };

    return `${formatTsKey(id)}: ${formatTsValue(preset)},`;
  }, [activePreset, selectedItem.category, state.labelSettings, state.unitSystem]);
  const placeholderOptions = useMemo(() => {
    const base = [
      'standard',
      ...standardFamilies
        .filter((family) => selectedItem.standardCodes[family])
        .map((family) => standardPlaceholderKeys[family]),
      'category'
    ];
    const specPlaceholders = activeSpecDefinitions.flatMap((definition) =>
      definition.key === 'innerDiameter'
        ? ['innerDiameter', 'id']
        : definition.key === 'outerDiameter'
          ? ['outerDiameter', 'od']
          : definition.key === 'length'
            ? ['length', 'lengthUnit']
            : [definition.placeholder]
    );
    return uniqueValues([...base, ...specPlaceholders])
      .filter((key) => key in placeholderLabels)
      .map((key) => `{${key}}`);
  }, [activeSpecDefinitions, selectedItem.standardCodes]);

  useLayoutEffect(() => {
    const stage = previewStageRef.current;
    if (!stage) return;

    const updatePreviewScale = () => {
      const styles = window.getComputedStyle(stage);
      const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const verticalPadding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const availableWidth = Math.max(1, stage.clientWidth - horizontalPadding);
      const availableHeight = Math.max(1, stage.clientHeight - verticalPadding);
      const nextScale = Math.min(availableWidth / previewBaseWidth, availableHeight / previewBaseHeight);

      setPreviewScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
    };

    updatePreviewScale();
    const observer = new ResizeObserver(updatePreviewScale);
    observer.observe(stage);
    window.addEventListener('resize', updatePreviewScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePreviewScale);
    };
  }, [previewBaseHeight, previewBaseWidth]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(
    () => () => {
      if (successToastTimeoutRef.current) {
        window.clearTimeout(successToastTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    setLabelWidthInput(formatLabelDimensionInput(state.labelSettings.widthMm, state.unitSystem));
    setLabelHeightInput(formatLabelDimensionInput(state.labelSettings.heightMm, state.unitSystem));
    setLabelMarginInput(formatLabelDimensionInput(state.labelSettings.marginMm, state.unitSystem));
  }, [state.labelSettings.widthMm, state.labelSettings.heightMm, state.labelSettings.marginMm, state.unitSystem]);

  useEffect(() => {
    if (!batchModalOpen && !presetModalOpen && !presetCodeModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setBatchModalOpen(false);
        setPresetModalOpen(false);
        setPresetCodeModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [batchModalOpen, presetModalOpen, presetCodeModalOpen]);

  useEffect(() => {
    if (!selectedFieldId || batchModalOpen || presetModalOpen || presetCodeModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;

      const target = event.target instanceof HTMLElement ? event.target : null;
      const isEditableTarget =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        Boolean(target?.isContentEditable);

      if (isEditableTarget) return;

      event.preventDefault();
      removeField(selectedFieldId);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [batchModalOpen, presetCodeModalOpen, presetModalOpen, selectedFieldId]);

  useEffect(() => {
    if (!isResizingLabel) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const resize = labelResizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) return;

      event.preventDefault();
      resizeLabelFromClient(event.clientX, event.clientY);
    };

    const handlePointerEnd = (event: globalThis.PointerEvent) => {
      const resize = labelResizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) return;

      labelResizeRef.current = null;
      setIsResizingLabel(false);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [isResizingLabel]);

  useEffect(() => {
    if (!isResizingElement) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const resize = elementResizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) return;

      event.preventDefault();
      resizeElementFromClient(event.clientX, event.clientY);
    };

    const handlePointerEnd = (event: globalThis.PointerEvent) => {
      const resize = elementResizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) return;

      elementResizeRef.current = null;
      setIsResizingElement(false);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [isResizingElement]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedItem) {
      setPreviewSvg('');
      return;
    }

    renderLabelSvg(selectedItem, state.labelSettings, selectedPurchaseLink, selectedSpecUnitSystem, {
      interactive: true,
      hoveredFieldId,
      selectedFieldId
    }).then((svg) => {
      if (!cancelled) {
        setPreviewSvg(svg);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [hoveredFieldId, selectedFieldId, selectedItem, selectedPurchaseLink, selectedSpecUnitSystem, state.labelSettings]);

  const updateState = (patch: Partial<AppState>) => setState((current) => ({ ...current, ...patch }));

  const showSuccessToast = (message: string) => {
    setSuccessToast(message);

    if (successToastTimeoutRef.current) {
      window.clearTimeout(successToastTimeoutRef.current);
    }

    successToastTimeoutRef.current = window.setTimeout(() => {
      setSuccessToast('');
      successToastTimeoutRef.current = null;
    }, 2400);
  };

  const handleManualSave = () => {
    saveState(state);
    showSuccessToast('Saved successfully.');
  };

  const copyPresetCode = async () => {
    try {
      await navigator.clipboard.writeText(presetCode);
      showSuccessToast('Preset code copied.');
    } catch {
      showSuccessToast('Preset code ready to copy.');
    }
  };

  const loadSystemFonts = async () => {
    const queryLocalFonts = (window as LocalFontAccessWindow).queryLocalFonts;
    if (!queryLocalFonts) {
      window.alert('This browser does not support reading local system fonts.');
      return;
    }

    try {
      const fonts = await queryLocalFonts();
      const families = uniqueValues(fonts.map((font) => font.family).sort((a, b) => a.localeCompare(b)));
      setSystemFontFamilies(families);
      showSuccessToast(`Loaded ${families.length} system fonts.`);
    } catch {
      window.alert('System font access was not allowed.');
    }
  };

  const updateStandardFilter = (family: AppState['selectedStandards'][number], checked: boolean) => {
    setState((current) => {
      const selectedStandards = checked
        ? uniqueValues([...current.selectedStandards, family]) as AppState['selectedStandards']
        : current.selectedStandards.filter((entry) => entry !== family);
      const nextCatalog = standardsCatalog.find((entry) => entry.id === current.batchCatalogId && catalogMatchesSelectedStandards(entry, selectedStandards)) ??
        standardsCatalog.find((entry) => catalogMatchesSelectedStandards(entry, selectedStandards));

      return {
        ...current,
        selectedStandards,
        ...(nextCatalog ? { batchCatalogId: nextCatalog.id } : {})
      };
    });
  };

  const updateSelectedItem = (patch: Partial<HardwareItem>) => {
    if (!selectedItem) return;
    setState((current) => ({
      ...current,
      hardwareItems: current.hardwareItems.map((item) => (item.id === selectedItem.id ? syncHardwareSpecs({ ...item, ...patch }) : item))
    }));
  };

  const applyCategoryPresetToState = (current: AppState, category: HardwareCategory): Pick<AppState, 'labelSettings'> => {
    const preset = getCategoryPreset(category, current.customPresets);
    if (!preset) {
      return { labelSettings: current.labelSettings };
    }

    return {
      labelSettings: constrainLabelSettings(presetToLabelSettings(preset, isBuiltInPresetId(preset.id)))
    };
  };

  const buildCatalogItemPatch = (entry: StandardCatalogEntry, item: HardwareItem): Partial<HardwareItem> => {
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
    const boltClassCandidate = specs.boltClass ?? item.boltClass;
    const boltClassItem = { ...item, material, materialType, unitSystem: entry.unitSystem, boltClass: boltClassCandidate };
    const boltClass = isValidBoltClass(boltClassItem, entry.unitSystem) ? boltClassCandidate : defaultBoltClass(boltClassItem, entry.unitSystem);
    const size = specs.size ?? item.size;
    const metricPitch = entry.unitSystem === 'metric' ? defaultMetricThreadPitch(size) : undefined;
    const threadPitchName = metricPitch?.name ?? specs.threadPitchName ?? item.threadPitchName;
    const threadPitch = metricPitch?.value ?? specs.threadPitch ?? item.threadPitch;
    const threadPitchUnit = metricPitch ? 'mm' : specs.threadPitchUnit ?? item.threadPitchUnit;

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
      boltClass,
      threadPitchName,
      threadPitch,
      threadPitchUnit
    };
  };

  const updateSelectedSpec = (key: HardwareSpecKey, value: string) => {
    if (!selectedItem) return;
    if (key === 'size') {
      const metricPitch = selectedSpecUnitSystem === 'metric' ? defaultMetricThreadPitch(value) : undefined;
      const washerDimensionSpecs =
        selectedCatalogEntry?.category === 'washer'
          ? Object.fromEntries(
              ['thickness', 'innerDiameter', 'outerDiameter'].flatMap((dimensionKey) => {
                const dimensionValue = getCatalogWasherDimensionValue(selectedCatalogEntry, dimensionKey as HardwareSpecKey, selectedSpecUnitSystem, value);
                return dimensionValue ? [[dimensionKey, dimensionValue]] : [];
              })
            )
          : {};
      updateSelectedItem({
        size: value,
        ...(metricPitch
          ? {
              threadPitchName: metricPitch.name,
              threadPitch: metricPitch.value,
              threadPitchUnit: 'mm'
            }
          : {}),
        specs: {
          ...selectedItem.specs,
          size: value,
          ...washerDimensionSpecs,
          ...(metricPitch
            ? {
                threadPitchName: metricPitch.name,
                threadPitch: metricPitch.value,
                threadPitchUnit: 'mm'
              }
            : {})
        }
      });
      return;
    }

    if (key === 'length') {
      const normalized = normalizeLengthSpec(value, selectedItem.lengthUnit);
      updateSelectedItem({
        ...patchItemSpec(selectedItem, key, normalized.length),
        lengthUnit: normalized.lengthUnit
      });
      return;
    }

    if (key === 'threadPitchName') {
      const metricPitch = selectedSpecUnitSystem === 'metric' ? findMetricThreadPitch(selectedItem.size, value) : undefined;
      updateSelectedItem({
        threadPitchName: metricPitch?.name ?? value,
        ...(metricPitch ? { threadPitch: metricPitch.value, threadPitchUnit: 'mm' } : {}),
        specs: {
          ...selectedItem.specs,
          threadPitchName: metricPitch?.name ?? value,
          ...(metricPitch ? { threadPitch: metricPitch.value, threadPitchUnit: 'mm' } : {})
        }
      });
      return;
    }

    if (key === 'material') {
      const materialType = isValidMaterialTreatment(value, selectedItem.materialType) ? selectedItem.materialType : defaultMaterialTreatment(value);
      const boltClassItem = { ...selectedItem, material: value, materialType };
      const boltClass = isValidBoltClass(boltClassItem, selectedSpecUnitSystem) ? selectedItem.boltClass : defaultBoltClass(boltClassItem, selectedSpecUnitSystem);
      updateSelectedItem({
        material: value,
        materialType,
        boltClass,
        specs: {
          ...selectedItem.specs,
          material: value,
          materialType,
          boltClass
        }
      });
      return;
    }

    if (key === 'materialType') {
      const boltClassItem = { ...selectedItem, materialType: value };
      const boltClass = isValidBoltClass(boltClassItem, selectedSpecUnitSystem) ? selectedItem.boltClass : defaultBoltClass(boltClassItem, selectedSpecUnitSystem);
      updateSelectedItem({
        materialType: value,
        boltClass,
        specs: {
          ...selectedItem.specs,
          materialType: value,
          boltClass
        }
      });
      return;
    }

    updateSelectedItem(patchItemSpec(selectedItem, key, value));
  };

  const updateSelectedCategory = (category: HardwareCategory) => {
    if (!selectedItem) return;

    setState((current) => ({
      ...current,
      ...applyCategoryPresetToState(current, category),
      hardwareItems: current.hardwareItems.map((item) =>
        item.id === selectedItem.id
          ? syncHardwareSpecs({
              ...item,
              catalogId: undefined,
              category,
              specs: { ...item.specs }
            })
          : item
      )
    }));
    setSelectedFieldId(null);
  };

  const updatePurchaseLink = (purchaseLink: string) => {
    if (!selectedItem) return;
    setState((current) => ({
      ...current,
      purchaseLinks: {
        ...current.purchaseLinks,
        [selectedItem.id]: purchaseLink
      }
    }));
  };

  const applyCatalogEntry = (entryId: string) => {
    if (!entryId) {
      updateSelectedItem({ catalogId: undefined, unitSystem: state.unitSystem });
      return;
    }

    const entry = standardsCatalog.find((candidate) => candidate.id === entryId);
    if (!entry || !selectedItem) return;

    const batchSpecs = Object.fromEntries(
      categorySpecKeys[entry.category].map((key) => [key, getAllCatalogSpecOptions(entry, entry.category, key).join(', ')])
    ) as Partial<Record<HardwareSpecKey, string>>;

    setState((current) => ({
      ...current,
      ...applyCategoryPresetToState(current, entry.category),
      batchCatalogId: entry.id,
      batchSpecs,
      hardwareItems: current.hardwareItems.map((item) =>
        item.id === selectedItem.id ? syncHardwareSpecs({ ...item, ...buildCatalogItemPatch(entry, item) }) : item
      )
    }));
    setSelectedFieldId(null);
  };

  const updateUnitSystem = (unitSystem: AppState['unitSystem']) => {
    setState((current) => {
      const currentItem = current.hardwareItems.find((item) => item.id === selectedId);
      const currentCatalog = getCatalogEntryForItem(currentItem);

      return {
        ...current,
        unitSystem,
        hardwareItems: current.hardwareItems.map((item) => {
          if (item.id !== selectedId) {
            return item;
          }

          if (currentCatalog) {
            return item;
          }

          return syncHardwareSpecs({
            ...item,
            unitSystem
          });
        })
      };
    });
  };

  const addItem = () => {
    const base = selectedItem ?? state.hardwareItems[0];
    const next = { ...base, id: createId('item') };
    setState((current) => ({
      ...current,
      hardwareItems: [...current.hardwareItems, next]
    }));
    setSelectedId(next.id);
  };

  const removeHardwareItem = (itemId: string) => {
    if (state.hardwareItems.length === 1) return;

    const remaining = state.hardwareItems.filter((item) => item.id !== itemId);
    setState((current) => ({
      ...current,
      hardwareItems: remaining,
      purchaseLinks: Object.fromEntries(Object.entries(current.purchaseLinks).filter(([key]) => key !== itemId))
    }));

    if (selectedId === itemId) {
      setSelectedId(remaining[0]?.id ?? '');
    }
  };

  const resetHardwareList = () => {
    const confirmed = window.confirm('Reset the hardware list and saved purchase links to the starter item?');
    if (!confirmed) return;

    const hardwareItems = defaultAppState.hardwareItems.map((item) => ({ ...item }));

    setState((current) => ({
      ...current,
      hardwareItems,
      purchaseLinks: {}
    }));
    setSelectedId(hardwareItems[0]?.id ?? '');
  };

  const applyPreset = (presetId: string) => {
    if (presetId === modifiedPresetValue) {
      return;
    }

    const builtInPreset = isBuiltInPresetId(presetId) ? builtInLabelPresets[presetId] : undefined;
    const customPreset = state.customPresets.find((preset) => preset.id === presetId);
    const preset = builtInPreset ?? customPreset;

    if (!preset) return;

    setState((current) => ({
      ...current,
      labelSettings: constrainLabelSettings(presetToLabelSettings(preset, Boolean(builtInPreset)))
    }));
    setSelectedFieldId(null);
  };

  const openPresetSaveModal = () => {
    setPresetName(`Preset ${formatLabelSize(state.labelSettings.widthMm, state.labelSettings.heightMm, state.unitSystem)}`);
    setPresetCategories([selectedItem.category]);
    setPresetModalOpen(true);
  };

  const saveCustomPreset = () => {
    const name = presetName.trim();
    if (!name) return;

    const preset: LabelPreset = {
      id: createId('preset'),
      name,
      categories: presetCategories.length > 0 ? presetCategories : [selectedItem.category],
      widthMm: state.labelSettings.widthMm,
      heightMm: state.labelSettings.heightMm,
      tapeWidthMm: state.labelSettings.tapeWidthMm,
      marginMm: state.labelSettings.marginMm,
      fields: clonePlacedFields(state.labelSettings.fields)
    };

    setState((current) => ({
      ...current,
      customPresets: [...current.customPresets, preset],
      labelSettings: {
        ...current.labelSettings,
        layout: 'custom'
      }
    }));
    setPresetModalOpen(false);
    showSuccessToast('Preset saved.');
  };

  const deleteCustomPreset = (presetId: string) => {
    setState((current) => ({
      ...current,
      customPresets: current.customPresets.filter((preset) => preset.id !== presetId)
    }));
  };

  const commitLabelDimensionInput = (dimension: LabelDimensionKey, rawValue: string) => {
    const numericValue = parseLabelDimensionInput(rawValue, state.unitSystem);
    if (!Number.isFinite(numericValue) || (dimension === 'marginMm' ? numericValue < 0 : numericValue <= 0)) {
      if (dimension === 'widthMm') setLabelWidthInput(formatLabelDimensionInput(state.labelSettings.widthMm, state.unitSystem));
      else if (dimension === 'heightMm') setLabelHeightInput(formatLabelDimensionInput(state.labelSettings.heightMm, state.unitSystem));
      else setLabelMarginInput(formatLabelDimensionInput(state.labelSettings.marginMm, state.unitSystem));
      return;
    }

    const min = dimension === 'widthMm' ? minLabelWidthMm : dimension === 'heightMm' ? minLabelHeightMm : 0;
    const max = dimension === 'widthMm' ? maxLabelWidthMm : dimension === 'heightMm' ? maxLabelHeightMm : maxMarginForSettings(state.labelSettings);
    const nextValue = Number(clamp(numericValue, min, max).toFixed(2));

    setState((current) => ({
      ...current,
      labelSettings: constrainLabelSettings({
        ...current.labelSettings,
        layout: 'custom',
        [dimension]: nextValue
      })
    }));
  };

  const stepLabelDimensionInput = (dimension: LabelDimensionKey, direction: 1 | -1) => {
    const currentValue =
      dimension === 'widthMm' ? state.labelSettings.widthMm : dimension === 'heightMm' ? state.labelSettings.heightMm : state.labelSettings.marginMm;
    const min = dimension === 'widthMm' ? minLabelWidthMm : dimension === 'heightMm' ? minLabelHeightMm : 0;
    const max = dimension === 'widthMm' ? maxLabelWidthMm : dimension === 'heightMm' ? maxLabelHeightMm : maxMarginForSettings(state.labelSettings);
    const nextValue = Number(clamp(currentValue + direction * labelDimensionStepMm(state.unitSystem), min, max).toFixed(2));

    setState((current) => ({
      ...current,
      labelSettings: constrainLabelSettings({
        ...current.labelSettings,
        layout: 'custom',
        [dimension]: nextValue
      })
    }));
  };

  const updateField = (fieldId: string, patch: Partial<PlacedField>) => {
    setState((current) => ({
      ...current,
      labelSettings: {
        ...current.labelSettings,
        layout: 'custom',
        fields: current.labelSettings.fields.map((field) =>
          field.id === fieldId ? constrainFieldToSettings({ ...field, ...patch }, current.labelSettings) : field
        )
      }
    }));
  };

  const removeField = (fieldId: string) => {
    setState((current) => {
      const fields = current.labelSettings.fields.filter((candidate) => candidate.id !== fieldId);
      return {
        ...current,
        labelSettings: {
          ...current.labelSettings,
          layout: 'custom',
          fields
        }
      };
    });

    setSelectedFieldId((current) => (current === fieldId ? null : current));
  };

  const updateFieldStyle = (fieldId: string, patch: Partial<PlacedField['style']>) => {
    setState((current) => ({
      ...current,
      labelSettings: {
        ...current.labelSettings,
        layout: 'custom',
        fields: current.labelSettings.fields.map((field) =>
          field.id === fieldId
            ? constrainFieldToSettings(
                {
                  ...field,
                  height: field.kind === 'text' && patch.fontSize !== undefined ? autoTextElementHeight({ style: { ...field.style, ...patch } }) : field.height,
                  style: { ...field.style, ...patch }
                },
                current.labelSettings
              )
            : field
        )
      }
    }));
  };

  const updateFrameStyle = (fieldId: string, patch: Partial<PlacedField['frameStyle']>) => {
    setState((current) => ({
      ...current,
      labelSettings: {
        ...current.labelSettings,
        layout: 'custom',
        fields: current.labelSettings.fields.map((field) =>
          field.id === fieldId ? { ...field, frameStyle: { ...defaultFrameStyle, ...field.frameStyle, ...patch } } : field
        )
      }
    }));
  };

  const updateElementKind = (field: PlacedField, kind: LabelElementKind) => {
    if (kind === 'frame') {
      updateField(field.id, {
        kind,
        text: undefined,
        imageSource: undefined,
        imageBase64: undefined,
        imageMimeType: undefined,
        imageName: undefined,
        x: 0,
        y: 0,
        width: state.labelSettings.widthMm,
        height: state.labelSettings.heightMm,
        frameStyle: { ...defaultFrameStyle, ...field.frameStyle }
      });
      return;
    }

    if (kind === 'image') {
      updateField(field.id, { kind, text: undefined, imageSource: field.imageSource ?? 'qr', frameStyle: undefined });
      return;
    }

    updateField(field.id, {
      kind,
      text: field.text ?? '{standardDin} {standardIso}',
      imageSource: undefined,
      imageBase64: undefined,
      imageMimeType: undefined,
      imageName: undefined,
      frameStyle: undefined
    });
  };

  const appendPlaceholder = (field: PlacedField, placeholder: string) => {
    const currentText = field.text ?? '';
    updateField(field.id, { text: `${currentText}${currentText && !currentText.endsWith(' ') ? ' ' : ''}${placeholder}` });
  };

  const updateCustomImage = async (fieldId: string, file: File | undefined) => {
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    const supportedMimeTypes = ['image/bmp', 'image/x-ms-bmp', 'image/png', 'image/svg+xml'];
    const supportedExtensions = ['bmp', 'png', 'svg'];
    if (!supportedMimeTypes.includes(file.type) && !supportedExtensions.includes(extension ?? '')) {
      window.alert('Custom label images must be BMP, PNG, or SVG.');
      return;
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';

    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }

    const imageBase64 = btoa(binary);

    updateField(fieldId, {
      imageSource: 'custom',
      imageBase64,
      imageMimeType: file.type || 'application/octet-stream',
      imageName: file.name
    });
  };

  const getPreviewPointerPosition = (event: ReactPointerEvent<HTMLDivElement>) => {
    const svg = previewStageRef.current?.querySelector('.label-preview svg');
    const rect = svg?.getBoundingClientRect();

    if (!rect || rect.width === 0 || rect.height === 0) {
      return null;
    }

    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * state.labelSettings.widthMm, 0, state.labelSettings.widthMm),
      y: clamp(((event.clientY - rect.top) / rect.height) * state.labelSettings.heightMm, 0, state.labelSettings.heightMm)
    };
  };

  const getPreviewFieldId = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest('[data-field-id]')?.getAttribute('data-field-id') ?? null;
  };

  const handlePreviewPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const fieldId = getPreviewFieldId(event);
    const position = getPreviewPointerPosition(event);
    const field = state.labelSettings.fields.find((candidate) => candidate.id === fieldId);

    if (!fieldId || !position || !field) {
      return;
    }

    if (field.kind === 'frame') {
      event.preventDefault();
      setHoveredFieldId(fieldId);
      setSelectedFieldId((current) => (current === fieldId ? null : fieldId));
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setHoveredFieldId(fieldId);
    setSelectedFieldId(fieldId);
    dragRef.current = {
      fieldId,
      pointerId: event.pointerId,
      startX: position.x,
      startY: position.y,
      fieldX: field.x,
      fieldY: field.y,
      moved: false,
      wasSelected: selectedFieldId === fieldId
    };
  };

  const handlePreviewPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (!drag) {
      const nextHoveredFieldId = getPreviewFieldId(event);
      setHoveredFieldId((current) => (current === nextHoveredFieldId ? current : nextHoveredFieldId));
      return;
    }

    const position = getPreviewPointerPosition(event);
    const field = state.labelSettings.fields.find((candidate) => candidate.id === drag.fieldId);

    if (!position || !field) {
      return;
    }

    const deltaX = position.x - drag.startX;
    const deltaY = position.y - drag.startY;

    if (!drag.moved && Math.hypot(deltaX, deltaY) < 0.25) {
      return;
    }

    drag.moved = true;
    const marginMm = normalizedMarginMm(state.labelSettings);
    const nextX = clamp(drag.fieldX + deltaX, marginMm, Math.max(marginMm, state.labelSettings.widthMm - marginMm - field.width));
    const nextY = clamp(drag.fieldY + deltaY, marginMm, Math.max(marginMm, state.labelSettings.heightMm - marginMm - field.height));

    updateField(drag.fieldId, {
      x: Number(nextX.toFixed(2)),
      y: Number(nextY.toFixed(2))
    });
  };

  const endPreviewDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (dragRef.current?.pointerId === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (drag?.pointerId === event.pointerId && !drag.moved && drag.wasSelected) {
      setSelectedFieldId(null);
    }

    dragRef.current = null;
  };

  const resizeLabelFromClient = (clientX: number, clientY: number) => {
    const resize = labelResizeRef.current;

    if (!resize) return;

    const scale = Math.max(0.01, resize.scale);
    const deltaWidthMm = (clientX - resize.startClientX) / (mmToPx * scale);
    const deltaHeightMm = (clientY - resize.startClientY) / (mmToPx * scale);
    const widthMm =
      resize.mode === 'width' || resize.mode === 'both'
        ? Math.round(clamp(resize.widthMm + deltaWidthMm, minLabelWidthMm, maxLabelWidthMm))
        : resize.widthMm;
    const heightMm =
      resize.mode === 'height' || resize.mode === 'both'
        ? Math.round(clamp(resize.heightMm + deltaHeightMm, minLabelHeightMm, maxLabelHeightMm))
        : resize.heightMm;

    setState((current) => {
      if (current.labelSettings.widthMm === widthMm && current.labelSettings.heightMm === heightMm) {
        return current;
      }

      return {
        ...current,
        labelSettings: constrainLabelSettings({
          ...current.labelSettings,
          layout: 'custom',
          widthMm,
          heightMm
        })
      };
    });
  };

  const handleLabelResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, mode: LabelResizeMode) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedFieldId(null);
    setHoveredFieldId(null);
    setIsResizingLabel(true);
    labelResizeRef.current = {
      mode,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      widthMm: state.labelSettings.widthMm,
      heightMm: state.labelSettings.heightMm,
      scale: previewScale
    };
  };

  const resizeElementFromClient = (clientX: number, clientY: number) => {
    const resize = elementResizeRef.current;

    if (!resize) return;

    const field = state.labelSettings.fields.find((candidate) => candidate.id === resize.fieldId);
    if (!field || field.kind === 'frame') return;

    const scale = Math.max(0.01, resize.scale);
    const deltaWidthMm = (clientX - resize.startClientX) / (mmToPx * scale);
    const deltaHeightMm = (clientY - resize.startClientY) / (mmToPx * scale);
    const marginMm = normalizedMarginMm(state.labelSettings);
    const maxWidth = Math.max(minElementWidthMm, state.labelSettings.widthMm - marginMm - field.x);
    const maxHeight = Math.max(minElementHeightMm, state.labelSettings.heightMm - marginMm - field.y);
    const width =
      resize.mode === 'width' || resize.mode === 'both'
        ? Number(clamp(resize.width + deltaWidthMm, minElementWidthMm, maxWidth).toFixed(2))
        : field.width;
    const height =
      resize.mode === 'height' || resize.mode === 'both'
        ? Number(clamp(resize.height + deltaHeightMm, minElementHeightMm, maxHeight).toFixed(2))
        : field.height;

    updateField(resize.fieldId, { width, height });
  };

  const handleElementResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, field: PlacedField, mode: ElementResizeMode) => {
    event.preventDefault();
    event.stopPropagation();

    if (field.kind === 'frame') return;

    setSelectedFieldId(field.id);
    setHoveredFieldId(field.id);
    setIsResizingElement(true);
    elementResizeRef.current = {
      fieldId: field.id,
      mode,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      width: field.width,
      height: field.height,
      scale: previewScale
    };
  };

  const addField = () => {
    const marginMm = normalizedMarginMm(state.labelSettings);
    const next: PlacedField = {
      id: createId('field'),
      kind: 'text',
      text: '{standardDin} {standardIso}',
      x: marginMm,
      y: marginMm,
      width: 25,
      height: 6,
      style: { ...defaultFieldStyle }
    };
    setState((current) => ({
      ...current,
      labelSettings: {
        ...current.labelSettings,
        layout: 'custom',
        fields: [...current.labelSettings.fields, constrainFieldToSettings(next, current.labelSettings)]
      }
    }));
    setSelectedFieldId(next.id);
  };

  const updateBatchCatalog = (entryId: string) => {
    const entry = standardsCatalog.find((candidate) => candidate.id === entryId);
    if (!entry) return;

    const batchSpecs = Object.fromEntries(
      categorySpecKeys[entry.category].map((key) => [key, getAllCatalogSpecOptions(entry, entry.category, key).join(', ')])
    ) as Partial<Record<HardwareSpecKey, string>>;

    updateState({
      batchCatalogId: entry.id,
      batchSpecs
    });
  };

  const updateBatchSpec = (key: HardwareSpecKey, value: string) => {
    updateState({
      batchSpecs: {
        ...state.batchSpecs,
        [key]: value
      }
    });
  };

  const batchWasherDimensionValue = (key: HardwareSpecKey) => {
    if (!isBatchReadonlyWasherDimension(key)) return state.batchSpecs[key] ?? '';
    const sizeValues = parseList(state.batchSpecs.size ?? '').length > 0
      ? parseList(state.batchSpecs.size ?? '')
      : getCatalogSpecOptions(batchCatalogEntry, batchCatalogEntry.category, 'size', batchCatalogEntry.unitSystem);
    return uniqueValues(
      sizeValues
        .map((size) => getCatalogWasherDimensionValue(batchCatalogEntry, key, batchCatalogEntry.unitSystem, size))
        .filter((value): value is string => Boolean(value))
    ).join(', ');
  };

  const createBatch = () => {
    if (!selectedItem || !batchCatalogEntry) return;
    const baseItem = syncHardwareSpecs({
      ...selectedItem,
      ...buildCatalogItemPatch(batchCatalogEntry, selectedItem),
      id: selectedItem.id
    });
    const items = generateBatchItems(baseItem, state.batchSpecs);
    setState((current) => ({
      ...current,
      hardwareItems: [...current.hardwareItems, ...items]
    }));
    setSelectedId(items[0]?.id ?? selectedItem.id);
    setBatchModalOpen(false);
  };

  const showPrintSheet = async () => {
    const svgs = await Promise.all(
      state.hardwareItems.map((item) => {
        const catalogEntry = getCatalogEntryForItem(item);
        return renderLabelSvg(item, state.labelSettings, effectivePurchaseLink(state.purchaseLinks, item), catalogEntry?.unitSystem ?? item.unitSystem);
      })
    );
    setPrintSvgs(svgs);
    window.setTimeout(() => window.print(), 150);
  };

  const exportPersistedData = () => {
    downloadBlob(new Blob([serializeBackup(state)], { type: 'application/json' }), 'fastener-label-generator-backup.json');
  };

  const importPersistedData = async (file: File | undefined) => {
    if (!file) return;

    try {
      const importedState = parseBackup(await file.text());
      const confirmed = window.confirm('Importing this file will replace all hardware, purchase links, presets, and settings. Continue?');
      if (!confirmed) return;

      setState({
        ...importedState,
        labelSettings: constrainLabelSettings(importedState.labelSettings)
      });
      setSelectedId(importedState.hardwareItems[0]?.id ?? '');
      setSelectedFieldId(null);
      setHoveredFieldId(null);
      setPrintSvgs([]);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to import backup file.');
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  if (!selectedItem) {
    return <main className="app-shell">No hardware item available.</main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Browser-only organizer labels</p>
          <h1>Fastener Label Generator</h1>
        </div>
        <div className="topbar-actions">
          <fieldset className="standard-filter">
            <legend>Standards</legend>
            {standardFamilies.map((family) => (
              <label key={family}>
                <input
                  type="checkbox"
                  checked={state.selectedStandards.includes(family)}
                  onChange={(event) => updateStandardFilter(family, event.target.checked)}
                />
                {family}
              </label>
            ))}
          </fieldset>
          <fieldset className="standard-filter unit-filter">
            <legend>Units</legend>
            <select value={state.unitSystem} onChange={(event) => updateUnitSystem(event.target.value as AppState['unitSystem'])}>
              <option value="metric">Metric</option>
              <option value="imperial">Imperial</option>
            </select>
          </fieldset>
          <button className="icon-button" type="button" title="Save state" onClick={handleManualSave}>
            <Save size={18} />
          </button>
          <button className="icon-button" type="button" title="Export persisted data" onClick={exportPersistedData}>
            <Download size={18} />
          </button>
          <button className="icon-button" type="button" title="Import persisted data" onClick={() => importInputRef.current?.click()}>
            <Upload size={18} />
          </button>
          <input
            ref={importInputRef}
            className="hidden-file-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importPersistedData(event.target.files?.[0])}
          />
        </div>
      </header>

      <section className="workspace">
        <aside className="panel hardware-list">
          <div className="panel-title">
            <Archive size={18} />
            <h2>Hardware</h2>
          </div>
          <div className="listbox">
            {state.hardwareItems.map((item) => (
              <div key={item.id} className={item.id === selectedItem.id ? 'hardware-card active' : 'hardware-card'}>
                <button type="button" className="list-item" onClick={() => setSelectedId(item.id)}>
                  <strong>{item.standard}</strong>
                  <span className="hardware-description">{getHardwareDescription(item)}</span>
                  <small>{getHardwareSpecLine(item)}</small>
                </button>
                <button
                  type="button"
                  className="icon-button small hardware-remove"
                  title="Remove hardware item"
                  aria-label={`Remove ${item.size} ${item.standard}`}
                  onClick={() => removeHardwareItem(item.id)}
                  disabled={state.hardwareItems.length === 1}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <div className="button-row">
            <button type="button" onClick={addItem}>
              <Plus size={16} /> Add
            </button>
            <button type="button" className="secondary" onClick={() => setBatchModalOpen(true)}>
              <Archive size={16} /> Batch
            </button>
            <button type="button" className="secondary" onClick={resetHardwareList}>
              <RotateCcw size={16} /> Reset
            </button>
          </div>
          <div className="zip-box hardware-export-box">
            <h3>ZIP all hardware cards</h3>
            <div className="check-row">
              {(['svg', 'png', 'lbx'] as ExportFormat[]).map((format) => (
                <label key={format}>
                  <input
                    type="checkbox"
                    checked={zipFormats.includes(format)}
                    onChange={(event) =>
                      setZipFormats((current) => (event.target.checked ? [...current, format] : current.filter((entry) => entry !== format)))
                    }
                  />
                  {format.toUpperCase()}
                </label>
              ))}
            </div>
            <button type="button" onClick={() => exportZip(state.hardwareItems, state.labelSettings, state.purchaseLinks, zipFormats)}>
              <FileArchive size={16} /> Export ZIP
            </button>
            <button type="button" className="secondary" onClick={showPrintSheet}>
              <Printer size={16} /> Print sheet
            </button>
          </div>
        </aside>

        <section className="editor-stack">
          <section className="panel editor-panel">
            <div className="panel-title">
              <FileText size={18} />
              <h2>Hardware specs</h2>
            </div>

            <div className="form-grid">
              <label>
                Catalog
                <CatalogPartPicker
                  entries={filteredCatalog}
                  selectedId={selectedItem.catalogId ?? ''}
                  selectedStandards={state.selectedStandards}
                  onSelect={applyCatalogEntry}
                  includeCustom
                />
              </label>
              <label>
                Category
                <select
                  value={selectedItem.category}
                  disabled={selectedCatalogLocked}
                  onChange={(event) => updateSelectedCategory(event.target.value as HardwareCategory)}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Standard
                <input
                  value={selectedItem.standard}
                  readOnly={selectedCatalogLocked}
                  onChange={(event) => updateSelectedItem({ standard: event.target.value })}
                />
              </label>
              {activeSpecDefinitions.map((definition) => {
                if (definition.key === 'threadPitchUnit') {
                  return null;
                }

                const catalogOptions = selectedCatalogLocked
                  ? getCatalogSpecOptions(selectedCatalogEntry, selectedItem.category, definition.key, selectedSpecUnitSystem)
                  : getAllCatalogSpecOptions(selectedCatalogEntry, selectedItem.category, definition.key);
                const options = definition.key === 'material' && !selectedCatalogLocked ? uniqueValues([...catalogOptions, ...baseMaterials]) : catalogOptions;
                const datalistId = `spec-options-${definition.key}`;
                const materialTypeOptions =
                  definition.key === 'materialType'
                    ? getMaterialTreatmentOptions(selectedItem.material).filter((value) => options.length === 0 || options.includes(value))
                    : [];
                const boltClassOptions =
                  definition.key === 'boltClass'
                    ? getBoltClassOptions(selectedItem, selectedSpecUnitSystem).filter((value) => options.length === 0 || options.includes(value))
                    : [];
                const lengthUnitOptions =
                  definition.key === 'length'
                    ? uniqueValues([
                        selectedItem.lengthUnit,
                        ...options.map((value) => splitLengthAndUnit(value, selectedItem.lengthUnit).lengthUnit)
                      ])
                    : [];
                const lengthOptions = definition.key === 'length'
                  ? uniqueValues([
                      selectedItem.length,
                      ...options.map((value) => splitLengthAndUnit(value, selectedItem.lengthUnit).length)
                    ])
                  : [];
                const threadPitchOptions = definition.key === 'threadPitch' ? uniqueValues([selectedItem.threadPitch, ...options]) : [];
                const threadPitchNameOptions =
                  definition.key === 'threadPitchName'
                    ? uniqueValues([
                        selectedItem.threadPitchName && selectedItem.threadPitch
                          ? formatMetricThreadPitchOption({ size: selectedItem.size, name: selectedItem.threadPitchName, value: selectedItem.threadPitch })
                          : selectedItem.threadPitchName,
                        ...(selectedSpecUnitSystem === 'metric' ? metricThreadPitchNamesForSize(selectedItem.size) : options)
                      ])
                    : [];
                const threadPitchUnitOptions =
                  definition.key === 'threadPitch'
                    ? uniqueValues([
                        selectedItem.threadPitchUnit,
                        ...(selectedCatalogLocked
                          ? getCatalogSpecOptions(selectedCatalogEntry, selectedItem.category, 'threadPitchUnit', selectedSpecUnitSystem)
                          : getAllCatalogSpecOptions(selectedCatalogEntry, selectedItem.category, 'threadPitchUnit'))
                      ])
                    : [];
                const materialOptions = definition.key === 'material' ? uniqueValues([selectedItem.material, ...options]) : [];
                const genericOptions = uniqueValues([getItemSpecValue(selectedItem, definition.key), ...options]);
                const isReadonlyWasherDimension =
                  selectedCatalogLocked && selectedCatalogEntry?.category === 'washer' && isWasherDimensionKey(definition.key);

                return (
                  <label key={definition.key}>
                    {definition.label}
                    {definition.isLength ? (
                      <>
                        <div className="length-row">
                          {selectedCatalogLocked ? (
                            <select value={selectedItem.length} onChange={(event) => updateSelectedSpec(definition.key, event.target.value)}>
                              {lengthOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              list={datalistId}
                              value={selectedItem.length}
                              onChange={(event) => updateSelectedSpec(definition.key, event.target.value)}
                            />
                          )}
                          {selectedCatalogLocked ? (
                            <select
                              value={selectedItem.lengthUnit}
                              aria-label="Length unit"
                              onChange={(event) => updateSelectedItem({ lengthUnit: event.target.value })}
                            >
                              {lengthUnitOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value || 'n/a'}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              list="length-unit-options"
                              value={selectedItem.lengthUnit}
                              aria-label="Length unit"
                              onChange={(event) => updateSelectedItem({ lengthUnit: event.target.value })}
                            />
                          )}
                        </div>
                        <datalist id={datalistId}>
                          {options.map((value) => (
                            <option key={value} value={splitLengthAndUnit(value, selectedItem.lengthUnit).length} />
                          ))}
                        </datalist>
                        <datalist id="length-unit-options">
                          {lengthUnitOptions.map((value) => (
                            <option key={value} value={value} />
                          ))}
                        </datalist>
                      </>
                    ) : definition.key === 'threadPitchName' ? (
                      selectedCatalogLocked ? (
                        <select
                          value={
                            selectedItem.threadPitchName && selectedItem.threadPitch
                              ? formatMetricThreadPitchOption({ size: selectedItem.size, name: selectedItem.threadPitchName, value: selectedItem.threadPitch })
                              : selectedItem.threadPitchName
                          }
                          onChange={(event) => updateSelectedSpec('threadPitchName', event.target.value)}
                        >
                          {threadPitchNameOptions.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input
                            list={datalistId}
                            value={selectedItem.threadPitchName}
                            onChange={(event) => updateSelectedSpec('threadPitchName', event.target.value)}
                          />
                          <datalist id={datalistId}>
                            {threadPitchNameOptions.map((value) => (
                              <option key={value} value={value} />
                            ))}
                          </datalist>
                        </>
                      )
                    ) : definition.key === 'threadPitch' ? (
                      <>
                        <div className="length-row">
                          {selectedCatalogLocked ? (
                            <select value={selectedItem.threadPitch} onChange={(event) => updateSelectedSpec('threadPitch', event.target.value)}>
                              {threadPitchOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              list={datalistId}
                              value={selectedItem.threadPitch}
                              onChange={(event) => updateSelectedSpec('threadPitch', event.target.value)}
                            />
                          )}
                          {selectedCatalogLocked ? (
                            <select
                              value={selectedItem.threadPitchUnit}
                              aria-label="Thread pitch unit"
                              onChange={(event) => updateSelectedSpec('threadPitchUnit', event.target.value)}
                            >
                              {threadPitchUnitOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value || 'n/a'}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              list="thread-pitch-unit-options"
                              value={selectedItem.threadPitchUnit}
                              aria-label="Thread pitch unit"
                              onChange={(event) => updateSelectedSpec('threadPitchUnit', event.target.value)}
                            />
                          )}
                        </div>
                        <datalist id={datalistId}>
                          {options.map((value) => (
                            <option key={value} value={value} />
                          ))}
                        </datalist>
                        <datalist id="thread-pitch-unit-options">
                          {getAllCatalogSpecOptions(selectedCatalogEntry, selectedItem.category, 'threadPitchUnit').map((value) => (
                            <option key={value} value={value} />
                          ))}
                        </datalist>
                      </>
                    ) : definition.key === 'materialType' ? (
                      <>
                        {selectedCatalogLocked ? (
                          <select
                            value={selectedItem.materialType}
                            onChange={(event) => updateSelectedSpec('materialType', event.target.value)}
                          >
                            {materialTypeOptions.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <input
                              list={datalistId}
                              value={selectedItem.materialType}
                              onChange={(event) => updateSelectedSpec('materialType', event.target.value)}
                            />
                            <datalist id={datalistId}>
                              {materialTypeOptions.map((value) => (
                                <option key={value} value={value} />
                              ))}
                            </datalist>
                          </>
                        )}
                      </>
                    ) : definition.key === 'boltClass' ? (
                      <>
                        {selectedCatalogLocked ? (
                          <select
                            value={selectedItem.boltClass}
                            onChange={(event) => updateSelectedSpec('boltClass', event.target.value)}
                          >
                            {boltClassOptions.map((value) => (
                              <option key={value} value={value}>
                                {value || 'n/a'}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <input
                              list={datalistId}
                              value={selectedItem.boltClass}
                              onChange={(event) => updateSelectedSpec('boltClass', event.target.value)}
                            />
                            <datalist id={datalistId}>
                              {boltClassOptions.map((value) => (
                                <option key={value} value={value} />
                              ))}
                            </datalist>
                          </>
                        )}
                      </>
                    ) : definition.key === 'material' && selectedCatalogLocked ? (
                      <select value={selectedItem.material} onChange={(event) => updateSelectedSpec('material', event.target.value)}>
                        {materialOptions.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    ) : isReadonlyWasherDimension ? (
                      <input value={getItemSpecValue(selectedItem, definition.key)} readOnly />
                    ) : selectedCatalogLocked ? (
                      <select value={getItemSpecValue(selectedItem, definition.key)} onChange={(event) => updateSelectedSpec(definition.key, event.target.value)}>
                        {genericOptions.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <>
                        <input
                          list={datalistId}
                          value={getItemSpecValue(selectedItem, definition.key)}
                          onChange={(event) => updateSelectedSpec(definition.key, event.target.value)}
                        />
                        <datalist id={datalistId}>
                          {options.map((value) => (
                            <option key={value} value={value} />
                          ))}
                        </datalist>
                      </>
                    )}
                  </label>
                );
              })}
            </div>

            {selectedStandardImageReference && (
              <section className="standard-images-section">
                <div className="standard-images-title">
                  <span>Catalog assets</span>
                  <span>{selectedItem.catalogId}</span>
                </div>
                <div className="standard-image-grid">
                  {catalogAssetSources.map((source) => (
                    <div
                      key={source}
                      className="standard-image-card"
                    >
                      <img src={catalogAssetPreviewUrl(selectedStandardImageReference, source)} alt={`${catalogAssetLabel(source)} for ${selectedItem.standard}`} loading="lazy" />
                      <span>{catalogAssetLabel(source)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {hasQrElement && (
              <section className="links-section">
                <label className="template-control">
                  <span className="panel-title-main">
                    <QrCode size={18} />
                    <span>Purchase link</span>
                  </span>
                  <input
                    value={selectedPurchaseLink}
                    placeholder="https://..."
                    inputMode="url"
                    onChange={(event) => updatePurchaseLink(event.target.value)}
                  />
                </label>
              </section>
            )}
          </section>

          <section className="panel label-design-panel">
            <div className="panel-title">
              <FileText size={18} />
              <h2>Label design</h2>
            </div>

            <div className="preset-actions design-actions">
              <label className="preset-select">
                <span>Preset</span>
                <select value={activePresetValue} onChange={(event) => applyPreset(event.target.value)}>
                  {presetIsModified && (
                    <option value={modifiedPresetValue} disabled>
                      Modified preset
                    </option>
                  )}
                  {builtInPresetOptions.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                  {customPresetOptions.length > 0 && <option disabled>Custom presets</option>}
                  {customPresetOptions.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>
              {presetIsModified && (
                <button type="button" className="secondary preset-save" onClick={openPresetSaveModal}>
                  <Save size={15} /> Save
                </button>
              )}
              <button type="button" className="secondary preset-save" onClick={() => setPresetCodeModalOpen(true)}>
                <Code2 size={15} /> Dev export
              </button>
              {activeCustomPreset && (
                <button type="button" className="icon-button small secondary" title="Delete selected preset" onClick={() => deleteCustomPreset(activeCustomPreset.id)}>
                  <Trash2 size={15} />
                </button>
              )}
              <div className="label-size-inputs" aria-label="Label size">
                <label>
                  <span>Width</span>
                  <div className="unit-input">
                    <input
                      value={labelWidthInput}
                      inputMode="decimal"
                      aria-label={`Label width in ${state.unitSystem === 'imperial' ? 'inches' : 'millimeters'}`}
                      onChange={(event) => setLabelWidthInput(event.target.value)}
                      onBlur={() => commitLabelDimensionInput('widthMm', labelWidthInput)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitLabelDimensionInput('widthMm', labelWidthInput);
                        if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          stepLabelDimensionInput('widthMm', 1);
                        }
                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          stepLabelDimensionInput('widthMm', -1);
                        }
                      }}
                    />
                    <span>{labelDimensionUnit(state.unitSystem)}</span>
                  </div>
                </label>
                <span className="size-separator">x</span>
                <label>
                  <span>Height</span>
                  <div className="unit-input">
                    <input
                      value={labelHeightInput}
                      inputMode="decimal"
                      aria-label={`Label height in ${state.unitSystem === 'imperial' ? 'inches' : 'millimeters'}`}
                      onChange={(event) => setLabelHeightInput(event.target.value)}
                      onBlur={() => commitLabelDimensionInput('heightMm', labelHeightInput)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitLabelDimensionInput('heightMm', labelHeightInput);
                        if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          stepLabelDimensionInput('heightMm', 1);
                        }
                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          stepLabelDimensionInput('heightMm', -1);
                        }
                      }}
                    />
                    <span>{labelDimensionUnit(state.unitSystem)}</span>
                  </div>
                </label>
                <label>
                  <span>Margin</span>
                  <div className="unit-input">
                    <input
                      value={labelMarginInput}
                      inputMode="decimal"
                      aria-label={`Label margin in ${state.unitSystem === 'imperial' ? 'inches' : 'millimeters'}`}
                      onChange={(event) => setLabelMarginInput(event.target.value)}
                      onBlur={() => commitLabelDimensionInput('marginMm', labelMarginInput)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitLabelDimensionInput('marginMm', labelMarginInput);
                        if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          stepLabelDimensionInput('marginMm', 1);
                        }
                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          stepLabelDimensionInput('marginMm', -1);
                        }
                      }}
                    />
                    <span>{labelDimensionUnit(state.unitSystem)}</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="fields-header">
              <h3>Label elements</h3>
              <button type="button" onClick={addField}>
                <Plus size={16} /> Element
              </button>
            </div>
            <datalist id="placeholder-autocomplete">
              {placeholderOptions.map((placeholder) => (
                <option key={placeholder} value={placeholder} />
              ))}
            </datalist>
            <div className="element-accordion">
              {state.labelSettings.fields.map((field, index) => {
                const isOpen = selectedFieldId === field.id;
                const fieldFrameStyle = field.kind === 'frame' ? { ...defaultFrameStyle, ...field.frameStyle } : defaultFrameStyle;

                return (
                  <article key={field.id} className={isOpen ? 'element-accordion-item open' : 'element-accordion-item'}>
                    <button
                      type="button"
                      className="element-accordion-trigger"
                      aria-expanded={isOpen}
                      aria-controls={`element-panel-${field.id}`}
                      onPointerEnter={() => setHoveredFieldId(field.id)}
                      onPointerLeave={() => setHoveredFieldId((current) => (current === field.id ? null : current))}
                      onClick={() => setSelectedFieldId((current) => (current === field.id ? null : field.id))}
                    >
                      <span className="element-index">{index + 1}</span>
                      <span>
                        <strong>{field.kind === 'text' ? 'Text' : field.kind === 'image' ? 'Image' : 'Frame'}</strong>
                        <small>{getElementSummary(field)}</small>
                      </span>
                    </button>
                    {isOpen && (
                      <section id={`element-panel-${field.id}`} className="field-settings">
                        <div className="field-settings-header">
                          <h3>Element settings</h3>
                          <button type="button" className="icon-button small" title="Delete selected element" onClick={() => removeField(field.id)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="field-card-row">
                          <select value={field.kind} onChange={(event) => updateElementKind(field, event.target.value as LabelElementKind)}>
                            {elementKinds.map((kind) => (
                              <option key={kind} value={kind}>
                                {kind === 'text' ? 'Text' : kind === 'image' ? 'Image' : 'Frame'}
                              </option>
                            ))}
                          </select>
                        </div>
                        {field.kind === 'text' && (
                          <label className="template-control">
                            Text
                            <input
                              list="placeholder-autocomplete"
                              value={field.text ?? ''}
                              onChange={(event) => updateField(field.id, { text: event.target.value })}
                              placeholder="{standardDin} {standardIso} {size} x {length} {lengthUnit}"
                            />
                            <span className="placeholder-chips">
                              {placeholderOptions.map((placeholder) => (
                                <button key={placeholder} type="button" className="placeholder-chip" onClick={() => appendPlaceholder(field, placeholder)}>
                                  {placeholder}
                                </button>
                              ))}
                            </span>
                          </label>
                        )}
                        {field.kind === 'image' && (
                          <div className="image-controls">
                            <label className="template-control">
                              Image
                              <select value={field.imageSource ?? 'qr'} onChange={(event) => updateField(field.id, { imageSource: event.target.value as PlacedField['imageSource'] })}>
                                <option value="qr">Purchase link QR</option>
                                <option value="side">Side</option>
                                <option value="top">Top</option>
                                <option value="custom">Custom image</option>
                              </select>
                            </label>
                            {field.imageSource === 'custom' && (
                              <div className="image-upload-row">
                                <label className="file-upload-button">
                                  <FileImage size={16} />
                                  <span>{field.imageName || 'Choose image'}</span>
                                  <input
                                    type="file"
                                    accept=".bmp,.png,.svg,image/bmp,image/x-ms-bmp,image/png,image/svg+xml"
                                    onChange={(event) => {
                                      void updateCustomImage(field.id, event.target.files?.[0]);
                                      event.currentTarget.value = '';
                                    }}
                                  />
                                </label>
                                {field.imageBase64 && (
                                  <button
                                    type="button"
                                    className="icon-button small secondary"
                                    title="Remove custom image"
                                    onClick={() => updateField(field.id, { imageBase64: undefined, imageMimeType: undefined, imageName: undefined })}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            )}
                            {(field.imageSource === 'side' || field.imageSource === 'top') && !standardImageUrlForItem(selectedItem, field.imageSource) && (
                              <p className="storage-note">No standard image URL is available for this hardware item.</p>
                            )}
                          </div>
                        )}
                        {field.kind === 'frame' && (
                          <div className="frame-controls">
                            <label>
                              Frame style
                              <select
                                value={fieldFrameStyle.shape}
                                onChange={(event) => updateFrameStyle(field.id, { shape: event.target.value as FrameShape })}
                              >
                                <option value="box">Box</option>
                                <option value="rounded">Rounded</option>
                              </select>
                            </label>
                            <label>
                              Thickness
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                value={fieldFrameStyle.strokeWidth}
                                onChange={(event) => updateFrameStyle(field.id, { strokeWidth: Number(event.target.value) || defaultFrameStyle.strokeWidth })}
                              />
                            </label>
                            {fieldFrameStyle.shape === 'rounded' && (
                              <label>
                                Border radius
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={fieldFrameStyle.radius}
                                  onChange={(event) => updateFrameStyle(field.id, { radius: Number(event.target.value) || 0 })}
                                />
                              </label>
                            )}
                            <label>
                              Line style
                              <select
                                value={fieldFrameStyle.lineStyle}
                                onChange={(event) => updateFrameStyle(field.id, { lineStyle: event.target.value as FrameLineStyle })}
                              >
                                <option value="solid">Solid</option>
                                <option value="dashed">Dashed</option>
                                <option value="dotted">Dotted</option>
                              </select>
                            </label>
                          </div>
                        )}
                        <div className="field-controls">
                          {field.kind !== 'frame' &&
                            (['width', 'height'] as const).map((key) => (
                              <label key={key}>
                                {key}
                                <input type="number" step="0.5" value={field[key]} onChange={(event) => updateField(field.id, { [key]: Number(event.target.value) })} />
                              </label>
                            ))}
                          {field.kind === 'text' && (
                            <>
                              <label>
                                Font
                                <span className="font-select-row">
                                  <select value={field.style.fontFamily} onChange={(event) => updateFieldStyle(field.id, { fontFamily: event.target.value })}>
                                    {availableFontFamilies.map((font) => (
                                      <option key={font} value={font}>
                                        {font.split(',')[0]}
                                      </option>
                                    ))}
                                  </select>
                                  <button type="button" className="secondary compact-button" onClick={() => void loadSystemFonts()}>
                                    System
                                  </button>
                                </span>
                              </label>
                              <label>
                                Size
                                <input
                                  type="number"
                                  step="0.5"
                                  min="2"
                                  value={field.style.fontSize}
                                  onChange={(event) => updateFieldStyle(field.id, { fontSize: Number(event.target.value) })}
                                />
                              </label>
                              <label>
                                Weight
                                <select
                                  value={field.style.fontWeight}
                                  onChange={(event) => updateFieldStyle(field.id, { fontWeight: Number(event.target.value) as PlacedField['style']['fontWeight'] })}
                                >
                                  {[400, 500, 600, 700, 800].map((weight) => (
                                    <option key={weight} value={weight}>
                                      {weight}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </>
                          )}
                        </div>
                      </section>
                    )}
                  </article>
                );
              })}
            </div>
            {state.labelSettings.fields.length === 0 && <p className="empty-elements">No label elements. Add an element to start designing this label.</p>}
          </section>
        </section>

        <aside className="panel preview-panel">
          <div className="panel-title preview-title">
            <div className="panel-title-main">
              <QrCode size={18} />
              <h2>Preview and export</h2>
            </div>
          </div>
          <div
            className="preview-stage"
            ref={previewStageRef}
            onPointerDown={handlePreviewPointerDown}
            onPointerMove={handlePreviewPointerMove}
            onPointerLeave={() => {
              if (!dragRef.current && !elementResizeRef.current) {
                setHoveredFieldId(null);
              }
            }}
            onPointerCancel={endPreviewDrag}
            onPointerUp={endPreviewDrag}
          >
            <div
              className={[
                'label-preview-shell',
                isResizingLabel ? 'resizing' : '',
                isResizingElement ? 'resizing-element' : ''
              ].filter(Boolean).join(' ')}
              style={{
                width: `${previewBaseWidth * previewScale}px`,
                height: `${previewBaseHeight * previewScale}px`
              }}
            >
              <div className="label-preview" dangerouslySetInnerHTML={{ __html: previewSvg }} />
              {selectedField && selectedField.kind !== 'frame' && (
                <div
                  className="element-resize-box"
                  style={{
                    left: `${(selectedField.x / state.labelSettings.widthMm) * 100}%`,
                    top: `${(selectedField.y / state.labelSettings.heightMm) * 100}%`,
                    width: `${(selectedField.width / state.labelSettings.widthMm) * 100}%`,
                    height: `${(selectedField.height / state.labelSettings.heightMm) * 100}%`
                  }}
                >
                  {[
                    { mode: 'width' as const, className: 'element-resize-handle width', label: 'Resize selected element width' },
                    { mode: 'height' as const, className: 'element-resize-handle height', label: 'Resize selected element height' },
                    { mode: 'both' as const, className: 'element-resize-handle both', label: 'Resize selected element width and height' }
                  ].map((handle) => (
                    <button
                      key={handle.mode}
                      type="button"
                      className={handle.className}
                      aria-label={handle.label}
                      title={handle.label}
                      onPointerDown={(event) => handleElementResizePointerDown(event, selectedField, handle.mode)}
                    />
                  ))}
                </div>
              )}
              {[
                { mode: 'width' as const, className: 'label-resize-handle width', label: 'Resize label width' },
                { mode: 'height' as const, className: 'label-resize-handle height', label: 'Resize label height' },
                { mode: 'both' as const, className: 'label-resize-handle both', label: 'Resize label width and height' }
              ].map((handle) => (
                <button
                  key={handle.mode}
                  type="button"
                  className={handle.className}
                  aria-label={handle.label}
                  title={handle.label}
                  onPointerDown={(event) => handleLabelResizePointerDown(event, handle.mode)}
                />
              ))}
            </div>
          </div>
          {qrInfo?.warning && <p className="warning">{qrInfo.warning}</p>}
          <p className="storage-note">Saved locally under {storageMeta.storageKey}.</p>

          <div className="button-grid">
            <button type="button" onClick={() => exportSingle(selectedItem, state.labelSettings, selectedPurchaseLink, selectedSpecUnitSystem, 'svg')}>
              <FileText size={16} /> SVG
            </button>
            <button type="button" onClick={() => exportSingle(selectedItem, state.labelSettings, selectedPurchaseLink, selectedSpecUnitSystem, 'png')}>
              <FileImage size={16} /> PNG
            </button>
            <button type="button" onClick={() => exportSingle(selectedItem, state.labelSettings, selectedPurchaseLink, selectedSpecUnitSystem, 'lbx')}>
              <Download size={16} /> LBX
            </button>
          </div>
        </aside>
      </section>

      {presetCodeModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPresetCodeModalOpen(false)}>
          <section
            className="modal-panel preset-code-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preset-code-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="panel-title-main">
                <Code2 size={18} />
                <h2 id="preset-code-modal-title">Preset code</h2>
              </div>
              <button type="button" className="icon-button small" title="Close preset code" onClick={() => setPresetCodeModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <textarea className="code-export-textarea" readOnly value={presetCode} aria-label="Built-in preset TypeScript code" />
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setPresetCodeModalOpen(false)}>
                Close
              </button>
              <button type="button" onClick={() => void copyPresetCode()}>
                <Copy size={16} /> Copy
              </button>
            </div>
          </section>
        </div>
      )}

      {presetModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPresetModalOpen(false)}>
          <section
            className="modal-panel preset-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preset-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="panel-title-main">
                <Save size={18} />
                <h2 id="preset-modal-title">Save preset</h2>
              </div>
              <button type="button" className="icon-button small" title="Close save preset" onClick={() => setPresetModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveCustomPreset();
              }}
            >
              <label>
                Preset name
                <input value={presetName} onChange={(event) => setPresetName(event.target.value)} autoFocus />
              </label>
              <fieldset className="category-checks">
                <legend>Categories</legend>
                {categories.map((category) => (
                  <label key={category}>
                    <input
                      type="checkbox"
                      checked={presetCategories.includes(category)}
                      onChange={(event) =>
                        setPresetCategories((current) =>
                          event.target.checked ? uniqueValues([...current, category]) as HardwareCategory[] : current.filter((entry) => entry !== category)
                        )
                      }
                    />
                    {category}
                  </label>
                ))}
              </fieldset>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setPresetModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={!presetName.trim()}>
                  <Save size={16} /> Save preset
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {batchModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setBatchModalOpen(false)}>
          <section
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="panel-title-main">
                <Archive size={18} />
                <h2 id="batch-modal-title">Batch generation</h2>
              </div>
              <button type="button" className="icon-button small" title="Close batch generation" onClick={() => setBatchModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="batch-grid">
              <label>
                Catalog
                <CatalogPartPicker
                  entries={filteredCatalog}
                  selectedId={batchCatalogEntry.id}
                  selectedStandards={state.selectedStandards}
                  onSelect={updateBatchCatalog}
                />
              </label>
              {batchSpecDefinitions.map((definition) => {
                const readonlyDimension = isBatchReadonlyWasherDimension(definition.key);
                return (
                  <label key={definition.key}>
                    {definition.label}
                    <textarea
                      value={readonlyDimension ? batchWasherDimensionValue(definition.key) : state.batchSpecs[definition.key] ?? ''}
                      readOnly={readonlyDimension}
                      onChange={(event) => updateBatchSpec(definition.key, event.target.value)}
                    />
                  </label>
                );
              })}
            </div>
            <p className="storage-note">
              {batchCombinationSpecDefinitions
                .map((definition) => `${parseList(state.batchSpecs[definition.key] ?? '').length || 1} ${definition.label.toLowerCase()}`)
                .join(' × ')}{' '}
              ={' '}
              {batchCombinationSpecDefinitions.reduce(
                (total, definition) => total * Math.max(1, parseList(state.batchSpecs[definition.key] ?? '').length),
                1
              )}{' '}
              labels
            </p>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setBatchModalOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={createBatch}>
                <Plus size={16} /> Generate combinations
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="print-sheet" aria-hidden="true">
        {printSvgs.map((svg, index) => (
          <div key={index} className="print-label" dangerouslySetInnerHTML={{ __html: svg }} />
        ))}
      </section>
      {successToast && (
        <div className="success-toast" role="status" aria-live="polite">
          {successToast}
        </div>
      )}
    </main>
  );
}
