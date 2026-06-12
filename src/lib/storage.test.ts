import { describe, expect, it } from 'vitest';
import { defaultAppState } from './defaults';
import { createBackup, normalizeState, parseBackup, serializeBackup } from './storage';

describe('storage', () => {
  it('keeps current schema state unchanged', () => {
    expect(normalizeState(defaultAppState)).toBe(defaultAppState);
  });

  it('preserves custom presets with label size and fields', () => {
    const normalized = normalizeState({
      ...defaultAppState,
      customPresets: [
        {
          id: 'preset-wide',
          name: 'Wide bin',
          categories: ['screw'],
          widthMm: 80,
          heightMm: 20,
          tapeWidthMm: 24,
          marginMm: 2,
          fields: defaultAppState.labelSettings.fields
        }
      ]
    });

    expect(normalized.customPresets[0].name).toBe('Wide bin');
    expect(normalized.customPresets[0].widthMm).toBe(80);
    expect(normalized.customPresets[0].heightMm).toBe(20);
    expect(normalized.customPresets[0].fields).toHaveLength(defaultAppState.labelSettings.fields.length);
  });

  it('exports and imports the full persisted state as a backup', () => {
    const backup = createBackup(defaultAppState, '2026-06-12T00:00:00.000Z');
    const imported = parseBackup(JSON.stringify(backup));

    expect(backup.app).toBe('standalone-fastener-label-generator');
    expect(backup.version).toBe(8);
    expect(backup.exportedAt).toBe('2026-06-12T00:00:00.000Z');
    expect(imported.hardwareItems).toEqual(defaultAppState.hardwareItems);
    expect(imported.purchaseLinks).toEqual(defaultAppState.purchaseLinks);
    expect(imported.labelSettings).toEqual(defaultAppState.labelSettings);
    expect(imported.customPresets).toEqual(defaultAppState.customPresets);
  });

  it('rejects invalid backup files', () => {
    expect(() => parseBackup('{"not":"a backup"}')).toThrow('Invalid backup file');
  });
});
