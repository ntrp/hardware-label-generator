import type { AppBackup, AppState } from '../types';
import { defaultAppState } from './defaults';

const storageKey = 'makers-label-generator:v17';
const backupAppName = 'makers-label-generator';
const backupVersion = 14;

export const loadState = (): AppState => {
  if (typeof localStorage === 'undefined') {
    return defaultAppState;
  }

  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as AppState) : defaultAppState;
  } catch {
    return defaultAppState;
  }
};

export const hasSavedState = () => {
  if (typeof localStorage === 'undefined') return false;

  try {
    return localStorage.getItem(storageKey) !== null;
  } catch {
    return false;
  }
};

export const normalizeState = (state: AppState): AppState => state;

export const saveState = (state: AppState) => {
  localStorage.setItem(storageKey, JSON.stringify(state));
};

export const createBackup = (state: AppState, exportedAt = new Date().toISOString()): AppBackup => ({
  app: backupAppName,
  version: backupVersion,
  exportedAt,
  state
});

export const serializeBackup = (state: AppState) => JSON.stringify(createBackup(state), null, 2);

export const backupFilename = (date = new Date()) => {
  const parts = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  ].map((part) => String(part).padStart(2, '0'));

  return `makers-label-generator-backup-${parts.slice(0, 3).join('-')}-${parts.slice(3).join('-')}.json`;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export const parseBackup = (raw: string): AppState => {
  const parsed = JSON.parse(raw) as unknown;

  if (isRecord(parsed) && parsed.app === backupAppName && parsed.version === backupVersion && isRecord(parsed.state)) {
    return parsed.state as unknown as AppState;
  }

  throw new Error('Invalid backup file.');
};

export const storageMeta = { storageKey, backupAppName, backupVersion };
