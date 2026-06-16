import { describe, expect, it } from 'vitest';
import { defaultAppState, defaultLabelSettings } from './defaults';
import { constrainLabelSettings, labelPresetIdentityForSettings, labelPresetNameForSettings } from './labelLayout';

describe('label layout helpers', () => {
  it('resolves the active label preset name and identity from settings', () => {
    const settings = constrainLabelSettings(defaultLabelSettings);

    expect(labelPresetNameForSettings(settings, [], defaultAppState.unitSystem)).toBe('QR sidecar');
    expect(labelPresetIdentityForSettings(settings, [], defaultAppState.unitSystem)).toBe('preset:qr-sidecar:QR sidecar');
  });

  it('uses a modified preset identity when settings do not match a saved preset', () => {
    const settings = { ...defaultLabelSettings, widthMm: defaultLabelSettings.widthMm + 1 };

    expect(labelPresetNameForSettings(settings, [], defaultAppState.unitSystem)).toBe('Modified preset 55 × 30 mm');
    expect(labelPresetIdentityForSettings(settings, [], defaultAppState.unitSystem)).toContain('modified:Modified preset 55 × 30 mm:');
  });
});
