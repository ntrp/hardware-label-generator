import { useState } from 'react';
import { Archive, FileArchive, Plus, Printer, RotateCcw, Trash2 } from 'lucide-react';
import { standardsCatalog } from '../data/catalog';
import { useAppState } from '../app/AppStateContext';
import { PrintSheet } from './AppFeedback';
import { BatchGenerationModal } from './modals/BatchGenerationModal';
import { generateBatchItems } from '../lib/batch';
import { createId, defaultAppState } from '../lib/defaults';
import { effectivePurchaseLink, exportZip, type ExportFormat } from '../lib/export';
import { parseList } from '../lib/format';
import {
  categorySpecKeys,
  getAllCatalogSpecOptions,
  getCatalogSpecOptions,
  getCatalogWasherDimensionValue,
  getCategorySpecDefinitions,
  isWasherDimensionKey,
  syncHardwareSpecs
} from '../lib/specs';
import { catalogMatchesSelectedFilters } from '../lib/standards';
import { renderLabelSvg } from '../lib/svg';
import { uniqueValues } from '../lib/labelLayout';
import {
  buildCatalogItemPatch,
  getCatalogEntryForItem,
  getHardwareDescription,
  getHardwareSpecLine
} from './hardware/hardwareLogic';
import type { HardwareSpecKey } from '../types';

export function HardwareListPanel() {
  const { selectedId, setSelectedId, setState, state } = useAppState();
  const [zipFormats, setZipFormats] = useState<ExportFormat[]>(['svg', 'png', 'lbx']);
  const [printSvgs, setPrintSvgs] = useState<string[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const selectedItem = state.hardwareItems.find((item) => item.id === selectedId) ?? state.hardwareItems[0];
  const filteredCatalog = standardsCatalog.filter((entry) =>
    catalogMatchesSelectedFilters(entry, state.selectedStandards, state.selectedCategories)
  );
  const batchCatalogEntry = filteredCatalog.find((entry) => entry.id === state.batchCatalogId) ?? filteredCatalog[0] ?? standardsCatalog[0];
  const batchSpecDefinitions = getCategorySpecDefinitions(batchCatalogEntry.category);
  const isBatchReadonlyWasherDimension = (key: HardwareSpecKey) => batchCatalogEntry.category === 'washer' && isWasherDimensionKey(key);
  const batchCombinationSpecDefinitions = batchSpecDefinitions.filter((definition) => !isBatchReadonlyWasherDimension(definition.key));

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

  const updateBatchCatalog = (entryId: string) => {
    const entry = standardsCatalog.find((candidate) => candidate.id === entryId);
    if (!entry) return;

    const batchSpecs = Object.fromEntries(
      categorySpecKeys[entry.category].map((key) => [key, getAllCatalogSpecOptions(entry, entry.category, key).join(', ')])
    ) as Partial<Record<HardwareSpecKey, string>>;

    setState((current) => ({
      ...current,
      batchCatalogId: entry.id,
      batchSpecs
    }));
  };

  const updateBatchSpec = (key: HardwareSpecKey, value: string) => {
    setState((current) => ({
      ...current,
      batchSpecs: {
        ...current.batchSpecs,
        [key]: value
      }
    }));
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

  if (!selectedItem) {
    return null;
  }

  return (
    <>
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
      {batchModalOpen && (
        <BatchGenerationModal
          batchCatalogEntry={batchCatalogEntry}
          batchCombinationSpecDefinitions={batchCombinationSpecDefinitions}
          batchSpecDefinitions={batchSpecDefinitions}
          batchSpecs={state.batchSpecs}
          filteredCatalog={filteredCatalog}
          selectedStandards={state.selectedStandards}
          onBatchWasherDimensionValue={batchWasherDimensionValue}
          onClose={() => setBatchModalOpen(false)}
          onCreateBatch={createBatch}
          onIsBatchReadonlyWasherDimension={isBatchReadonlyWasherDimension}
          onUpdateBatchCatalog={updateBatchCatalog}
          onUpdateBatchSpec={updateBatchSpec}
        />
      )}
      <PrintSheet printSvgs={printSvgs} />
    </>
  );
}
