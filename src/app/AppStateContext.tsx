import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppState } from '../types';

interface AppStateContextValue {
  hoveredFieldId: string | null;
  selectedFieldId: string | null;
  selectedId: string;
  setHoveredFieldId: Dispatch<SetStateAction<string | null>>;
  setSelectedFieldId: Dispatch<SetStateAction<string | null>>;
  setSelectedId: Dispatch<SetStateAction<string>>;
  setState: Dispatch<SetStateAction<AppState>>;
  showSuccessToast: (message: string) => void;
  state: AppState;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export const AppStateProvider = AppStateContext.Provider;

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used inside AppStateProvider');
  }

  return context;
}
