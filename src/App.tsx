import { useEffect, useRef, useState } from 'react';
import { AppStateProvider } from './app/AppStateContext';
import { SuccessToast } from './components/AppFeedback';
import { AppTopbar } from './components/AppTopbar';
import { HardwareFiltersPanel } from './components/HardwareFiltersPanel';
import { HardwareListPanel } from './components/HardwareListPanel';
import { HardwareSpecsPanel } from './components/HardwareSpecsPanel';
import { LabelDesignPanel } from './components/LabelDesignPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { constrainLabelSettings } from './lib/labelLayout';
import { loadState, saveState } from './lib/storage';
import type { AppState, HardwareItem } from './types';

export function App() {
  const [state, setState] = useState<AppState>(() => {
    const loadedState = loadState();
    return {
      ...loadedState,
      labelSettings: constrainLabelSettings(loadedState.labelSettings)
    };
  });
  const [selectedId, setSelectedId] = useState(state.hardwareItems[0]?.id ?? '');
  const [previewHardwareItem, setPreviewHardwareItem] = useState<HardwareItem | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState('');
  const successToastTimeoutRef = useRef<number | null>(null);
  const selectedItem = state.hardwareItems.find((item) => item.id === selectedId) ?? state.hardwareItems[0];

  useEffect(() => {
    const saveTimeout = window.setTimeout(() => saveState(state), 200);
    return () => window.clearTimeout(saveTimeout);
  }, [state]);

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

        {successToast && <SuccessToast message={successToast} />}
      </main>
    </AppStateProvider>
  );
}
