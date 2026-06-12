import { describe, expect, it } from 'vitest';

import { getBoltClassOptions, isValidBoltClass } from './boltClasses';

describe('bolt class compatibility', () => {
  it('offers ISO classes for metric steel and SAE grades for imperial steel', () => {
    expect(getBoltClassOptions({ material: 'steel', materialType: 'zinc plated', unitSystem: 'metric' })).toEqual(
      expect.arrayContaining(['3.6', '4.6', '4.8', '5.8', '8.8', '10.9', '12.9'])
    );
    expect(getBoltClassOptions({ material: 'steel', materialType: 'zinc plated', unitSystem: 'imperial' })).toEqual(
      expect.arrayContaining(['grade 2', 'grade 5', 'grade 8'])
    );
  });

  it('derives stainless classes from the selected stainless family', () => {
    expect(getBoltClassOptions({ material: 'stainless steel', materialType: 'A2', unitSystem: 'metric' })).toEqual(['A2-50', 'A2-70', 'A2-80']);
    expect(isValidBoltClass({ material: 'brass', materialType: 'plain', boltClass: '8.8', unitSystem: 'metric' })).toBe(false);
    expect(isValidBoltClass({ material: 'stainless steel', materialType: 'A4', boltClass: 'A4-80', unitSystem: 'metric' })).toBe(true);
  });
});
