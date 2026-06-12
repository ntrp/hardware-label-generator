import { describe, expect, it } from 'vitest';

import { getMaterialTreatmentOptions, isValidMaterialTreatment } from './materials';

describe('material treatment compatibility', () => {
  it('allows only treatments valid for the selected base material', () => {
    expect(getMaterialTreatmentOptions('stainless steel')).toEqual(expect.arrayContaining(['A2', 'A4', '316']));
    expect(isValidMaterialTreatment('stainless steel', 'A2')).toBe(true);
    expect(isValidMaterialTreatment('brass', 'A2')).toBe(false);
    expect(isValidMaterialTreatment('steel', 'hot-dip galvanized')).toBe(true);
    expect(isValidMaterialTreatment('nylon', 'zinc plated')).toBe(false);
  });
});
