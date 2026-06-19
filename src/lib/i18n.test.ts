import { describe, expect, it } from 'vitest';
import { displayValue } from './i18n';

describe('i18n display helpers', () => {
  it('preserves unit casing in display values', () => {
    expect(displayValue('en', 'mm')).toBe('mm');
    expect(displayValue('en', 'in')).toBe('in');
    expect(displayValue('en', 'TPI')).toBe('TPI');
    expect(displayValue('en', 'coarse (0.5 mm)')).toBe('Coarse (0.5 mm)');
  });
});
