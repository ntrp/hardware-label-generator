import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Download, Github, Info, LifeBuoy, Link, RotateCcw, Ruler, Settings, Tags, Upload } from 'lucide-react';
import { useAppState } from '../app/AppStateContext';
import { constrainAppState } from '../lib/appState';
import { downloadBlob } from '../lib/export';
import { defaultAppState } from '../lib/defaults';
import { createShareConfigUrl } from '../lib/shareConfig';
import { syncHardwareSpecs } from '../lib/specs';
import { backupFilename, parseBackup, serializeBackup } from '../lib/storage';
import { localeOptions, useI18n } from '../lib/i18n';
import { getCatalogEntryForItem } from './hardware/hardwareLogic';
import type { AppLocale, AppState } from '../types';

export function AppTopbar() {
  const { selectedId, setHoveredFieldId, setPreviewHardwareItem, setSelectedFieldId, setSelectedId, setState, showSuccessToast, state } = useAppState();
  const { t } = useI18n();
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
    showSuccessToast(copied ? t('shareCopied') : t('copyFailed'));
  };

  const resetAppState = () => {
    const confirmed = window.confirm(t('resetConfirm'));
    if (!confirmed) return;

    const defaultState = structuredClone(defaultAppState);
    setState(defaultState);
    setSelectedId(defaultState.hardwareItems[0]?.id ?? '');
    setSelectedFieldId(null);
    setHoveredFieldId(null);
    setPreviewHardwareItem(null);
    setStateMenuOpen(false);
    showSuccessToast(t('resetDone'));
  };

  const importPersistedData = async (file: File | undefined) => {
    if (!file) return;

    try {
      const importedState = parseBackup(await file.text());
      const confirmed = window.confirm(t('importConfirm'));
      if (!confirmed) return;

      setState(constrainAppState(importedState));
      setSelectedId(importedState.hardwareItems[0]?.id ?? '');
      setSelectedFieldId(null);
      setHoveredFieldId(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('importError'));
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

  const updateLocale = (locale: AppLocale) => {
    setState((current) => ({
      ...current,
      locale
    }));
  };

  return (
    <>
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <Tags size={20} />
          </span>
          <div className="brand-copy">
            <div className="brand-title-row">
              <h1>{t('appName')}</h1>
              <span className="version-badge">{t('beta')}</span>
            </div>
            <p className="eyebrow">{t('tagline')}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <a className="topbar-action-link" href="https://github.com/ntrp/hardware-label-generator" target="_blank" rel="noreferrer">
            <Github size={16} />
            {t('github')}
          </a>
          <a className="topbar-action-link" href="https://github.com/ntrp/hardware-label-generator/issues/new" target="_blank" rel="noreferrer">
            <LifeBuoy size={16} />
            {t('reportIssue')}
          </a>
          <span className="select-with-icon unit-select-control">
            <Ruler size={16} aria-hidden="true" />
            <select
              className="unit-filter"
              aria-label={t('units')}
              value={state.unitSystem}
              onChange={(event) => updateUnitSystem(event.target.value as AppState['unitSystem'])}
            >
              <option value="metric">mm {t('metric')}</option>
              <option value="imperial">in {t('imperial')}</option>
            </select>
          </span>
          <select
            className="locale-filter"
            aria-label={t('language')}
            value={state.locale}
            onChange={(event) => updateLocale(event.target.value as AppLocale)}
          >
            {localeOptions.map((option) => (
              <option key={option.locale} value={option.locale}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="state-menu" ref={stateMenuRef}>
            <button
              className="icon-button"
              type="button"
              aria-label={t('settings')}
              aria-expanded={stateMenuOpen}
              aria-haspopup="menu"
              onClick={() => setStateMenuOpen((current) => !current)}
            >
              <Settings size={18} />
            </button>
            {stateMenuOpen && (
              <div className="state-menu-panel" role="menu" aria-label={t('settings')}>
                <button type="button" role="menuitem" onClick={resetAppState}>
                  <RotateCcw size={16} />
                  <span>{t('reset')}</span>
                  <span className="state-menu-info" aria-hidden="true" data-tooltip={t('resetTooltip')}>
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
                  <span>{t('import')}</span>
                  <span className="state-menu-info" aria-hidden="true" data-tooltip={t('importTooltip')}>
                    <Info size={15} />
                  </span>
                </button>
                <button type="button" role="menuitem" onClick={exportPersistedData}>
                  <Download size={16} />
                  <span>{t('export')}</span>
                  <span className="state-menu-info" aria-hidden="true" data-tooltip={t('exportTooltip')}>
                    <Info size={15} />
                  </span>
                </button>
                <button type="button" role="menuitem" onClick={() => void shareConfig()}>
                  <Link size={16} />
                  <span>{t('shareConfig')}</span>
                  <span className="state-menu-info" aria-hidden="true" data-tooltip={t('shareTooltip')}>
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
