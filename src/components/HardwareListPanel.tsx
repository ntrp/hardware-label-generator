import { useState } from 'react';
import { Archive, Copy, FileArchive, Plus, Printer, RotateCcw, Trash2, X } from 'lucide-react';
import { useAppState } from '../app/AppStateContext';
import { PrintSheet } from './AppFeedback';
import { resolveEffectiveHardwareItems, type EffectiveHardwareItemsResult } from '../lib/batch';
import { createId, defaultAppState, defaultHardwareItem } from '../lib/defaults';
import { effectivePurchaseLink, exportZip, type ExportFormat } from '../lib/export';
import { labelPresetIdentityForSettings, labelPresetNameForSettings } from '../lib/labelLayout';
import { renderLabelSvg } from '../lib/svg';
import {
  getCatalogEntryForItem,
  getHardwareDescription,
  getHardwareSpecLine
} from './hardware/hardwareLogic';
import type { HardwareItem } from '../types';

export function HardwareListPanel() {
  const { selectedId, setSelectedId, setState, state } = useAppState();
  const [zipFormats, setZipFormats] = useState<ExportFormat[]>(['svg', 'png', 'lbx']);
  const [printSvgs, setPrintSvgs] = useState<string[]>([]);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const selectedItem = state.hardwareItems.find((item) => item.id === selectedId) ?? state.hardwareItems[0];
  const labelPresetNameForItem = (item: HardwareItem) => labelPresetNameForSettings(item.labelSettings, state.customPresets, state.unitSystem);
  const labelPresetIdentityForItem = (item: HardwareItem) => labelPresetIdentityForSettings(item.labelSettings, state.customPresets, state.unitSystem);
  const resolvedPreview = resolveEffectiveHardwareItems(state.hardwareItems, { labelIdentityForItem: labelPresetIdentityForItem });

  const addItem = () => {
    const next = { ...structuredClone(defaultHardwareItem), id: createId('item') };
    setState((current) => ({
      ...current,
      hardwareItems: [...current.hardwareItems, next]
    }));
    setSelectedId(next.id);
  };

  const cloneHardwareItem = (itemId: string) => {
    const source = state.hardwareItems.find((item) => item.id === itemId);
    if (!source) return;

    const clone = { ...structuredClone(source), id: createId('item') };
    setState((current) => {
      const sourceIndex = current.hardwareItems.findIndex((item) => item.id === itemId);
      const hardwareItems = [...current.hardwareItems];
      hardwareItems.splice(sourceIndex === -1 ? hardwareItems.length : sourceIndex + 1, 0, clone);

      return {
        ...current,
        hardwareItems,
        purchaseLinks: current.purchaseLinks[itemId] === undefined
          ? current.purchaseLinks
          : { ...current.purchaseLinks, [clone.id]: current.purchaseLinks[itemId] }
      };
    });
    setSelectedId(clone.id);
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
    const resolved = resolveEffectiveHardwareItems(state.hardwareItems, { labelIdentityForItem: labelPresetIdentityForItem });
    if (resolved.duplicateCount > 0) {
      window.alert(`${resolved.duplicateCount} duplicate batch ${resolved.duplicateCount === 1 ? 'part was' : 'parts were'} removed before printing.`);
    }
    const svgs = await Promise.all(
      resolved.items.map((item) => {
        const catalogEntry = getCatalogEntryForItem(item);
        return renderLabelSvg(item, item.labelSettings, effectivePurchaseLink(state.purchaseLinks, item), catalogEntry?.unitSystem ?? item.unitSystem);
      })
    );
    setPrintSvgs(svgs);
    window.setTimeout(() => window.print(), 150);
  };

  const exportAll = async () => {
    const resolved = resolveEffectiveHardwareItems(state.hardwareItems, { labelIdentityForItem: labelPresetIdentityForItem });
    await exportZip(resolved.items, state.labelSettings, state.purchaseLinks, zipFormats);
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
                <span className="hardware-card-title">
                  <strong>{item.standard}</strong>
                </span>
                <span className="hardware-description">{getHardwareDescription(item)}</span>
                <small>
                  {item.batch.enabled ? <span className="hardware-batch-badge">Batch</span> : getHardwareSpecLine(item)}
                </small>
              </button>
              <div className="hardware-card-actions">
                <button
                  type="button"
                  className="icon-button small hardware-clone"
                  aria-label={`Clone ${item.size} ${item.standard}`}
                  onClick={() => cloneHardwareItem(item.id)}
                >
                  <Copy size={15} />
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
            </div>
          ))}
        </div>
        <div className="button-row">
          <button type="button" onClick={addItem}>
            <Plus size={16} /> Add
          </button>
          <button type="button" className="secondary" onClick={resetHardwareList}>
            <RotateCcw size={16} /> Reset
          </button>
        </div>
        <div className="zip-box hardware-export-box">
          <h3>
            <FileArchive size={16} /> Export all
          </h3>
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
          <div className="hardware-export-actions">
            <button type="button" onClick={() => setExportPreviewOpen(true)}>
              <FileArchive size={16} /> Export
            </button>
            <button type="button" className="secondary" onClick={showPrintSheet}>
              <Printer size={16} /> Print
            </button>
          </div>
        </div>
      </aside>
      {exportPreviewOpen && (
        <ExportPreviewModal
          result={resolvedPreview}
          formats={zipFormats}
          labelPresetNameForItem={labelPresetNameForItem}
          onClose={() => setExportPreviewOpen(false)}
          onConfirm={() => {
            setExportPreviewOpen(false);
            void exportAll();
          }}
        />
      )}
      <PrintSheet printSvgs={printSvgs} />
    </>
  );
}

interface ExportPreviewModalProps {
  result: EffectiveHardwareItemsResult;
  formats: ExportFormat[];
  labelPresetNameForItem: (item: EffectiveHardwareItemsResult['items'][number]) => string;
  onClose: () => void;
  onConfirm: () => void;
}

function ExportPreviewModal({ result, formats, labelPresetNameForItem, onClose, onConfirm }: ExportPreviewModalProps) {
  const formatList = formats.map((format) => format.toLowerCase()).join(', ');

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal-panel export-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-preview-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="export-preview-title">Export preview</h2>
            <p className="modal-subtitle">
              {result.items.length} effective {result.items.length === 1 ? 'label' : 'labels'} ({formatList} {formats.length === 1 ? 'format' : 'formats'})
              {result.duplicateCount > 0 ? `, ${result.duplicateCount} duplicate ${result.duplicateCount === 1 ? 'part' : 'parts'} removed` : ''}
            </p>
          </div>
          <button type="button" className="icon-button small" aria-label="Close export preview" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="export-preview-list">
          {result.items.map((item, index) => (
            <div key={`${item.id}-${index}-${item.size}-${item.length}`} className="export-preview-row">
              <span title={`${labelPresetNameForItem(item)} - ${item.standard} - ${getHardwareDescription(item)} - ${getHardwareSpecLine(item)}`}>
                {index + 1}. {labelPresetNameForItem(item)} - {item.standard} - {getHardwareDescription(item)} - {getHardwareSpecLine(item)}
              </span>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
