import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  Archive,
  ChevronDown,
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
import { downloadBlob, effectivePurchaseLinks, exportSingle, exportZip, purchaseLinkScopeKey, type ExportFormat } from './lib/export';
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
  getCatalogSpecOptions,
  getCategorySpecDefinitions,
  getItemSpecValue,
  normalizeLengthSpec,
  patchItemSpec,
  syncHardwareSpecs
} from './lib/specs';
import { catalogMatchesSelectedStandards, combinedStandardCode, standardFamilies, standardPlaceholderKeys } from './lib/standards';
import { loadState, parseBackup, saveState, serializeBackup, storageMeta } from './lib/storage';
import { renderLabelSvg } from './lib/svg';
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
  PurchaseLink,
  StandardCatalogEntry
} from './types';

const categories: HardwareCategory[] = ['screw', 'bolt', 'nut', 'washer', 'rivet', 'pin', 'anchor', 'insert', 'clip', 'custom'];
const elementKinds: LabelElementKind[] = ['text', 'image', 'frame'];
const fontFamilies = ['Inter, Arial, sans-serif', 'Arial, sans-serif', 'Roboto Mono, monospace', 'Georgia, serif', 'Helvetica, sans-serif'];
const mmToPx = 3.7795275591;
const mmPerInch = 25.4;
const minLabelWidthMm = 10;
const minLabelHeightMm = 6;
const maxLabelWidthMm = 200;
const maxLabelHeightMm = 120;
const minElementWidthMm = 3;
const minElementHeightMm = 3;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isBuiltInPresetId = (value: string) => value in builtInLabelPresets;
const modifiedPresetValue = '__modified-preset';
type LabelResizeMode = 'width' | 'height' | 'both';
type ElementResizeMode = LabelResizeMode;
type LabelDimensionKey = 'widthMm' | 'heightMm' | 'marginMm';

const uniqueValues = (values: string[]) => Array.from(new Set(values)).filter(Boolean);
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
    return field.imageSource === 'qr' ? 'Purchase links QR' : 'Image';
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

