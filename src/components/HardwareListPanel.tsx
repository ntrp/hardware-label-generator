import { useState } from 'react';
import { Archive, FileArchive, Plus, Printer, RotateCcw, Trash2 } from 'lucide-react';
import { useAppState } from '../app/AppStateContext';
import { PrintSheet } from './AppFeedback';
import { resolveEffectiveHardwareItems } from '../lib/batch';
import { createId, defaultAppState } from '../lib/defaults';
import { effectivePurchaseLink, exportZip, type ExportFormat } from '../lib/export';
import { renderLabelSvg } from '../lib/svg';
import {
  getCatalogEntryForItem,
  getHardwareDescription,
  getHardwareSpecLine
} from './hardware/hardwareLogic';

export function HardwareListPanel() {
  const { selectedId, setSelectedId, setState, state } = useAppState();
  const [zipFormats, setZipFormats] = useState<ExportFormat[]>(['svg', 'png', 'lbx']);
  const [printSvgs, setPrintSvgs] = useState<string[]>([]);
  const selectedItem = state.hardwareItems.find((item) => item.id === selectedId) ?? state.hardwareItems[0];

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
    const resolved = resolveEffectiveHardwareItems(state.hardwareItems);
    if (resolved.duplicateCount > 0) {
      window.alert(`${resolved.duplicateCount} duplicate batch ${resolved.duplicateCount === 1 ? 'part was' : 'parts were'} removed before printing.`);
    }
    const svgs = await Promise.all(
      resolved.items.map((item) => {
        const catalogEntry = getCatalogEntryForItem(item);
        return renderLabelSvg(item, state.labelSettings, effectivePurchaseLink(state.purchaseLinks, item), catalogEntry?.unitSystem ?? item.unitSystem);
      })
    );
    setPrintSvgs(svgs);
    window.setTimeout(() => window.print(), 150);
  };

  const exportAll = async () => {
    const resolved = resolveEffectiveHardwareItems(state.hardwareItems);
    if (resolved.duplicateCount > 0) {
      window.alert(`${resolved.duplicateCount} duplicate batch ${resolved.duplicateCount === 1 ? 'part was' : 'parts were'} removed before export.`);
    }
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
          <button type="button" onClick={exportAll}>
            <FileArchive size={16} /> Export ZIP
          </button>
          <button type="button" className="secondary" onClick={showPrintSheet}>
            <Printer size={16} /> Print sheet
          </button>
        </div>
      </aside>
      <PrintSheet printSvgs={printSvgs} />
    </>
  );
}
