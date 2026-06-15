import { describe, expect, it } from 'vitest';

import { getFinishOptions, getMaterialTreatmentOptions, isValidFinish, isValidMaterialTreatment } from './materials';

describe('material treatment compatibility', () => {
  it('allows only treatments valid for the selected base material', () => {
    expect(getMaterialTreatmentOptions('stainless steel')).toEqual(expect.arrayContaining(['A2', 'A4', '316']));
    expect(getMaterialTreatmentOptions('nickel alloy')).toEqual(expect.arrayContaining(['inconel', 'monel', 'hastelloy']));
    expect(getMaterialTreatmentOptions('peek')).toEqual(['peek']);
    expect(getMaterialTreatmentOptions('ceramic')).toEqual(expect.arrayContaining(['alumina', 'zirconia']));
    expect(isValidMaterialTreatment('stainless steel', 'A2')).toBe(true);
    expect(isValidMaterialTreatment('brass', 'A2')).toBe(false);
    expect(isValidMaterialTreatment('steel', 'hot-dip galvanized')).toBe(false);
    expect(isValidMaterialTreatment('nylon', 'zinc plated')).toBe(false);
  });

  it('allows only finishes valid for the selected base material', () => {
    expect(getFinishOptions('steel')).toEqual(expect.arrayContaining(['zinc plated', 'hot-dip galvanized', 'black oxide']));
    expect(getFinishOptions('aluminum')).toEqual(expect.arrayContaining(['anodized', 'clear anodized', 'black anodized']));
    expect(getFinishOptions('nylon')).toEqual(['natural', 'black']);
    expect(isValidFinish('steel', 'zinc plated')).toBe(true);
    expect(isValidFinish('nylon', 'zinc plated')).toBe(false);
    expect(isValidFinish('aluminum', 'hot-dip galvanized')).toBe(false);
  });
});
