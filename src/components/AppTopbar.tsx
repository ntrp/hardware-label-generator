import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Download, Info, Link, RotateCcw, Settings, Upload } from 'lucide-react';
import { useAppState } from '../app/AppStateContext';
import { constrainAppState } from '../lib/appState';
import { downloadBlob } from '../lib/export';
import { defaultAppState } from '../lib/defaults';
import { createShareConfigUrl } from '../lib/shareConfig';
import { syncHardwareSpecs } from '../lib/specs';
import { backupFilename, parseBackup, serializeBackup } from '../lib/storage';
import { getCatalogEntryForItem } from './hardware/hardwareLogic';
import type { AppState } from '../types';

export function AppTopbar() {
  const { selectedId, setHoveredFieldId, setPreviewHardwareItem, setSelectedFieldId, setSelectedId, setState, showSuccessToast, state } = useAppState();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const stateMenuRef = useRef<HTMLDivElement | null>(null);
  const [stateMenuOpen, setStateMenuOpen] = useState(false);
  const [preparedShareUrl, setPreparedShareUrl] = useState('');

  useEffect(() => {
    if (!stateMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!stateMenuRef.current?.contains(event.target as Node)) {
        setStateMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStateMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [stateMenuOpen]);

  useEffect(() => {
    let cancelled = false;

    void createShareConfigUrl(state).then((shareUrl) => {
      if (!cancelled) setPreparedShareUrl(shareUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [state]);

  const exportPersistedData = () => {
    setStateMenuOpen(false);
    downloadBlob(new Blob([serializeBackup(state)], { type: 'application/json' }), backupFilename());
  };

  const shareConfig = async () => {
    setStateMenuOpen(false);
    const shareUrl = preparedShareUrl || await createShareConfigUrl(state);
    const copied = await copyTextToClipboard(shareUrl);
    showSuccessToast(copied ? 'Share link copied.' : 'Copy failed.');
  };

  const resetAppState = () => {
    const confirmed = window.confirm('Reset all hardware, purchase links, presets, and settings to app defaults?');
    if (!confirmed) return;

    const defaultState = structuredClone(defaultAppState);
    setState(defaultState);
    setSelectedId(defaultState.hardwareItems[0]?.id ?? '');
    setSelectedFieldId(null);
    setHoveredFieldId(null);
    setPreviewHardwareItem(null);
    setStateMenuOpen(false);
    showSuccessToast('Reset to defaults.');
  };

  const importPersistedData = async (file: File | undefined) => {
    if (!file) return;

    try {
      const importedState = parseBackup(await file.text());
      const confirmed = window.confirm('Importing this file will replace all hardware, purchase links, presets, and settings. Continue?');
      if (!confirmed) return;

      setState(constrainAppState(importedState));
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
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Browser-only organizer labels</p>
          <h1>Makers Label Generator</h1>
        </div>
        <div className="topbar-actions">
          <fieldset className="standard-filter unit-filter">
            <legend>Units</legend>
            <select value={state.unitSystem} onChange={(event) => updateUnitSystem(event.target.value as AppState['unitSystem'])}>
              <option value="metric">Metric</option>
              <option value="imperial">Imperial</option>
            </select>
          </fieldset>
          <div className="state-menu" ref={stateMenuRef}>
            <button
            className="icon-button"
            type="button"
            aria-label="State actions"
              aria-expanded={stateMenuOpen}
              aria-haspopup="menu"
              onClick={() => setStateMenuOpen((current) => !current)}
            >
              <Settings size={18} />
            </button>
            {stateMenuOpen && (
              <div className="state-menu-panel" role="menu" aria-label="State actions">
                <button type="button" role="menuitem" onClick={resetAppState}>
                  <RotateCcw size={16} />
                  <span>Reset</span>
                  <span className="state-menu-info" aria-hidden="true" data-tooltip="Resets hardware, purchase links, presets, and settings to app defaults.">
                    <Info size={15} />
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setStateMenuOpen(false);
                    importInputRef.current?.click();
                  }}
                >
                  <Upload size={16} />
                  <span>Import</span>
                  <span className="state-menu-info" aria-hidden="true" data-tooltip="Loads a JSON backup and replaces the current app state.">
                    <Info size={15} />
                  </span>
                </button>
                <button type="button" role="menuitem" onClick={exportPersistedData}>
                  <Download size={16} />
                  <span>Export</span>
                  <span className="state-menu-info" aria-hidden="true" data-tooltip="Downloads the current app state as a JSON backup.">
                    <Info size={15} />
                  </span>
                </button>
                <button type="button" role="menuitem" onClick={() => void shareConfig()}>
                  <Link size={16} />
                  <span>Share config</span>
                  <span className="state-menu-info" aria-hidden="true" data-tooltip="Copies a share link containing this configuration. Large configs are gzipped when that makes the link shorter.">
                    <Info size={15} />
                  </span>
                </button>
              </div>
            )}
          </div>
          <input
            ref={importInputRef}
            className="hidden-file-input"
            type="file"
            accept="application/json,.json"
            onChange={handleImportChange}
          />
        </div>
      </header>
    </>
  );
}

const copyTextToClipboard = async (text: string) => {
  const copyTarget = document.createElement('textarea');
  copyTarget.value = text;
  copyTarget.style.position = 'fixed';
  copyTarget.style.left = '0';
  copyTarget.style.top = '0';
  copyTarget.style.width = '1px';
  copyTarget.style.height = '1px';
  copyTarget.style.opacity = '0';
  document.body.appendChild(copyTarget);
  copyTarget.focus();
  copyTarget.select();
  copyTarget.setSelectionRange(0, text.length);

  const copied = document.execCommand('copy');
  document.body.removeChild(copyTarget);
  if (copied) return true;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
