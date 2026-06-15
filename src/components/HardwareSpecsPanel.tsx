import { FileText, QrCode } from 'lucide-react';
import { useEffect } from 'react';
import { standardsCatalog } from '../data/catalog';
import { useAppState } from '../app/AppStateContext';
import { uniqueValues } from '../lib/labelLayout';
import { hardwareCategories } from './hardware/hardwareConstants';
import { baseMaterials, getFinishOptions, getMaterialTreatmentOptions } from '../lib/materials';
import { defaultFinish, defaultMaterialTreatment, isValidFinish, isValidMaterialTreatment } from '../lib/materials';
import { getBoltClassOptions } from '../lib/boltClasses';
import { defaultBoltClass, isValidBoltClass } from '../lib/boltClasses';
import { splitLengthAndUnit } from '../lib/format';
import { effectivePurchaseLink } from '../lib/export';
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
  categorySpecKeys,
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
import { CatalogPartPicker } from './CatalogPartPicker';
import {
  applyCategoryPresetToState,
  buildCatalogItemPatch,
  getCatalogEntryForItem
} from './hardware/hardwareLogic';
import type { AppState, HardwareCategory, HardwareItem, HardwareSpecKey, StandardCatalogEntry } from '../types';

type StandardImageReference = NonNullable<ReturnType<typeof standardImageReferenceForItem>>;

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

const catalogAssetPreviewUrl = (reference: StandardImageReference, source: (typeof catalogAssetSources)[number]) => {
  if (source === 'isoRender') return reference.isoRenderUrl;
  if (source === 'iso') return reference.isoUrl;
  if (source === 'side') return reference.sideUrl;
  return reference.topUrl;
};

export function HardwareSpecsPanel() {
  const { selectedId, setSelectedFieldId, setState, state } = useAppState();
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
  const selectedPurchaseLink = selectedItem ? effectivePurchaseLink(state.purchaseLinks, selectedItem) : '';
  const hasQrElement = state.labelSettings.fields.some((field) => field.kind === 'image' && field.imageSource === 'qr' && field.style.visible);

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
    setState((current) => ({
      ...current,
      hardwareItems: current.hardwareItems.map((item) => (item.id === selectedItem.id ? syncHardwareSpecs({ ...item, ...patch }) : item))
    }));
  };

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

  if (!selectedItem) {
    return null;
  }

  return (
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
            {hardwareCategories.map((category) => (
              <option key={category} value={category}>
                {categoryLabel(category)}
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
                <img
                  src={catalogAssetPreviewUrl(selectedStandardImageReference, source)}
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
