import { describe, expect, it } from 'vitest';

import { defaultImperialThreadPitch, findImperialThreadPitch, imperialThreadPitchNamesForSize } from './imperialThreads';

describe('imperial thread pitch table', () => {
  it('maps common ASME nominal sizes to UNC and UNF TPI values', () => {
    expect(imperialThreadPitchNamesForSize('1/4"')).toEqual(['UNC (20 TPI)', 'UNF (28 TPI)']);
    expect(imperialThreadPitchNamesForSize('5/16"')).toEqual(['UNC (18 TPI)', 'UNF (24 TPI)']);
    expect(imperialThreadPitchNamesForSize('3/8"')).toEqual(['UNC (16 TPI)', 'UNF (24 TPI)']);
    expect(imperialThreadPitchNamesForSize('1"')).toEqual(['UNC (8 TPI)', 'UNF (12 TPI)']);
  });

  it('uses the TPI suffix in combined size strings to choose the matching series', () => {
    expect(imperialThreadPitchNamesForSize('1/4-20')).toEqual(['UNC (20 TPI)']);
    expect(imperialThreadPitchNamesForSize('1/4-28')).toEqual(['UNF (28 TPI)']);
    expect(imperialThreadPitchNamesForSize('#10-24')).toEqual(['UNC (24 TPI)']);
    expect(imperialThreadPitchNamesForSize('#10-32')).toEqual(['UNF (32 TPI)']);
  });

  it('finds pitches by formatted label, series name, or TPI value', () => {
    expect(findImperialThreadPitch('1/2"', 'UNF (20 TPI)')).toEqual({ size: '1/2"', series: 'UNF', tpi: '20' });
    expect(findImperialThreadPitch('1/2"', 'UNC')).toEqual({ size: '1/2"', series: 'UNC', tpi: '13' });
    expect(findImperialThreadPitch('1/2"', '20 TPI')).toEqual({ size: '1/2"', series: 'UNF', tpi: '20' });
  });

  it('defaults to the coarse unified series where it exists', () => {
    expect(defaultImperialThreadPitch('3/8"')).toEqual({ size: '3/8"', series: 'UNC', tpi: '16' });
  });
});
