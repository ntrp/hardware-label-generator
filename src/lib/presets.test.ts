import { describe, expect, it } from 'vitest';
import { builtInLabelPresets, defaultPresetId } from './presets';
import { categoryDefaultPreset } from './specs';
import { minElementHeightMm, minElementWidthMm, presetAppliesToCategory, presetMatchesSettings, presetToLabelSettings } from './labelLayout';
import type { HardwareCategory, ImageSource } from '../types';

const validImageSources: ImageSource[] = ['qr', 'iso', 'side', 'top', 'custom'];
const categories: HardwareCategory[] = ['screw', 'bolt', 'nut', 'washer', 'rivet', 'pin', 'anchor', 'insert', 'clip', 'custom'];

describe('built-in label presets', () => {
  it('exports a balanced preset library from the preset index', () => {
    const presets = Object.values(builtInLabelPresets);
    expect(presets).toHaveLength(14);
    expect(builtInLabelPresets[defaultPresetId]).toBeDefined();
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(presets.length);
    expect(presets.filter((preset) => preset.categories.length > 1).length).toBeGreaterThanOrEqual(10);
  });

  it('keeps category defaults valid and applicable', () => {
    for (const category of categories) {
      const preset = builtInLabelPresets[categoryDefaultPreset[category]];
      expect(preset, `${category} default preset`).toBeDefined();
      expect(presetAppliesToCategory(preset, category), `${category} default applicability`).toBe(true);
    }
  });

  it('keeps fields valid and inside preset bounds', () => {
    for (const preset of Object.values(builtInLabelPresets)) {
      expect(preset.widthMm, `${preset.id} width`).toBeGreaterThan(0);
      expect(preset.heightMm, `${preset.id} height`).toBeGreaterThan(0);
      expect(preset.tapeWidthMm, `${preset.id} tape width`).toBeGreaterThan(0);
      expect(preset.marginMm, `${preset.id} margin`).toBeGreaterThanOrEqual(0);
      expect(preset.fields.length, `${preset.id} fields`).toBeGreaterThan(0);

      for (const field of preset.fields) {
        expect(['text', 'image', 'frame'], `${preset.id} ${field.id} kind`).toContain(field.kind);
        expect(field.style.visible, `${preset.id} ${field.id} visible`).toBeTypeOf('boolean');

        if (field.kind === 'frame') {
          expect(field.frameStyle, `${preset.id} ${field.id} frame style`).toBeDefined();
          expect(['box', 'rounded'], `${preset.id} ${field.id} frame shape`).toContain(field.frameStyle?.shape);
          expect(['solid', 'dashed', 'dotted'], `${preset.id} ${field.id} line style`).toContain(field.frameStyle?.lineStyle);
          continue;
        }

        expect(field.x, `${preset.id} ${field.id} x`).toBeGreaterThanOrEqual(0);
        expect(field.y, `${preset.id} ${field.id} y`).toBeGreaterThanOrEqual(0);
        expect(field.width, `${preset.id} ${field.id} width`).toBeGreaterThanOrEqual(minElementWidthMm);
        expect(field.height, `${preset.id} ${field.id} height`).toBeGreaterThanOrEqual(minElementHeightMm);
        expect(field.x + field.width, `${preset.id} ${field.id} x bounds`).toBeLessThanOrEqual(preset.widthMm);
        expect(field.y + field.height, `${preset.id} ${field.id} y bounds`).toBeLessThanOrEqual(preset.heightMm);

        if (field.kind === 'image') {
          expect(validImageSources, `${preset.id} ${field.id} image source`).toContain(field.imageSource);
        }
      }
    }
  });

  it('matches built-in presets through label settings', () => {
    for (const preset of Object.values(builtInLabelPresets)) {
      expect(presetMatchesSettings(preset, presetToLabelSettings(preset, true)), preset.id).toBe(true);
    }
  });
});
