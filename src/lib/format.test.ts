import { describe, expect, it } from 'vitest';
import { defaultHardwareItem } from './defaults';
import { formatLabelSize, formatLength, parseList, renderTextTemplate, safeFilePart } from './format';

describe('format helpers', () => {
  it('parses comma, semicolon, and newline lists', () => {
    expect(parseList('M2, M3\nM4; M5')).toEqual(['M2', 'M3', 'M4', 'M5']);
  });

  it('formats split length values and units', () => {
    expect(formatLength('12', 'mm')).toBe('12 mm');
    expect(formatLength('1/2', 'in')).toBe('1/2 in');
    expect(formatLength('standard', '')).toBe('standard');
  });

  it('formats label dimensions in the active unit system', () => {
    expect(formatLabelSize(54, 30, 'metric')).toBe('54 × 30 mm');
    expect(formatLabelSize(54, 30, 'imperial')).toBe('2.13 × 1.18 in');
  });

  it('renders text templates with standard and spec placeholders', () => {
    expect(renderTextTemplate('{standard}', defaultHardwareItem, 'metric')).toBe('ISO 4762');
    expect(renderTextTemplate('{standard}', { ...defaultHardwareItem, standardCodes: { SAE: 'SAE J429' }, standard: 'Fallback standard' }, 'imperial')).toBe('SAE J429');
    expect(renderTextTemplate('{standard}', { ...defaultHardwareItem, standardCodes: {}, standard: 'Fallback standard' }, 'metric')).toBe('Fallback standard');
    expect(renderTextTemplate('{standardDin} {standardIso} {size} x {length} {lengthUnit} ({threadPitch} {threadPitchUnit}, {material}, {materialType}, {boltClass})', defaultHardwareItem, 'metric')).toBe(
      'DIN 912 ISO 4762 M3 x 12 mm (0.5 mm, stainless steel, A2, A2-70)'
    );
    expect(renderTextTemplate('{length}', defaultHardwareItem, 'metric')).toBe('12');
    expect(renderTextTemplate('{lengthUnit}', defaultHardwareItem, 'metric')).toBe('mm');
    expect(renderTextTemplate('{threadPitch}', { ...defaultHardwareItem, threadPitch: '20', threadPitchUnit: 'TPI' }, 'imperial')).toBe('20');
    expect(renderTextTemplate('{threadPitchUnit}', { ...defaultHardwareItem, threadPitch: '20', threadPitchUnit: 'TPI' }, 'imperial')).toBe('TPI');
  });

  it('creates safe file names', () => {
    expect(safeFilePart('DIN 912 / ISO 4762 M3 A2')).toBe('din-912-iso-4762-m3-a2');
  });
});
