import type { LabelPreset } from '../../types';
import { anchorPresets } from './anchor';
import { boltPresets } from './bolt';
import { clipPresets } from './clip';
import { customPresets } from './custom';
import { generalPresets } from './general';
import { insertPresets } from './insert';
import { nutPresets } from './nut';
import { pinPresets } from './pin';
import { rivetPresets } from './rivet';
import { screwPresets } from './screw';
import { washerPresets } from './washer';

export const defaultPresetId = 'common-24mm-qr';

const presets = [
  ...generalPresets,
  ...screwPresets,
  ...boltPresets,
  ...nutPresets,
  ...washerPresets,
  ...rivetPresets,
  ...pinPresets,
  ...anchorPresets,
  ...insertPresets,
  ...clipPresets,
  ...customPresets
];

export const builtInLabelPresets = Object.fromEntries(presets.map((preset) => [preset.id, preset])) as Record<string, LabelPreset>;
