import { useEffect, useMemo, useState } from 'react';
import { Code2, FileImage, FileText, Plus, Save, Trash2 } from 'lucide-react';
import { useAppState } from '../app/AppStateContext';
import { PresetCodeModal } from './modals/PresetCodeModal';
import { SavePresetModal } from './modals/SavePresetModal';
import { useLabelFields } from './label/useLabelFields';
import {
  constrainLabelSettings,
  formatLabelDimensionInput,
  isBuiltInPresetId,
  labelDimensionStepMm,
  labelDimensionUnit,
  maxLabelHeightMm,
  maxLabelWidthMm,
  maxMarginForSettings,
  minLabelHeightMm,
  minLabelWidthMm,
  modifiedPresetValue,
  parseLabelDimensionInput,
  presetAppliesToCategory,
  presetMatchesSettings,
  presetToLabelSettings,
  uniqueValues,
  clamp,
  type LabelDimensionKey
} from '../lib/labelLayout';
import { clonePlacedFields, createId, defaultFrameStyle } from '../lib/defaults';
import { formatLabelSize, placeholderLabels } from '../lib/format';
import { builtInLabelPresets } from '../lib/presets';
import { getCategorySpecDefinitions } from '../lib/specs';
import { useI18n } from '../lib/i18n';
import { standardFamilies, standardPlaceholderKeys } from '../lib/standards';
import { isStandardImageSource, standardImageLabel, standardImageUrlForItem } from '../lib/standardImages';
import { defaultTechnicalDrawingStrokeWidth } from '../lib/svgAssets';
import type {
  AppState,
  FrameLineStyle,
  FrameShape,
  HardwareItem,
  LabelElementKind,
  LabelPreset,
  PlacedField
} from '../types';

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
const tsIdentifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

type LocalFontAccessWindow = Window & {
  queryLocalFonts?: () => Promise<Array<{ family: string }>>;
};

const formatTsString = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
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

const getElementSummary = (field: PlacedField, fallbackText: string, fallbackImage: string) => {
  if (field.kind === 'text') {
    return field.text?.trim() || fallbackText;
  }

  if (field.kind === 'image') {
    return field.imageSource === 'custom' ? field.imageName || fallbackImage : standardImageLabel(field.imageSource);
  }

  const frameShape = field.frameStyle?.shape === 'rounded' ? 'Rounded' : 'Box';
  return `${frameShape} frame`;
};

