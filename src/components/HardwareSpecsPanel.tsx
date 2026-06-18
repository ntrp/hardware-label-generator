import { ChevronDown, ChevronRight, FileText, QrCode } from 'lucide-react';
import { useEffect, useState } from 'react';
import { standardsCatalog } from '../data/catalog';
import { useAppState } from '../app/AppStateContext';
import { uniqueValues } from '../lib/labelLayout';
import { hardwareCategories } from './hardware/hardwareConstants';
import { baseMaterials, getFinishOptions, getMaterialTreatmentOptions } from '../lib/materials';
import { defaultFinish, defaultMaterialTreatment, isValidFinish, isValidMaterialTreatment } from '../lib/materials';
import { getBoltClassOptions } from '../lib/boltClasses';
import { defaultBoltClass, isValidBoltClass } from '../lib/boltClasses';
import { batchOptionLabel, batchPreviewLabel, batchSpecKeys, decodeBatchOptionValue, encodeBatchOptionValue, generateBatchItems } from '../lib/batch';
import { parseList, splitLengthAndUnit } from '../lib/format';
import { effectivePurchaseLink } from '../lib/export';
import { categoryLabelSettings } from '../lib/appState';
import {
  defaultImperialThreadPitch,
  findImperialThreadPitch,
  formatImperialThreadPitchOption,
  imperialThreadPitchNamesForSize,
  isUnifiedImperialThreadPitchList
} from '../lib/imperialThreads';
import { formatMetricThreadPitchOption, metricThreadPitchNamesForSize } from '../lib/metricThreads';
import { defaultMetricThreadPitch, findMetricThreadPitch } from '../lib/metricThreads';
import {
  getAllCatalogSpecOptions,
  getCatalogSpecOptions,
  getCatalogWasherDimensionValue,
  getCategorySpecDefinitions,
  getItemSpecValue,
  isWasherDimensionKey,
  normalizeLengthSpec,
  patchItemSpec,
  syncHardwareSpecs
} from '../lib/specs';
import { catalogMatchesSelectedFilters } from '../lib/standards';
import {
  catalogAssetLabel,
  catalogAssetSources,
  missingCatalogAssetDataUrl,
  standardImageReferenceForItem
} from '../lib/standardImages';
import { CatalogModelViewer } from './CatalogModelViewer';
import { CatalogPartPicker } from './CatalogPartPicker';
import {
  buildCatalogItemPatch,
  getCatalogEntryForItem,
  getHardwareSpecLine
} from './hardware/hardwareLogic';
import type { AppState, HardwareCategory, HardwareItem, HardwareSpecKey, StandardCatalogEntry } from '../types';

type StandardImageReference = NonNullable<ReturnType<typeof standardImageReferenceForItem>>;
type CatalogDrawingSource = Extract<(typeof catalogAssetSources)[number], 'iso' | 'side' | 'top'>;

const categoryLabel = (category: HardwareCategory) => category[0].toUpperCase() + category.slice(1);

const formattedPitchName = (item: HardwareItem, unitSystem: AppState['unitSystem']) => {
  if (unitSystem === 'metric') {
    return formatMetricThreadPitchOption(
      findMetricThreadPitch(item.size, item.threadPitchName) ??
      findMetricThreadPitch(item.size, item.threadPitch) ??
      { size: item.size, name: item.threadPitchName, value: item.threadPitch }
    );
  }

  const imperialPitch = findImperialThreadPitch(item.size, item.threadPitchName) ?? findImperialThreadPitch(item.size, item.threadPitch);
  if (imperialPitch) return formatImperialThreadPitchOption(imperialPitch);
  if (!['UNC', 'UNF'].includes(item.threadPitchName.toUpperCase())) return item.threadPitchName;
  return formatImperialThreadPitchOption({ size: item.size, series: item.threadPitchName === 'UNF' ? 'UNF' : 'UNC', tpi: item.threadPitch });
};

