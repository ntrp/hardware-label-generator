import type { AppState, HardwareItem, LabelSettings } from '../types';
import { constrainLabelSettings, isBuiltInPresetId, presetAppliesToCategory, presetToLabelSettings } from './labelLayout';
import { builtInLabelPresets } from './presets';
import { categoryDefaultPreset } from './specs';
import { normalizeLocale } from './i18n';

export const constrainHardwareItemLabelSettings = (item: HardwareItem): HardwareItem => ({
  ...item,
  labelSettings: constrainLabelSettings(item.labelSettings)
});

export const constrainAppState = (state: AppState): AppState => ({
  ...state,
  locale: normalizeLocale(state.locale),
  labelSettings: constrainLabelSettings(state.labelSettings),
  hardwareItems: state.hardwareItems.map(constrainHardwareItemLabelSettings)
});

export const categoryLabelSettings = (state: AppState, category: HardwareItem['category'], fallback: LabelSettings) => {
  const presets = [...state.customPresets, ...Object.values(builtInLabelPresets)];
  const preset =
    presets.find((candidate) => candidate.id === categoryDefaultPreset[category] && presetAppliesToCategory(candidate, category)) ??
    presets.find((candidate) => presetAppliesToCategory(candidate, category));
  return preset ? constrainLabelSettings(presetToLabelSettings(preset, isBuiltInPresetId(preset.id))) : fallback;
};
