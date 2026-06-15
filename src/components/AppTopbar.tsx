import type { ChangeEvent } from 'react';
import { useRef } from 'react';
import { Download, Save, Upload } from 'lucide-react';
import { standardsCatalog } from '../data/catalog';
import { useAppState } from '../app/AppStateContext';
import { constrainLabelSettings, uniqueValues } from '../lib/labelLayout';
import { downloadBlob } from '../lib/export';
import { syncHardwareSpecs } from '../lib/specs';
import { standardFamilies } from '../lib/standards';
import { catalogMatchesSelectedStandards } from '../lib/standards';
import { parseBackup, saveState, serializeBackup } from '../lib/storage';
import { getCatalogEntryForItem } from './hardware/hardwareLogic';
import type { AppState } from '../types';

export function AppTopbar() {
  const { selectedId, setHoveredFieldId, setSelectedFieldId, setSelectedId, setState, showSuccessToast, state } = useAppState();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleManualSave = () => {
    saveState(state);
    showSuccessToast('Saved successfully.');
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
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to import backup file.');
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
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

  const handleImportChange = (event: ChangeEvent<HTMLInputElement>) => {
    void importPersistedData(event.target.files?.[0]);
  };

  return (
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
          onChange={handleImportChange}
        />
      </div>
    </header>
  );
}
