import { describe, expect, it } from 'vitest';

import { findMetricThreadPitch, metricThreadPitchNamesForSize, metricThreadSizes } from './metricThreads';

describe('metric thread pitch table', () => {
  it('includes the M sizes from the Fastener Experts DIN metric pitch table', () => {
    expect(metricThreadSizes).toEqual(expect.arrayContaining(['M1', 'M1.6', 'M3', 'M10', 'M64', 'M100']));
  });

  it('names coarse, fine, and extra fine pitch values for a size', () => {
    expect(metricThreadPitchNamesForSize('M10')).toEqual(['coarse (1.50 mm)', 'fine (1.25 mm)', 'extra fine (1.00 mm)', 'extra fine 2 (0.75 mm)']);
    expect(findMetricThreadPitch('M10', 'extra fine (1.00 mm)')).toEqual({ size: 'M10', name: 'extra fine', value: '1.00' });
  });
});