const catalogDrawingPreviewUrl = (reference: StandardImageReference, source: CatalogDrawingSource) => {
  if (source === 'iso') return reference.isoUrl;
  if (source === 'side') return reference.sideUrl;
  return reference.topUrl;
};

const selectedBatchValues = (item: HardwareItem, key: HardwareSpecKey) => parseList(item.batch.specs[key] ?? '');
const selectedBatchRawValues = (item: HardwareItem, key: HardwareSpecKey) =>
  selectedBatchValues(item, key).map((value) => decodeBatchOptionValue(value).value);

const batchOptionMatchesCurrentItem = (item: HardwareItem, encodedValue: string) => {
  const { dependencies } = decodeBatchOptionValue(encodedValue);
  if (dependencies.size && dependencies.size !== item.size) return false;
  if (dependencies.material && dependencies.material !== item.material) return false;
  if (dependencies.materialType && dependencies.materialType !== item.materialType) return false;
  return true;
};

export function HardwareSpecsPanel() {
  const { previewHardwareItem, selectedId, setPreviewHardwareItem, setSelectedFieldId, setState, state } = useAppState();
  const [batchCollapsed, setBatchCollapsed] = useState(false);
  const selectedItem = state.hardwareItems.find((item) => item.id === selectedId) ?? state.hardwareItems[0];
  const selectedCatalogEntry = getCatalogEntryForItem(selectedItem);
  const selectedStandardImageReference = selectedItem ? standardImageReferenceForItem(selectedItem) : undefined;
  const selectedSpecUnitSystem = selectedCatalogEntry?.unitSystem ?? state.unitSystem;
  const filteredCatalog = standardsCatalog.filter((entry) =>
    catalogMatchesSelectedFilters(entry, state.selectedStandards, state.selectedCategories)
  );
  const selectedCatalogLocked = Boolean(selectedCatalogEntry);
  const selectedUsesUnifiedImperialPitches =
    !selectedCatalogLocked || !selectedCatalogEntry || isUnifiedImperialThreadPitchList(selectedCatalogEntry.pitches.imperial);
  const activeSpecDefinitions = getCategorySpecDefinitions(selectedItem?.category ?? 'custom');
  const batchEnabled = Boolean(selectedItem?.batch.enabled);
  const batchDefinitions = selectedItem
    ? activeSpecDefinitions.filter((definition) => batchSpecKeys(selectedItem).includes(definition.key))
    : [];
  const batchPreviewItems = selectedItem && batchEnabled ? generateBatchItems(selectedItem) : [];
  const previewHardwareSpecLine = previewHardwareItem ? getHardwareSpecLine(previewHardwareItem) : '';
  const selectedPurchaseLink = selectedItem ? effectivePurchaseLink(state.purchaseLinks, selectedItem) : '';
  const hasQrElement = selectedItem.labelSettings.fields.some((field) => field.kind === 'image' && field.imageSource === 'qr' && field.style.visible);

  useEffect(() => {
    if (!selectedItem || !selectedCatalogEntry) return;

    const sizeOptions = getCatalogSpecOptions(selectedCatalogEntry, selectedItem.category, 'size', selectedSpecUnitSystem);
    if (sizeOptions.length === 0 || sizeOptions.includes(selectedItem.size)) return;

    setState((current) => ({
      ...current,
      hardwareItems: current.hardwareItems.map((item) =>
        item.id === selectedItem.id ? syncHardwareSpecs({ ...item, ...buildCatalogItemPatch(selectedCatalogEntry, item) }) : item
      )
    }));
  }, [selectedCatalogEntry, selectedItem, selectedSpecUnitSystem, setState]);

  const updateSelectedItem = (patch: Partial<HardwareItem>) => {
    if (!selectedItem) return;
    setPreviewHardwareItem(null);
    setState((current) => ({
      ...current,
      hardwareItems: current.hardwareItems.map((item) => (item.id === selectedItem.id ? syncHardwareSpecs({ ...item, ...patch }) : item))
    }));
  };

  const updateSelectedBatch = (patch: Partial<HardwareItem['batch']>) => {
    if (!selectedItem) return;
    updateSelectedItem({
      batch: {
        ...selectedItem.batch,
        ...patch
      }
    });
  };

  const selectedOrDefaultBatchValues = (item: HardwareItem, key: HardwareSpecKey, options: string[]) => {
    const selectedValues = selectedBatchValues(item, key).filter((value) => options.includes(value));
    const firstMatchingOption = (matches: (value: ReturnType<typeof decodeBatchOptionValue>) => boolean, preferredValue = getItemSpecValue(item, key)) =>
      options.find((option) => {
        const decoded = decodeBatchOptionValue(option);
        return matches(decoded) && decoded.value === preferredValue && batchOptionMatchesCurrentItem(item, option);
      }) ?? options.find((option) => matches(decodeBatchOptionValue(option)));

    if (key === 'threadPitchName') {
      return uniqueValues([
        ...selectedValues,
        ...batchContextValues('size').flatMap((size) =>
          selectedValues.some((value) => decodeBatchOptionValue(value).dependencies.size === size)
            ? []
            : [firstMatchingOption((decoded) => decoded.dependencies.size === size, '')].filter(Boolean) as string[]
        )
      ]);
    }

    if (key === 'materialType' || key === 'finish') {
      return uniqueValues([
        ...selectedValues,
        ...batchContextValues('material').flatMap((material) =>
          selectedValues.some((value) => decodeBatchOptionValue(value).dependencies.material === material)
            ? []
            : [firstMatchingOption((decoded) => decoded.dependencies.material === material)].filter(Boolean) as string[]
        )
      ]);
    }

    if (key === 'boltClass') {
      const contextKeys = uniqueValues(
        options.map((option) => {
          const { dependencies } = decodeBatchOptionValue(option);
          return [dependencies.size, dependencies.material, dependencies.materialType].filter(Boolean).join('\u0000');
        })
      );
      return uniqueValues([
        ...selectedValues,
        ...contextKeys.flatMap((contextKey) => {
          const selectedForContext = selectedValues.some((value) => {
            const { dependencies } = decodeBatchOptionValue(value);
            return [dependencies.size, dependencies.material, dependencies.materialType].filter(Boolean).join('\u0000') === contextKey;
          });
          if (selectedForContext) return [];
          return [firstMatchingOption((decoded) =>
            [decoded.dependencies.size, decoded.dependencies.material, decoded.dependencies.materialType].filter(Boolean).join('\u0000') === contextKey
          )].filter(Boolean) as string[];
        })
      ]);
    }

    if (selectedValues.length > 0) return selectedValues;

    const currentValue = getItemSpecValue(item, key);
    const currentOption = options.find((option) => {
      const decoded = decodeBatchOptionValue(option);
      return decoded.value === currentValue && batchOptionMatchesCurrentItem(item, option);
    }) ?? options.find((option) => decodeBatchOptionValue(option).value === currentValue);
    if (currentOption) return [currentOption];
    return options.slice(0, 1);
  };

  const updateBatchSpec = (key: HardwareSpecKey, values: string[], options: string[]) => {
    if (!selectedItem) return;
    const selectedValues = values.length > 0 ? values : selectedOrDefaultBatchValues(selectedItem, key, options);
    const specs = { ...selectedItem.batch.specs };
    if (selectedValues.length > 0) {
      specs[key] = selectedValues.join(', ');
    } else {
      delete specs[key];
    }

    updateSelectedBatch({
      specs,
      activeKeys: selectedValues.length > 0
        ? uniqueValues([...selectedItem.batch.activeKeys, key]) as HardwareSpecKey[]
        : selectedItem.batch.activeKeys.filter((entry) => entry !== key)
    });
  };

  const batchContextValues = (key: HardwareSpecKey) => {
    if (!selectedItem) return [];
    const values = selectedBatchRawValues(selectedItem, key);
    return values.length > 0 ? values : [getItemSpecValue(selectedItem, key)].filter(Boolean);
  };

  const batchOptionsForKey = (key: HardwareSpecKey) => {
    if (!selectedItem) return [];
    const catalogOptions = selectedCatalogLocked
      ? getCatalogSpecOptions(selectedCatalogEntry, selectedItem.category, key, selectedSpecUnitSystem)
      : getAllCatalogSpecOptions(selectedCatalogEntry, selectedItem.category, key);

    if (key === 'length') {
      return uniqueValues([
        ...catalogOptions.map((value) => splitLengthAndUnit(value, selectedItem.lengthUnit).length),
        selectedItem.length
      ]);
    }

    if (key === 'threadPitchName') {
      const sizeValues = batchContextValues('size');
      return uniqueValues(
        sizeValues.flatMap((size) =>
          (selectedSpecUnitSystem === 'metric'
            ? metricThreadPitchNamesForSize(size)
            : selectedUsesUnifiedImperialPitches
              ? imperialThreadPitchNamesForSize(size)
              : catalogOptions
          ).map((value) => encodeBatchOptionValue(value, { size }))
        )
      );
    }

    if (key === 'material') {
      return uniqueValues([selectedItem.material, ...catalogOptions, ...baseMaterials]);
    }

    if (key === 'materialType') {
      const materialValues = batchContextValues('material');
      return uniqueValues(
        materialValues.flatMap((material) =>
          getMaterialTreatmentOptions(material).map((value) => encodeBatchOptionValue(value, { material }))
        )
      );
    }

    if (key === 'finish') {
      return uniqueValues(
        batchContextValues('material').flatMap((material) =>
          getFinishOptions(material).map((value) => encodeBatchOptionValue(value, { material }))
        )
      );
    }

    if (key === 'boltClass') {
      const sizes = batchContextValues('size');
      const materials = batchContextValues('material');
      const materialTypeEntries = selectedBatchValues(selectedItem, 'materialType')
        .map(decodeBatchOptionValue)
        .filter((entry) => entry.value)
        .filter((entry) => !entry.dependencies.material || materials.includes(entry.dependencies.material));
      const materialTypes = materialTypeEntries.length > 0
        ? materialTypeEntries
        : batchContextValues('materialType').map((value) => ({ value, dependencies: { material: selectedItem.material } }));

      return uniqueValues(
        sizes.flatMap((size) =>
          materialTypes.flatMap(({ value: materialType, dependencies }) => {
            const material = dependencies.material ?? selectedItem.material;
            if (!materials.includes(material)) return [];
            return getBoltClassOptions({ ...selectedItem, size, material, materialType }, selectedSpecUnitSystem).map((boltClass) =>
              encodeBatchOptionValue(boltClass, { size, material, materialType })
            );
          })
        )
      );
    }

    return uniqueValues([...catalogOptions, getItemSpecValue(selectedItem, key)]);
  };

  useEffect(() => {
    if (!selectedItem || !batchEnabled) return;

    const visibleEntries = batchDefinitions.flatMap((definition) => {
      const options = batchOptionsForKey(definition.key);
      if (options.length === 0) return [];
      return [{ key: definition.key, values: selectedOrDefaultBatchValues(selectedItem, definition.key, options) }];
    });
    const selectedEntries = visibleEntries.filter((entry) => entry.values.length > 0);
    const visibleKeys = selectedEntries.map((entry) => entry.key);
    const nextSpecs = Object.fromEntries(selectedEntries.map((entry) => [entry.key, entry.values.join(', ')])) as HardwareItem['batch']['specs'];
    const specsChanged = JSON.stringify(selectedItem.batch.specs) !== JSON.stringify(nextSpecs);
    const activeKeysChanged =
      selectedItem.batch.activeKeys.length !== visibleKeys.length ||
      selectedItem.batch.activeKeys.some((key, index) => key !== visibleKeys[index]);

    if (!specsChanged && !activeKeysChanged) return;
    updateSelectedBatch({
      specs: nextSpecs,
      activeKeys: visibleKeys
    });
  });

  const updateSelectedSpec = (key: HardwareSpecKey, value: string) => {
    if (!selectedItem) return;
    if (key === 'size') {
      const metricPitch = selectedSpecUnitSystem === 'metric' ? defaultMetricThreadPitch(value) : undefined;
      const imperialPitch =
        selectedSpecUnitSystem === 'imperial' && selectedUsesUnifiedImperialPitches ? defaultImperialThreadPitch(value) : undefined;
      const boltClassItem = { ...selectedItem, size: value };
      const boltClass = isValidBoltClass(boltClassItem, selectedSpecUnitSystem)
        ? selectedItem.boltClass
        : defaultBoltClass(boltClassItem, selectedSpecUnitSystem);
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
        boltClass,
        ...(metricPitch
          ? {
              threadPitchName: metricPitch.name,
              threadPitch: metricPitch.value,
              threadPitchUnit: 'mm'
            }
          : imperialPitch
            ? {
                threadPitchName: imperialPitch.series,
                threadPitch: imperialPitch.tpi,
                threadPitchUnit: 'TPI'
              }
          : {}),
        specs: {
          ...selectedItem.specs,
          size: value,
          boltClass,
          ...washerDimensionSpecs,
          ...(metricPitch
            ? {
                threadPitchName: metricPitch.name,
                threadPitch: metricPitch.value,
                threadPitchUnit: 'mm'
              }
            : imperialPitch
              ? {
                  threadPitchName: imperialPitch.series,
                  threadPitch: imperialPitch.tpi,
                  threadPitchUnit: 'TPI'
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
      const imperialPitch = selectedSpecUnitSystem === 'imperial' ? findImperialThreadPitch(selectedItem.size, value) : undefined;
      updateSelectedItem({
        threadPitchName: metricPitch?.name ?? imperialPitch?.series ?? value,
        ...(metricPitch ? { threadPitch: metricPitch.value, threadPitchUnit: 'mm' } : {}),
        ...(imperialPitch ? { threadPitch: imperialPitch.tpi, threadPitchUnit: 'TPI' } : {}),
        specs: {
          ...selectedItem.specs,
          threadPitchName: metricPitch?.name ?? imperialPitch?.series ?? value,
          ...(metricPitch ? { threadPitch: metricPitch.value, threadPitchUnit: 'mm' } : {}),
          ...(imperialPitch ? { threadPitch: imperialPitch.tpi, threadPitchUnit: 'TPI' } : {})
        }
      });
      return;
    }

    if (key === 'material') {
      const materialType = isValidMaterialTreatment(value, selectedItem.materialType) ? selectedItem.materialType : defaultMaterialTreatment(value);
      const finish = isValidFinish(value, selectedItem.finish) ? selectedItem.finish : defaultFinish(value);
      const boltClassItem = { ...selectedItem, material: value, materialType };
      const boltClass = isValidBoltClass(boltClassItem, selectedSpecUnitSystem) ? selectedItem.boltClass : defaultBoltClass(boltClassItem, selectedSpecUnitSystem);
      updateSelectedItem({
        material: value,
        materialType,
        finish,
        boltClass,
        specs: {
          ...selectedItem.specs,
          material: value,
          materialType,
          finish,
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
      hardwareItems: current.hardwareItems.map((item) =>
        item.id === selectedItem.id
          ? syncHardwareSpecs({
              ...item,
              catalogId: undefined,
              category,
              labelSettings: categoryLabelSettings(current, category, item.labelSettings),
              batch: { enabled: false, specs: {}, activeKeys: [] },
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

    setState((current) => ({
      ...current,
      hardwareItems: current.hardwareItems.map((item) =>
        item.id === selectedItem.id
          ? syncHardwareSpecs({
              ...item,
              ...buildCatalogItemPatch(entry, item),
              labelSettings: categoryLabelSettings(current, entry.category, item.labelSettings),
              batch: { enabled: false, specs: {}, activeKeys: [] }
            })
          : item
      )
    }));
    setSelectedFieldId(null);
  };

  if (!selectedItem) {
    return null;
  }

  return (
    <section className="panel editor-panel">
      <div className="panel-title">
        <FileText size={18} />
        <h2>Hardware specs</h2>
      </div>

      <div className="spec-form-header">
        <div className="spec-form-controls">
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
            Standard
            <input
              value={selectedItem.standard}
              readOnly={selectedCatalogLocked}
              onChange={(event) => updateSelectedItem({ standard: event.target.value })}
            />
          </label>
          <label>
            Category
            <select
              value={selectedItem.category}
              disabled={selectedCatalogLocked}
              onChange={(event) => updateSelectedCategory(event.target.value as HardwareCategory)}
            >
              {hardwareCategories.map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedStandardImageReference && (
          <div className="standard-render-card">
            <CatalogModelViewer modelUrl={selectedStandardImageReference.modelUrl} label={`3D model for ${selectedItem.standard}`} />
            <span>3D model</span>
          </div>
        )}
      </div>

      <div className="form-grid">
        {!batchEnabled && activeSpecDefinitions.map((definition) => {
          const catalogOptions = selectedCatalogLocked
            ? getCatalogSpecOptions(selectedCatalogEntry, selectedItem.category, definition.key, selectedSpecUnitSystem)
            : getAllCatalogSpecOptions(selectedCatalogEntry, selectedItem.category, definition.key);
          const options = definition.key === 'material' && !selectedCatalogLocked ? uniqueValues([...catalogOptions, ...baseMaterials]) : catalogOptions;
          const datalistId = `spec-options-${definition.key}`;
          const materialTypeOptions =
            definition.key === 'materialType'
              ? getMaterialTreatmentOptions(selectedItem.material)
              : [];
          const boltClassOptions =
            definition.key === 'boltClass'
              ? getBoltClassOptions(selectedItem, selectedSpecUnitSystem).filter((value) => options.length === 0 || options.includes(value))
              : [];
          const finishOptions =
            definition.key === 'finish'
              ? getFinishOptions(selectedItem.material).filter((value) => options.length === 0 || options.includes(value))
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
          const threadPitchNameOptions =
            definition.key === 'threadPitchName'
              ? uniqueValues([
                  ...(selectedSpecUnitSystem === 'metric'
                    ? metricThreadPitchNamesForSize(selectedItem.size)
                    : selectedUsesUnifiedImperialPitches
                      ? imperialThreadPitchNamesForSize(selectedItem.size)
                      : options),
                  formattedPitchName(selectedItem, selectedSpecUnitSystem),
                  ...(selectedCatalogLocked ? [] : options)
                ])
              : [];
          const materialOptions = definition.key === 'material' ? uniqueValues([selectedItem.material, ...options]) : [];
          const selectedFinishOptions =
            definition.key === 'finish'
              ? uniqueValues([isValidFinish(selectedItem.material, selectedItem.finish) ? selectedItem.finish : defaultFinish(selectedItem.material), ...finishOptions])
              : [];
          const genericOptions = uniqueValues([getItemSpecValue(selectedItem, definition.key), ...options]);
          const isReadonlyWasherDimension =
            selectedCatalogLocked && selectedCatalogEntry?.category === 'washer' && isWasherDimensionKey(definition.key);

          if (definition.key === 'boltClass' && boltClassOptions.length === 0) {
            return null;
          }

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
                      formattedPitchName(selectedItem, selectedSpecUnitSystem)
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
              ) : definition.key === 'finish' ? (
                <>
                  {selectedCatalogLocked ? (
                    <select
                      value={selectedItem.finish}
                      onChange={(event) => updateSelectedSpec('finish', event.target.value)}
                    >
                      {selectedFinishOptions.map((value) => (
                        <option key={value} value={value}>
                          {value || 'n/a'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <input
                        list={datalistId}
                        value={selectedItem.finish}
                        onChange={(event) => updateSelectedSpec('finish', event.target.value)}
                      />
                      <datalist id={datalistId}>
                        {selectedFinishOptions.map((value) => (
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

      <section className={batchEnabled ? 'batch-section active' : 'batch-section'}>
        <div className="batch-section-title">
          <label className="batch-enable">
            <input
              type="checkbox"
              checked={batchEnabled}
              onChange={(event) => {
                updateSelectedBatch({ enabled: event.target.checked });
                if (!event.target.checked) setPreviewHardwareItem(null);
              }}
            />
            <span>Batch</span>
          </label>
          <button
            type="button"
            className="icon-button small"
            title={batchCollapsed ? 'Expand batch' : 'Collapse batch'}
            aria-label={batchCollapsed ? 'Expand batch' : 'Collapse batch'}
            aria-expanded={!batchCollapsed}
            disabled={!batchEnabled}
            onClick={() => setBatchCollapsed((current) => !current)}
          >
            {batchCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {batchEnabled && !batchCollapsed && (
          <>
            <div className="batch-property-grid">
              {batchDefinitions.flatMap((definition) => {
                const options = batchOptionsForKey(definition.key);
                const values = selectedOrDefaultBatchValues(selectedItem, definition.key, options);

                if (options.length === 0) return [];

                return [
                  <label
                    key={definition.key}
                    className={['size', 'length', 'threadPitchName'].includes(definition.key) ? 'batch-property active batch-property-multi' : 'batch-property active'}
                  >
                    <span className="batch-property-heading">{definition.label}</span>
                    <select
                      multiple
                      value={values}
                      onChange={(event) =>
                        updateBatchSpec(
                          definition.key,
                          Array.from(event.currentTarget.selectedOptions).map((option) => option.value),
                          options
                        )
                      }
                    >
                      {options.map((value) => (
                        <option key={value} value={value}>
                          {batchOptionLabel(value) || 'n/a'}
                        </option>
                      ))}
                    </select>
                  </label>
                ];
              })}
            </div>
            <div className="batch-preview">
              <div className="batch-preview-title">
                <span>Produced parts</span>
                <strong>{batchPreviewItems.length}</strong>
              </div>
              <p className="batch-preview-note">
                Batch fields allow multiple values; dependent fields auto-select defaults for each selected parent.
              </p>
              <div className="batch-preview-list">
                {batchPreviewItems.length === 0 ? (
                  <div className="batch-preview-row empty">
                    Select at least one complete valid combination to produce parts.
                  </div>
                ) : (
                  batchPreviewItems.map((item, index) => (
                    <button
                      key={`${batchPreviewLabel(item)}-${index}`}
                      type="button"
                      className={previewHardwareSpecLine === getHardwareSpecLine(item) ? 'batch-preview-row active' : 'batch-preview-row'}
                      onClick={() => setPreviewHardwareItem(item)}
                    >
                      {getHardwareSpecLine(item)}
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {selectedStandardImageReference && (
        <section className="standard-images-section">
          <div className="standard-images-title">
            <span>Catalog assets</span>
            <span>{selectedItem.catalogId}</span>
          </div>
          <div className="standard-image-grid">
            {catalogAssetSources.filter((source): source is CatalogDrawingSource => source === 'iso' || source === 'side' || source === 'top').map((source) => (
              <div
                key={source}
                className="standard-image-card"
              >
                <img
                  src={catalogDrawingPreviewUrl(selectedStandardImageReference, source)}
                  alt={`${catalogAssetLabel(source)} for ${selectedItem.standard}`}
                  loading="lazy"
                  onError={(event) => { event.currentTarget.src = missingCatalogAssetDataUrl(catalogAssetLabel(source)); }}
                />
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
  );
}