export function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [selectedId, setSelectedId] = useState(state.hardwareItems[0]?.id ?? '');
  const [previewSvg, setPreviewSvg] = useState('');
  const [previewScale, setPreviewScale] = useState(1);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [zipFormats, setZipFormats] = useState<ExportFormat[]>(['svg', 'png', 'lbx']);
  const [printSvgs, setPrintSvgs] = useState<string[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [linksCollapsed, setLinksCollapsed] = useState(true);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
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

  const selectedLinks = selectedItem ? effectivePurchaseLinks(state.purchaseLinks, selectedItem) : [];
  const selectedLinksUseOverride = selectedItem ? Boolean(state.purchaseLinks.overrideByItem[selectedItem.id]) : false;
  const selectedCatalogEntry = getCatalogEntryForItem(selectedItem);
  const selectedSpecUnitSystem = selectedCatalogEntry?.unitSystem ?? state.unitSystem;
  const filteredCatalog = standardsCatalog.filter((entry) => catalogMatchesSelectedStandards(entry, state.selectedStandards));
  const batchCatalogEntry = filteredCatalog.find((entry) => entry.id === state.batchCatalogId) ?? filteredCatalog[0] ?? standardsCatalog[0];
  const selectedCatalogLocked = Boolean(selectedCatalogEntry);
  const activeSpecDefinitions = getCategorySpecDefinitions(selectedItem?.category ?? 'custom');
  const batchSpecDefinitions = getCategorySpecDefinitions(batchCatalogEntry.category);
  const qrInfo = selectedItem ? buildQrPayload(selectedItem, selectedLinks) : undefined;
  const previewBaseWidth = state.labelSettings.widthMm * mmToPx;
  const previewBaseHeight = state.labelSettings.heightMm * mmToPx;
  const builtInPresetOptions = Object.values(builtInLabelPresets).filter((preset) => presetAppliesToCategory(preset, selectedItem.category));
  const customPresetOptions = state.customPresets.filter((preset) => presetAppliesToCategory(preset, selectedItem.category));
  const presetOptions = [...builtInPresetOptions, ...customPresetOptions];
  const activePreset = presetOptions.find((preset) => presetMatchesSettings(preset, state.labelSettings));
  const activeCustomPreset = activePreset ? state.customPresets.find((preset) => preset.id === activePreset.id) : undefined;
  const presetIsModified = !activePreset;
  const activePresetValue = activePreset?.id ?? modifiedPresetValue;
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
    if (!batchModalOpen && !presetModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setBatchModalOpen(false);
        setPresetModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [batchModalOpen, presetModalOpen]);

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

    renderLabelSvg(selectedItem, state.labelSettings, selectedLinks, selectedSpecUnitSystem, {
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
  }, [hoveredFieldId, selectedFieldId, selectedItem, selectedLinks, selectedSpecUnitSystem, state.labelSettings]);

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

    return {
      catalogId: entry.id,
      category: entry.category,
      standard: combinedStandardCode(entry.standards),
      standardCodes: entry.standards,
      unitSystem: entry.unitSystem,
      specs: {
        ...item.specs,
        ...specs,
        length: normalizedLength.length
      },
      size: specs.size ?? item.size,
      length: normalizedLength.length,
      lengthUnit: normalizedLength.lengthUnit,
      material: specs.material ?? item.material,
      threadPitch: specs.threadPitch ?? item.threadPitch,
      threadPitchUnit: specs.threadPitchUnit ?? item.threadPitchUnit
    };
  };

  const updateSelectedSpec = (key: HardwareSpecKey, value: string) => {
    if (!selectedItem) return;
    if (key === 'length') {
      const normalized = normalizeLengthSpec(value, selectedItem.lengthUnit);
      updateSelectedItem({
        ...patchItemSpec(selectedItem, key, normalized.length),
        lengthUnit: normalized.lengthUnit
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

  const updateLinks = (links: PurchaseLink[]) => {
    if (!selectedItem) return;
    setState((current) => ({
      ...current,
      purchaseLinks: {
        ...current.purchaseLinks,
        ...(current.purchaseLinks.overrideByItem[selectedItem.id]
          ? {
              overrides: {
                ...current.purchaseLinks.overrides,
                [selectedItem.id]: links
              }
            }
          : {
              shared: {
                ...current.purchaseLinks.shared,
                [purchaseLinkScopeKey(selectedItem)]: links
              }
            })
      }
    }));
  };

  const toggleLinkOverride = (checked: boolean) => {
    if (!selectedItem) return;

    if (!checked) {
      const confirmed = window.confirm('Disable instance-specific links? Custom links for this hardware card will be lost and shared catalog links will be restored.');
      if (!confirmed) return;
    }

    setState((current) => {
      const nextOverrides = { ...current.purchaseLinks.overrides };
      const nextOverrideByItem = { ...current.purchaseLinks.overrideByItem };

      if (checked) {
        nextOverrideByItem[selectedItem.id] = true;
        nextOverrides[selectedItem.id] = [...effectivePurchaseLinks(current.purchaseLinks, selectedItem)];
      } else {
        delete nextOverrideByItem[selectedItem.id];
        delete nextOverrides[selectedItem.id];
      }

      return {
        ...current,
        purchaseLinks: {
          ...current.purchaseLinks,
          overrides: nextOverrides,
          overrideByItem: nextOverrideByItem
        }
      };
    });
  };

  const applyCatalogEntry = (entryId: string) => {
    if (!entryId) {
      updateSelectedItem({ catalogId: undefined, unitSystem: state.unitSystem });
      return;
    }

    const entry = standardsCatalog.find((candidate) => candidate.id === entryId);
    if (!entry || !selectedItem) return;

    const batchSpecs = Object.fromEntries(
      categorySpecKeys[entry.category].map((key) => [key, getCatalogSpecOptions(entry, entry.category, key, entry.unitSystem).join(', ')])
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
      purchaseLinks: {
        ...current.purchaseLinks,
        shared: Object.fromEntries(Object.entries(current.purchaseLinks.shared).filter(([key]) => key !== itemId)),
        overrides: Object.fromEntries(Object.entries(current.purchaseLinks.overrides).filter(([key]) => key !== itemId)),
        overrideByItem: Object.fromEntries(Object.entries(current.purchaseLinks.overrideByItem).filter(([key]) => key !== itemId))
      }
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
      purchaseLinks: {
        shared: {},
        overrides: {},
        overrideByItem: {}
      }
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
          field.id === fieldId ? { ...field, style: { ...field.style, ...patch } } : field
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
        x: 0,
        y: 0,
        width: state.labelSettings.widthMm,
        height: state.labelSettings.heightMm,
        frameStyle: { ...defaultFrameStyle, ...field.frameStyle }
      });
      return;
    }

    if (kind === 'image') {
      updateField(field.id, { kind, imageSource: field.imageSource ?? 'qr' });
      return;
    }

    updateField(field.id, { kind, text: field.text ?? '{standardDin} {standardIso}' });
  };

  const appendPlaceholder = (field: PlacedField, placeholder: string) => {
    const currentText = field.text ?? '';
    updateField(field.id, { text: `${currentText}${currentText && !currentText.endsWith(' ') ? ' ' : ''}${placeholder}` });
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
      categorySpecKeys[entry.category].map((key) => [key, getCatalogSpecOptions(entry, entry.category, key, entry.unitSystem).join(', ')])
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
        return renderLabelSvg(item, state.labelSettings, effectivePurchaseLinks(state.purchaseLinks, item), catalogEntry?.unitSystem ?? item.unitSystem);
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

      setState(importedState);
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
                <select value={selectedItem.catalogId ?? ''} onChange={(event) => applyCatalogEntry(event.target.value)}>
                  <option value="">Custom item</option>
                  {filteredCatalog.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {combinedStandardCode(entry.standards, state.selectedStandards)} · {entry.description}
                    </option>
                  ))}
                </select>
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

                const options = getCatalogSpecOptions(selectedCatalogEntry, selectedItem.category, definition.key, selectedSpecUnitSystem);
                const datalistId = `spec-options-${definition.key}`;
                const lengthUnitOptions =
                  definition.key === 'length'
                    ? uniqueValues([
                        selectedItem.lengthUnit,
                        ...options.map((value) => splitLengthAndUnit(value, selectedItem.lengthUnit).lengthUnit)
                      ])
                    : [];

                return (
                  <label key={definition.key}>
                    {definition.label}
                    {definition.isLength ? (
                      <>
                        <div className="length-row">
                          <input
                            list={datalistId}
                            value={selectedItem.length}
                            onChange={(event) => updateSelectedSpec(definition.key, event.target.value)}
                          />
                          <input
                            list="length-unit-options"
                            value={selectedItem.lengthUnit}
                            aria-label="Length unit"
                            onChange={(event) => updateSelectedItem({ lengthUnit: event.target.value })}
                          />
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
                    ) : definition.key === 'threadPitch' ? (
                      <>
                        <div className="length-row">
                          <input
                            list={datalistId}
                            value={selectedItem.threadPitch}
                            onChange={(event) => updateSelectedSpec('threadPitch', event.target.value)}
                          />
                          <input
                            list="thread-pitch-unit-options"
                            value={selectedItem.threadPitchUnit}
                            aria-label="Thread pitch unit"
                            onChange={(event) => updateSelectedSpec('threadPitchUnit', event.target.value)}
                          />
                        </div>
                        <datalist id={datalistId}>
                          {options.map((value) => (
                            <option key={value} value={value} />
                          ))}
                        </datalist>
                        <datalist id="thread-pitch-unit-options">
                          {getCatalogSpecOptions(selectedCatalogEntry, selectedItem.category, 'threadPitchUnit', selectedSpecUnitSystem).map((value) => (
                            <option key={value} value={value} />
                          ))}
                        </datalist>
                      </>
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

            <section className="links-section">
              <button
                type="button"
                className="links-disclosure"
                aria-expanded={!linksCollapsed}
                onClick={() => setLinksCollapsed((current) => !current)}
              >
                <span className="panel-title-main">
                  <QrCode size={18} />
                  <span>Purchase links</span>
                </span>
                <ChevronDown size={16} className={linksCollapsed ? '' : 'open'} />
              </button>
              {!linksCollapsed && (
                <div className="links-panel">
                  <label className="link-override-toggle">
                    <input type="checkbox" checked={selectedLinksUseOverride} onChange={(event) => toggleLinkOverride(event.target.checked)} />
                    Override links for this hardware card
                  </label>
                  <div className="links-list">
                    {selectedLinks.map((link) => (
                      <article key={link.id} className="link-card">
                        <input
                          value={link.name}
                          placeholder="Name"
                          onChange={(event) => updateLinks(selectedLinks.map((entry) => (entry.id === link.id ? { ...entry, name: event.target.value } : entry)))}
                        />
                        <input
                          value={link.url}
                          placeholder="https://..."
                          onChange={(event) => updateLinks(selectedLinks.map((entry) => (entry.id === link.id ? { ...entry, url: event.target.value } : entry)))}
                        />
                        <button type="button" className="icon-button small" title="Remove link" onClick={() => updateLinks(selectedLinks.filter((entry) => entry.id !== link.id))}>
                          <Trash2 size={15} />
                        </button>
                      </article>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateLinks([
                        ...selectedLinks,
                        {
                          id: createId('link'),
                          name: '',
                          url: ''
                        }
                      ])
                    }
                  >
                    <Plus size={16} /> Link
                  </button>
                </div>
              )}
            </section>
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
                          <label className="template-control">
                            Image
                            <select value={field.imageSource ?? 'qr'} onChange={(event) => updateField(field.id, { imageSource: event.target.value as PlacedField['imageSource'] })}>
                              <option value="qr">Purchase links QR</option>
                            </select>
                          </label>
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
                                <select value={field.style.fontFamily} onChange={(event) => updateFieldStyle(field.id, { fontFamily: event.target.value })}>
                                  {fontFamilies.map((font) => (
                                    <option key={font} value={font}>
                                      {font.split(',')[0]}
                                    </option>
                                  ))}
                                </select>
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
            <button type="button" onClick={() => exportSingle(selectedItem, state.labelSettings, selectedLinks, selectedSpecUnitSystem, 'svg')}>
              <FileText size={16} /> SVG
            </button>
            <button type="button" onClick={() => exportSingle(selectedItem, state.labelSettings, selectedLinks, selectedSpecUnitSystem, 'png')}>
              <FileImage size={16} /> PNG
            </button>
            <button type="button" onClick={() => exportSingle(selectedItem, state.labelSettings, selectedLinks, selectedSpecUnitSystem, 'lbx')}>
              <Download size={16} /> LBX
            </button>
          </div>
        </aside>
      </section>

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
                <select value={batchCatalogEntry.id} onChange={(event) => updateBatchCatalog(event.target.value)}>
                  {filteredCatalog.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {combinedStandardCode(entry.standards, state.selectedStandards)} · {entry.description}
                    </option>
                  ))}
                </select>
              </label>
              {batchSpecDefinitions.map((definition) => (
                <label key={definition.key}>
                  {definition.label}
                  <textarea
                    value={state.batchSpecs[definition.key] ?? ''}
                    onChange={(event) => updateBatchSpec(definition.key, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <p className="storage-note">
              {batchSpecDefinitions
                .map((definition) => `${parseList(state.batchSpecs[definition.key] ?? '').length || 1} ${definition.label.toLowerCase()}`)
                .join(' × ')}{' '}
              ={' '}
              {batchSpecDefinitions.reduce(
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
