import { imageField, makePreset, tapeSizes, textField } from './common';

export const clipPresets = [
  makePreset('clip-brother-12-compact', 'Clip 12mm compact', ['clip'], tapeSizes.brother12, [
    textField('standard', '{standardIso} {standardDin}', 1.5, 1.5, 22, 3.2, { fontSize: 2.9, fontWeight: 600 }),
    textField('size', '{size}', 1.5, 5.2, 15, 4.5, { fontSize: 4.6, fontWeight: 800 }),
    textField('material', '{material}', 16.5, 5.5, 10, 3.3, { fontSize: 3, fontWeight: 700 }),
    imageField('drawing', 'side', 28, 2.3, 6.5, 7)
  ], 1)
];
