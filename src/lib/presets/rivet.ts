import { makePreset, tapeSizes, textField } from './common';

export const rivetPresets = [
  makePreset('rivet-brother-18-grip', 'Rivet 18mm grip', ['rivet'], tapeSizes.brother18, [
    textField('standard', '{standardIso} {standardDin}', 1.8, 1.8, 46, 3.6, { fontSize: 3.3, fontWeight: 600 }),
    textField('size', '{size} x {length} {lengthUnit}', 1.8, 6.2, 30, 5.4, { fontSize: 5.2, fontWeight: 800 }),
    textField('grip', 'Grip {gripRange}', 32, 6.6, 16, 4.2, { align: 'end', fontSize: 3.7, fontWeight: 700 }),
    textField('material', '{material}  {finish}', 1.8, 12.8, 46, 3.2, { align: 'middle', fontSize: 3, fontWeight: 600 })
  ], 1.2)
];
