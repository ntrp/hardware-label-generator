import { useEffect, useRef, useState } from 'react';
import { AppStateProvider } from './app/AppStateContext';
import { SuccessToast } from './components/AppFeedback';
import { AppFooter } from './components/AppFooter';
import { AppTopbar } from './components/AppTopbar';
import { HardwareFiltersPanel } from './components/HardwareFiltersPanel';
import { HardwareListPanel } from './components/HardwareListPanel';
import { HardwareSpecsPanel } from './components/HardwareSpecsPanel';
import { LabelDesignPanel } from './components/LabelDesignPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { downloadBlob } from './lib/export';
import { constrainAppState } from './lib/appState';
import { clearShareConfigFromUrl, parseShareConfigPayload, sharedConfigPayloadFromLocation } from './lib/shareConfig';
import { backupFilename, hasSavedState, loadState, saveState, serializeBackup } from './lib/storage';
import type { AppState, HardwareItem } from './types';
import { X } from 'lucide-react';

export function App() {
  const [hadSavedStateOnLoad] = useState(() => hasSavedState());
  const [state, setState] = useState<AppState>(() => {
    const loadedState = loadState();
    return constrainAppState(loadedState);
  });
  const [selectedId, setSelectedId] = useState(state.hardwareItems[0]?.id ?? '');
  const [previewHardwareItem, setPreviewHardwareItem] = useState<HardwareItem | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState('');
  const [pendingSharedState, setPendingSharedState] = useState<AppState | null>(null);
  const successToastTimeoutRef = useRef<number | null>(null);
  const sharePayloadHandledRef = useRef(false);
  const selectedItem = state.hardwareItems.find((item) => item.id === selectedId) ?? state.hardwareItems[0];

  useEffect(() => {
    const saveTimeout = window.setTimeout(() => saveState(state), 200);
    return () => window.clearTimeout(saveTimeout);
  }, [state]);

  useEffect(() => {
    if (sharePayloadHandledRef.current) return;

    const payload = sharedConfigPayloadFromLocation();
    if (!payload) return;
    sharePayloadHandledRef.current = true;

    const loadSharedConfig = async () => {
      try {
        const importedState = await parseShareConfigPayload(payload);
        if (hadSavedStateOnLoad) {
          setPendingSharedState(constrainAppState(importedState));
          return;
        }

        applySharedState(constrainAppState(importedState), 'Shared config loaded.');
      } catch (error) {
        clearShareConfigFromUrl();
        showSuccessToast(error instanceof Error ? error.message : 'Unable to load shared config.');
      }
    };

    void loadSharedConfig();
  }, []);

  useEffect(
    () => () => {
      if (successToastTimeoutRef.current) {
        window.clearTimeout(successToastTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    setPreviewHardwareItem(null);
  }, [selectedId]);

  const showSuccessToast = (message: string) => {
    setSuccessToast(message);

    if (successToastTimeoutRef.current) {
      window.clearTimeout(successToastTimeoutRef.current);
    }

    successToastTimeoutRef.current = window.setTimeout(() => {
      setSuccessToast('');
      successToastTimeoutRef.current = null;
    }, 2400);
  };

  const applySharedState = (sharedState: AppState, message: string) => {
    setState(sharedState);
    setSelectedId(sharedState.hardwareItems[0]?.id ?? '');
    setSelectedFieldId(null);
    setHoveredFieldId(null);
    setPreviewHardwareItem(null);
    setPendingSharedState(null);
    clearShareConfigFromUrl();
    showSuccessToast(message);
  };

  const closeSharedConfigModal = () => {
    setPendingSharedState(null);
    clearShareConfigFromUrl();
  };

  const backupAndLoadSharedConfig = () => {
    downloadBlob(new Blob([serializeBackup(state)], { type: 'application/json' }), backupFilename());
    if (pendingSharedState) {
      applySharedState(pendingSharedState, 'Backup downloaded. Shared config loaded.');
    }
  };

  if (!selectedItem) {
    return <main className="app-shell">No hardware item available.</main>;
  }

  return (
    <AppStateProvider
      value={{
        hoveredFieldId,
        selectedFieldId,
        selectedId,
        previewHardwareItem,
        setHoveredFieldId,
        setPreviewHardwareItem,
        setSelectedFieldId,
        setSelectedId,
        setState,
        showSuccessToast,
        state
      }}
    >
      <main className="app-shell">
        <AppTopbar />

        <section className="workspace">
          <HardwareListPanel />

          <section className="editor-stack">
            <HardwareFiltersPanel />
            <HardwareSpecsPanel />
            <LabelDesignPanel />
          </section>

          <PreviewPanel />
        </section>

        <AppFooter />

        {successToast && <SuccessToast message={successToast} />}
        {pendingSharedState && (
          <SharedConfigModal
            onClose={closeSharedConfigModal}
            onLoad={() => applySharedState(pendingSharedState, 'Shared config loaded.')}
            onBackupAndLoad={backupAndLoadSharedConfig}
          />
        )}
      </main>
    </AppStateProvider>
  );
}

interface SharedConfigModalProps {
  onClose: () => void;
  onLoad: () => void;
  onBackupAndLoad: () => void;
}

function SharedConfigModal({ onClose, onLoad, onBackupAndLoad }: SharedConfigModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal-panel share-load-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-load-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="share-load-title">Load shared config</h2>
            <p className="modal-subtitle">This link contains a shared configuration. Loading it replaces the current app state.</p>
          </div>
          <button type="button" className="icon-button small" aria-label="Close shared config" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onBackupAndLoad}>
            Backup and load
          </button>
          <button type="button" onClick={onLoad}>
            Load
          </button>
        </div>
      </div>
    </div>
  );
}
