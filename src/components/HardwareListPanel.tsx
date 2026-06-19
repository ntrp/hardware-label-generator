import { useEffect, useState } from 'react';
import { Archive, ChevronDown, ChevronRight, Copy, FileArchive, Plus, Printer, RotateCcw, Trash2, X } from 'lucide-react';
import { useAppState } from '../app/AppStateContext';
import { PrintSheet } from './AppFeedback';
import { resolveEffectiveHardwareItems, type EffectiveHardwareItemsResult } from '../lib/batch';
import { createId, defaultAppState, defaultHardwareItem } from '../lib/defaults';
import { effectivePurchaseLink, exportZip, type ExportFormat } from '../lib/export';
import { labelPresetIdentityForSettings, labelPresetNameForSettings } from '../lib/labelLayout';
import { renderLabelSvg } from '../lib/svg';
import { useI18n } from '../lib/i18n';
import {
  getCatalogEntryForItem,
  getHardwareDisplaySpecLine
} from './hardware/hardwareLogic';
import type { HardwareItem } from '../types';

export function HardwareListPanel() {
  const { selectedId, setSelectedId, setState, state } = useAppState();
  const { catalogDescription, categoryLabel, displaySpecValue, t } = useI18n();
  const [zipFormats, setZipFormats] = useState<ExportFormat[]>(['svg', 'png', 'lbx']);
  const [printSvgs, setPrintSvgs] = useState<string[]>([]);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const selectedItem = state.hardwareItems.find((item) => item.id === selectedId) ?? state.hardwareItems[0];
  const labelPresetNameForItem = (item: HardwareItem) => labelPresetNameForSettings(item.labelSettings, state.customPresets, state.unitSystem);
  const labelPresetIdentityForItem = (item: HardwareItem) => labelPresetIdentityForSettings(item.labelSettings, state.customPresets, state.unitSystem);
  const descriptionForItem = (item: HardwareItem) => {
    const catalogEntry = getCatalogEntryForItem(item);
    return catalogEntry ? catalogDescription(catalogEntry.description) : categoryLabel(item.category);
  };
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
    const confirmed = window.confirm(t('resetListConfirm'));
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
      window.alert(t('parts', { count: resolved.duplicateCount }));
    }
    const svgs = await Promise.all(
      resolved.items.map((item) => {
        const catalogEntry = getCatalogEntryForItem(item);
        return renderLabelSvg(item, item.labelSettings, effectivePurchaseLink(state.purchaseLinks, item), catalogEntry?.unitSystem ?? item.unitSystem, { displaySpecValue });
      })
    );
    setPrintSvgs(svgs);
    window.setTimeout(() => window.print(), 150);
  };

  const exportAll = async () => {
    const resolved = resolveEffectiveHardwareItems(state.hardwareItems, { labelIdentityForItem: labelPresetIdentityForItem });
    await exportZip(resolved.items, state.labelSettings, state.purchaseLinks, zipFormats, displaySpecValue);
  };

  if (!selectedItem) {
    return null;
  }

  return (
    <>
      <aside className="panel hardware-list">
        <div className="panel-title">
          <Archive size={18} />
          <h2>{t('hardware')}</h2>
        </div>
        <div className="listbox">
          {state.hardwareItems.map((item) => (
            <div key={item.id} className={item.id === selectedItem.id ? 'hardware-card active' : 'hardware-card'}>
              <button type="button" className="list-item" onClick={() => setSelectedId(item.id)}>
                <span className="hardware-card-title">
                  <strong>{item.standard}</strong>
                </span>
                <span className="hardware-description">{descriptionForItem(item)}</span>
                <small>
                  {item.batch.enabled ? <span className="hardware-batch-badge">{t('batch')}</span> : getHardwareDisplaySpecLine(item, displaySpecValue)}
                </small>
              </button>
              <div className="hardware-card-actions">
                <button
                  type="button"
                  className="icon-button small hardware-clone"
                  aria-label={`${t('clone')} ${item.size} ${item.standard}`}
                  onClick={() => cloneHardwareItem(item.id)}
                >
                  <Copy size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button small hardware-remove"
                  title={t('remove')}
                  aria-label={`${t('remove')} ${item.size} ${item.standard}`}
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
            <Plus size={16} /> {t('add')}
          </button>
          <button type="button" className="secondary" onClick={resetHardwareList}>
            <RotateCcw size={16} /> {t('resetList')}
          </button>
        </div>
        <div className="zip-box hardware-export-box">
          <h3>
            <FileArchive size={16} /> {t('exportAll')}
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
              <FileArchive size={16} /> {t('export')}
            </button>
            <button type="button" className="secondary" onClick={showPrintSheet}>
              <Printer size={16} /> {t('print')}
            </button>
          </div>
        </div>
      </aside>
      {exportPreviewOpen && (
        <ExportPreviewModal
          result={resolvedPreview}
          formats={zipFormats}
          labelPresetNameForItem={labelPresetNameForItem}
          descriptionForItem={descriptionForItem}
          purchaseLinks={state.purchaseLinks}
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
  descriptionForItem: (item: HardwareItem) => string;
  purchaseLinks: Record<string, string>;
  onClose: () => void;
  onConfirm: () => void;
}

function ExportPreviewModal({ result, formats, labelPresetNameForItem, descriptionForItem, purchaseLinks, onClose, onConfirm }: ExportPreviewModalProps) {
  const { displaySpecValue, t } = useI18n();
  const formatList = formats.map((format) => format.toLowerCase()).join(', ');
  const presetGroups = groupExportPreviewItems(result.items, labelPresetNameForItem, descriptionForItem);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedItem = result.items[selectedIndex] ?? result.items[0];
  const [selectedPreviewSvg, setSelectedPreviewSvg] = useState('');
  const [collapsedPresets, setCollapsedPresets] = useState<Set<string>>(() => new Set());
  const [collapsedParts, setCollapsedParts] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSelectedIndex(0);
    setCollapsedPresets(new Set());
    setCollapsedParts(new Set());
  }, [result.items]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedItem) {
      setSelectedPreviewSvg('');
      return;
    }

    const catalogEntry = getCatalogEntryForItem(selectedItem);
    renderLabelSvg(
      selectedItem,
      selectedItem.labelSettings,
      effectivePurchaseLink(purchaseLinks, selectedItem),
      catalogEntry?.unitSystem ?? selectedItem.unitSystem,
      { displaySpecValue }
    ).then((svg) => {
      if (!cancelled) setSelectedPreviewSvg(svg);
    });

    return () => {
      cancelled = true;
    };
  }, [displaySpecValue, purchaseLinks, selectedItem]);

  const toggleCollapsedPreset = (presetName: string) => {
    setCollapsedPresets((current) => {
      const next = new Set(current);
      if (next.has(presetName)) next.delete(presetName);
      else next.add(presetName);
      return next;
    });
  };

  const toggleCollapsedPart = (partKey: string) => {
    setCollapsedParts((current) => {
      const next = new Set(current);
      if (next.has(partKey)) next.delete(partKey);
      else next.add(partKey);
      return next;
    });
  };

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
            <h2 id="export-preview-title">{t('exportPreview')}</h2>
            <p className="modal-subtitle">
              {t('parts', { count: result.items.length })} ({formatList})
              {result.duplicateCount > 0 ? `, ${t('parts', { count: result.duplicateCount })}` : ''}
            </p>
          </div>
          <button type="button" className="icon-button small" aria-label={t('closeExportPreview')} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="export-preview-body">
          <div className="export-preview-list">
            {presetGroups.map((presetGroup) => (
              <section key={presetGroup.presetName} className="export-preview-group">
                <button
                  type="button"
                  className="export-preview-group-heading"
                  aria-expanded={!collapsedPresets.has(presetGroup.presetName)}
                  onClick={() => toggleCollapsedPreset(presetGroup.presetName)}
                >
                  {collapsedPresets.has(presetGroup.presetName) ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                  <span>{presetGroup.presetName}</span>
                  <small>{presetGroup.count}</small>
                </button>
                {!collapsedPresets.has(presetGroup.presetName) &&
                  presetGroup.partGroups.map((partGroup) => {
                    const partKey = `${presetGroup.presetName}::${partGroup.partName}`;
                    const partCollapsed = collapsedParts.has(partKey);

                    return (
                      <section key={partKey} className="export-preview-part-group">
                        <button
                          type="button"
                          className="export-preview-part-heading"
                          aria-expanded={!partCollapsed}
                          onClick={() => toggleCollapsedPart(partKey)}
                        >
                          {partCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          <span title={partGroup.partName}>{partGroup.partName}</span>
                          <small>{partGroup.entries.length}</small>
                        </button>
                        {!partCollapsed &&
                          partGroup.entries.map((entry) => (
                            <button
                              key={`${entry.item.id}-${entry.index}-${entry.item.size}-${entry.item.length}`}
                              type="button"
                              className={entry.index === selectedIndex ? 'export-preview-row active' : 'export-preview-row'}
                              onClick={() => setSelectedIndex(entry.index)}
                            >
                              <span title={`${presetGroup.presetName} - ${partGroup.partName} - ${getHardwareDisplaySpecLine(entry.item, displaySpecValue)}`}>
                                {getHardwareDisplaySpecLine(entry.item, displaySpecValue)}
                              </span>
                            </button>
                          ))}
                      </section>
                    );
                  })}
              </section>
            ))}
          </div>
          <aside className="export-preview-pane" aria-live="polite">
            {selectedItem && (
              <>
                <div className="export-preview-pane-title">
                  <strong>{labelPresetNameForItem(selectedItem)}</strong>
                  <span>{getHardwareDisplaySpecLine(selectedItem, displaySpecValue)}</span>
                </div>
                <div className="export-preview-svg" dangerouslySetInnerHTML={{ __html: selectedPreviewSvg }} />
              </>
            )}
          </aside>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onConfirm}>{t('confirm')}</button>
        </div>
      </div>
    </div>
  );
}

const groupExportPreviewItems = (
  items: EffectiveHardwareItemsResult['items'],
  labelPresetNameForItem: (item: EffectiveHardwareItemsResult['items'][number]) => string,
  descriptionForItem: (item: HardwareItem) => string
) => {
  const presetGroups = new Map<string, Map<string, Array<{ item: HardwareItem; index: number }>>>();

  items.forEach((item, index) => {
    const presetName = labelPresetNameForItem(item);
    const partName = `${item.standard} - ${descriptionForItem(item)}`;
    const partGroups = presetGroups.get(presetName) ?? new Map<string, Array<{ item: HardwareItem; index: number }>>();
    const entries = partGroups.get(partName) ?? [];
    entries.push({ item, index });
    partGroups.set(partName, entries);
    presetGroups.set(presetName, partGroups);
  });

  return [...presetGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
    .map(([presetName, partGroups]) => ({
      presetName,
      count: [...partGroups.values()].reduce((total, entries) => total + entries.length, 0),
      partGroups: [...partGroups.entries()]
        .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map(([partName, entries]) => ({
          partName,
          entries
        }))
    }));
};
