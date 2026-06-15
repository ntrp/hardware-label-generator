import { describe, expect, it } from 'vitest';

import { getBoltClassOptions, isValidBoltClass } from './boltClasses';

describe('bolt class compatibility', () => {
  it('offers only ISO property classes supported by the metric size', () => {
    expect(getBoltClassOptions({ size: 'M1', material: 'steel', materialType: 'zinc plated', unitSystem: 'metric' })).toEqual([]);
    expect(getBoltClassOptions({ size: 'M3', material: 'steel', materialType: 'zinc plated', unitSystem: 'metric' })).toEqual(
      expect.arrayContaining(['3.6', '4.8', '8.8', '9.8', '12.9'])
    );
    expect(getBoltClassOptions({ size: 'M3', material: 'steel', materialType: 'zinc plated', unitSystem: 'metric' })).not.toEqual(
      expect.arrayContaining(['4.6', '5.8', '10.9'])
    );
    expect(getBoltClassOptions({ size: 'M10', material: 'steel', materialType: 'zinc plated', unitSystem: 'metric' })).toEqual(
      expect.arrayContaining(['4.6', '5.8', '8.8', '10.9', '12.9'])
    );
    expect(getBoltClassOptions({ size: 'M42', material: 'steel', materialType: 'zinc plated', unitSystem: 'metric' })).toEqual([]);
  });

  it('offers SAE grades only for supported inch sizes', () => {
    expect(getBoltClassOptions({ size: '#10', material: 'steel', materialType: 'zinc plated', unitSystem: 'imperial' })).toEqual([]);
    expect(getBoltClassOptions({ size: '1/4"', material: 'steel', materialType: 'zinc plated', unitSystem: 'imperial' })).toEqual(
      expect.arrayContaining(['grade 2', 'grade 5', 'grade 8'])
    );
    expect(getBoltClassOptions({ size: '2"', material: 'steel', materialType: 'zinc plated', unitSystem: 'imperial' })).toEqual([]);
  });

  it('derives stainless classes from the selected stainless family', () => {
    expect(getBoltClassOptions({ size: 'M3', material: 'stainless steel', materialType: 'A2', unitSystem: 'metric' })).toEqual(['A2-50', 'A2-70', 'A2-80']);
    expect(getBoltClassOptions({ size: 'M1', material: 'stainless steel', materialType: 'A2', unitSystem: 'metric' })).toEqual([]);
    expect(getBoltClassOptions({ size: '1/4"', material: 'stainless steel', materialType: 'A2', unitSystem: 'imperial' })).toEqual([]);
    expect(isValidBoltClass({ size: 'M3', material: 'brass', materialType: 'plain', boltClass: '8.8', unitSystem: 'metric' })).toBe(false);
    expect(isValidBoltClass({ size: 'M3', material: 'stainless steel', materialType: 'A4', boltClass: 'A4-80', unitSystem: 'metric' })).toBe(true);
  });
});