export function LabelDesignPanel() {
  const { selectedFieldId, selectedId, setHoveredFieldId, setSelectedFieldId, setState, showSuccessToast, state } = useAppState();
  const { elementKindLabel, t } = useI18n();
  const selectedItem = state.hardwareItems.find((item) => item.id === selectedId) ?? state.hardwareItems[0];
  const [systemFontFamilies, setSystemFontFamilies] = useState<string[]>([]);
  const [presetName, setPresetName] = useState('');
  const [presetCategories, setPresetCategories] = useState<HardwareItem['category'][]>([]);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetCodeModalOpen, setPresetCodeModalOpen] = useState(false);
  const labelSettings = selectedItem.labelSettings;
  const [labelWidthInput, setLabelWidthInput] = useState(() => formatLabelDimensionInput(labelSettings.widthMm, state.unitSystem));
  const [labelHeightInput, setLabelHeightInput] = useState(() => formatLabelDimensionInput(labelSettings.heightMm, state.unitSystem));
  const [labelMarginInput, setLabelMarginInput] = useState(() => formatLabelDimensionInput(labelSettings.marginMm, state.unitSystem));
  const {
    addField,
    appendPlaceholder,
    removeField,
    updateCustomImage,
    updateElementKind,
    updateField,
    updateFieldStyle,
    updateFrameStyle
  } = useLabelFields();

  const unitSystem = state.unitSystem;
  const activeSpecDefinitions = getCategorySpecDefinitions(selectedItem?.category ?? 'custom');
  const builtInPresetOptions = Object.values(builtInLabelPresets).filter((preset) => presetAppliesToCategory(preset, selectedItem.category));
  const customPresetOptions = state.customPresets.filter((preset) => presetAppliesToCategory(preset, selectedItem.category));
  const presetOptions = [...builtInPresetOptions, ...customPresetOptions];
  const activePreset = presetOptions.find((preset) => presetMatchesSettings(preset, labelSettings));
  const activeCustomPreset = activePreset ? state.customPresets.find((preset) => preset.id === activePreset.id) : undefined;
  const presetIsModified = !activePreset;
  const activePresetValue = activePreset?.id ?? modifiedPresetValue;
  const availableFontFamilies = useMemo(() => uniqueValues([...fontFamilies, ...systemFontFamilies]), [systemFontFamilies]);
  const presetCode = useMemo(() => {
    const name = activePreset?.name ?? `Preset ${formatLabelSize(labelSettings.widthMm, labelSettings.heightMm, state.unitSystem)}`;
    const id = activePreset?.id ?? slugifyPresetId(`${selectedItem.category}-${name}`);
    const preset: LabelPreset = {
      id,
      name,
      categories: activePreset?.categories.length ? activePreset.categories : [selectedItem.category],
      widthMm: labelSettings.widthMm,
      heightMm: labelSettings.heightMm,
      tapeWidthMm: labelSettings.tapeWidthMm,
      marginMm: labelSettings.marginMm,
      fields: clonePlacedFields(labelSettings.fields)
    };

    return `${formatTsKey(id)}: ${formatTsValue(preset)},`;
  }, [activePreset, labelSettings, selectedItem.category, state.unitSystem]);
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

  useEffect(() => {
    setLabelWidthInput(formatLabelDimensionInput(labelSettings.widthMm, state.unitSystem));
    setLabelHeightInput(formatLabelDimensionInput(labelSettings.heightMm, state.unitSystem));
    setLabelMarginInput(formatLabelDimensionInput(labelSettings.marginMm, state.unitSystem));
  }, [labelSettings.widthMm, labelSettings.heightMm, labelSettings.marginMm, state.unitSystem]);

  useEffect(() => {
    if (!selectedFieldId || presetModalOpen || presetCodeModalOpen) return;

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
  }, [presetCodeModalOpen, presetModalOpen, removeField, selectedFieldId]);

  const copyPresetCode = async () => {
    try {
      await navigator.clipboard.writeText(presetCode);
      showSuccessToast(t('presetCopied'));
    } catch {
      showSuccessToast(t('presetReady'));
    }
  };

  const loadSystemFonts = async () => {
    const queryLocalFonts = (window as LocalFontAccessWindow).queryLocalFonts;
    if (!queryLocalFonts) {
      window.alert(t('systemFontUnsupported'));
      return;
    }

    try {
      const fonts = await queryLocalFonts();
      const families = uniqueValues(fonts.map((font) => font.family).sort((a, b) => a.localeCompare(b)));
      setSystemFontFamilies(families);
      showSuccessToast(t('systemFontsLoaded', { count: families.length }));
    } catch {
      window.alert(t('systemFontDenied'));
    }
  };

  const updateSelectedLabelSettings = (updater: (settings: typeof labelSettings) => typeof labelSettings) => {
    setState((current) => ({
      ...current,
      hardwareItems: current.hardwareItems.map((item) =>
        item.id === selectedId ? { ...item, labelSettings: constrainLabelSettings(updater(item.labelSettings)) } : item
      )
    }));
  };

  const applyPreset = (presetId: string) => {
    if (presetId === modifiedPresetValue) {
      return;
    }

    const builtInPreset = isBuiltInPresetId(presetId) ? builtInLabelPresets[presetId] : undefined;
    const customPreset = state.customPresets.find((preset) => preset.id === presetId);
    const preset = builtInPreset ?? customPreset;

    if (!preset) return;

    updateSelectedLabelSettings(() => presetToLabelSettings(preset, Boolean(builtInPreset)));
    setSelectedFieldId(null);
  };

  const openPresetSaveModal = () => {
    setPresetName(`Preset ${formatLabelSize(labelSettings.widthMm, labelSettings.heightMm, state.unitSystem)}`);
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
      widthMm: labelSettings.widthMm,
      heightMm: labelSettings.heightMm,
      tapeWidthMm: labelSettings.tapeWidthMm,
      marginMm: labelSettings.marginMm,
      fields: clonePlacedFields(labelSettings.fields)
    };

    setState((current) => ({
      ...current,
      customPresets: [...current.customPresets, preset],
      hardwareItems: current.hardwareItems.map((item) =>
        item.id === selectedId ? { ...item, labelSettings: { ...item.labelSettings, layout: 'custom' } } : item
      )
    }));
    setPresetModalOpen(false);
    showSuccessToast(t('presetSaved'));
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
      if (dimension === 'widthMm') setLabelWidthInput(formatLabelDimensionInput(labelSettings.widthMm, state.unitSystem));
      else if (dimension === 'heightMm') setLabelHeightInput(formatLabelDimensionInput(labelSettings.heightMm, state.unitSystem));
      else setLabelMarginInput(formatLabelDimensionInput(labelSettings.marginMm, state.unitSystem));
      return;
    }

    const min = dimension === 'widthMm' ? minLabelWidthMm : dimension === 'heightMm' ? minLabelHeightMm : 0;
    const max = dimension === 'widthMm' ? maxLabelWidthMm : dimension === 'heightMm' ? maxLabelHeightMm : maxMarginForSettings(labelSettings);
    const nextValue = Number(clamp(numericValue, min, max).toFixed(2));

    updateSelectedLabelSettings((settings) => ({
        ...settings,
        layout: 'custom',
        [dimension]: nextValue
      }));
  };

  const stepLabelDimensionInput = (dimension: LabelDimensionKey, direction: 1 | -1) => {
    const currentValue =
      dimension === 'widthMm' ? labelSettings.widthMm : dimension === 'heightMm' ? labelSettings.heightMm : labelSettings.marginMm;
    const min = dimension === 'widthMm' ? minLabelWidthMm : dimension === 'heightMm' ? minLabelHeightMm : 0;
    const max = dimension === 'widthMm' ? maxLabelWidthMm : dimension === 'heightMm' ? maxLabelHeightMm : maxMarginForSettings(labelSettings);
    const nextValue = Number(clamp(currentValue + direction * labelDimensionStepMm(state.unitSystem), min, max).toFixed(2));

    updateSelectedLabelSettings((settings) => ({
        ...settings,
        layout: 'custom',
        [dimension]: nextValue
      }));
  };

  if (!selectedItem) {
    return null;
  }

  return (
    <>
    <section className="panel label-design-panel">
      <div className="panel-title">
        <FileText size={18} />
        <h2>{t('labelDesign')}</h2>
      </div>

      <div className="preset-actions design-actions" id="label-dimensions">
        <label className="preset-select">
          <span>{t('preset')}</span>
          <select value={activePresetValue} onChange={(event) => applyPreset(event.target.value)}>
            {presetIsModified && (
              <option value={modifiedPresetValue} disabled>
                {t('modifiedPreset')}
              </option>
            )}
            {builtInPresetOptions.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
            {customPresetOptions.length > 0 && <option disabled>{t('customPresets')}</option>}
            {customPresetOptions.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>
        {presetIsModified && (
          <button type="button" className="secondary preset-save" onClick={openPresetSaveModal}>
            <Save size={15} /> {t('save')}
          </button>
        )}
        <button type="button" className="secondary preset-save" onClick={() => setPresetCodeModalOpen(true)}>
          <Code2 size={15} /> {t('devExport')}
        </button>
        {activeCustomPreset && (
          <button type="button" className="icon-button small secondary" title={t('remove')} onClick={() => deleteCustomPreset(activeCustomPreset.id)}>
            <Trash2 size={15} />
          </button>
        )}
        <div className="label-size-inputs" aria-label={t('size')}>
          <label>
            <span>{t('width')}</span>
            <div className="unit-input">
              <input
                value={labelWidthInput}
                inputMode="decimal"
                aria-label={t('width')}
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
              <span>{labelDimensionUnit(unitSystem)}</span>
            </div>
          </label>
          <span className="size-separator">x</span>
          <label>
            <span>{t('height')}</span>
            <div className="unit-input">
              <input
                value={labelHeightInput}
                inputMode="decimal"
                aria-label={t('height')}
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
              <span>{labelDimensionUnit(unitSystem)}</span>
            </div>
          </label>
          <label>
            <span>{t('margin')}</span>
            <div className="unit-input">
              <input
                value={labelMarginInput}
                inputMode="decimal"
                aria-label={t('margin')}
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
              <span>{labelDimensionUnit(unitSystem)}</span>
            </div>
          </label>
        </div>
      </div>

      <div className="fields-header">
        <h3>{t('labelElements')}</h3>
        <button type="button" onClick={addField}>
          <Plus size={16} /> {t('element')}
        </button>
      </div>
      <datalist id="placeholder-autocomplete">
        {placeholderOptions.map((placeholder) => (
          <option key={placeholder} value={placeholder} />
        ))}
      </datalist>
      <div className="element-accordion">
        {labelSettings.fields.map((field, index) => {
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
                  <strong>{elementKindLabel(field.kind)}</strong>
                  <small>{getElementSummary(field, t('text'), t('customImage'))}</small>
                </span>
              </button>
              {isOpen && (
                <section id={`element-panel-${field.id}`} className="field-settings">
                  <div className="field-settings-header">
                    <h3>{t('elementSettings')}</h3>
                    <button type="button" className="icon-button small" title={t('deleteSelectedElement')} onClick={() => removeField(field.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="field-card-row">
                    <select value={field.kind} onChange={(event) => updateElementKind(field, event.target.value as LabelElementKind)}>
                      {elementKinds.map((kind) => (
                        <option key={kind} value={kind}>
                          {elementKindLabel(kind)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {field.kind === 'text' && (
                    <label className="template-control">
                      {t('text')}
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
                        {t('image')}
                        <select value={field.imageSource ?? 'qr'} onChange={(event) => updateField(field.id, { imageSource: event.target.value as PlacedField['imageSource'] })}>
                          <option value="qr">{t('purchaseLinkQr')}</option>
                          <option value="iso">ISO</option>
                          <option value="side">{t('side')}</option>
                          <option value="top">{t('top')}</option>
                          <option value="custom">{t('customImage')}</option>
                        </select>
                      </label>
                      {field.imageSource === 'custom' && (
                        <div className="image-upload-row">
                          <label className="file-upload-button">
                            <FileImage size={16} />
                            <span>{field.imageName || t('chooseImage')}</span>
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
                              title={t('removeCustomImage')}
                              onClick={() => updateField(field.id, { imageBase64: undefined, imageMimeType: undefined, imageName: undefined })}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      )}
                      {isStandardImageSource(field.imageSource) && !standardImageUrlForItem(selectedItem, field.imageSource) && (
                        <p className="storage-note">{t('noStandardImage')}</p>
                      )}
                    </div>
                  )}
                  {field.kind === 'frame' && (
                    <div className="frame-controls">
                      <label>
                        {t('frameStyle')}
                        <select
                          value={fieldFrameStyle.shape}
                          onChange={(event) => updateFrameStyle(field.id, { shape: event.target.value as FrameShape })}
                        >
                          <option value="box">{t('box')}</option>
                          <option value="rounded">{t('rounded')}</option>
                        </select>
                      </label>
                      <label>
                        {t('thickness')}
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
                          {t('borderRadius')}
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
                        {t('lineStyle')}
                        <select
                          value={fieldFrameStyle.lineStyle}
                          onChange={(event) => updateFrameStyle(field.id, { lineStyle: event.target.value as FrameLineStyle })}
                        >
                          <option value="solid">{t('solid')}</option>
                          <option value="dashed">{t('dashed')}</option>
                          <option value="dotted">{t('dotted')}</option>
                        </select>
                      </label>
                    </div>
                  )}
                  <div className="field-controls">
                    {field.kind !== 'frame' &&
                      (['width', 'height'] as const).map((key) => (
                        <label key={key}>
                          {key === 'width' ? t('width') : t('height')}
                          <input
                            type="number"
                            step="0.5"
                            value={field[key]}
                            onChange={(event) => updateField(field.id, { [key]: Number(event.target.value) } as Partial<PlacedField>)}
                          />
                        </label>
                      ))}
                    {field.kind === 'image' && (
                      <>
                        <label>
                          {t('rotation')}
                          <input
                            type="number"
                            step="1"
                            value={field.rotationDeg ?? 0}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              updateField(field.id, { rotationDeg: Number.isFinite(value) ? value : 0 });
                            }}
                          />
                        </label>
                        {isStandardImageSource(field.imageSource) && (
                          <label>
                            {t('lineThickness')}
                            <input
                              type="number"
                              step="0.05"
                              min="0.05"
                              value={field.svgStrokeWidth ?? defaultTechnicalDrawingStrokeWidth}
                              onChange={(event) => updateField(field.id, { svgStrokeWidth: Number(event.target.value) || defaultTechnicalDrawingStrokeWidth })}
                            />
                          </label>
                        )}
                      </>
                    )}
                    {field.kind === 'text' && (
                      <>
                        <label>
                          {t('font')}
                          <span className="font-select-row">
                            <select value={field.style.fontFamily} onChange={(event) => updateFieldStyle(field.id, { fontFamily: event.target.value })}>
                              {availableFontFamilies.map((font) => (
                                <option key={font} value={font}>
                                  {font.split(',')[0]}
                                </option>
                              ))}
                            </select>
                            <button type="button" className="secondary compact-button" onClick={() => void loadSystemFonts()}>
                              {t('system')}
                            </button>
                          </span>
                        </label>
                        <label>
                          {t('size')}
                          <input
                            type="number"
                            step="0.5"
                            min="2"
                            value={field.style.fontSize}
                            onChange={(event) => updateFieldStyle(field.id, { fontSize: Number(event.target.value) })}
                          />
                        </label>
                        <label>
                          {t('weight')}
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
      {labelSettings.fields.length === 0 && <p className="empty-elements">{t('emptyElements')}</p>}
    </section>
    {presetCodeModalOpen && (
      <PresetCodeModal
        presetCode={presetCode}
        onClose={() => setPresetCodeModalOpen(false)}
        onCopy={copyPresetCode}
      />
    )}
    {presetModalOpen && (
      <SavePresetModal
        presetCategories={presetCategories}
        presetName={presetName}
        onClose={() => setPresetModalOpen(false)}
        onSave={saveCustomPreset}
        onSetPresetCategories={setPresetCategories}
        onSetPresetName={setPresetName}
      />
    )}
    </>
  );
}
