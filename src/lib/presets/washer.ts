import { frameField, imageField, makePreset, tapeSizes, textField } from './common';

export const washerPresets = [
  makePreset('washer-brother-24-dimensions', 'Washer 24mm dimensions', ['washer'], tapeSizes.brother24, [
    frameField('frame', tapeSizes.brother24.widthMm, tapeSizes.brother24.heightMm),
    imageField('drawing', 'top', 2, 3, 14, 14),
    textField('standard', '{standardIso} {standardDin}', 18, 2.4, 33, 3.8, { align: 'end', fontSize: 3.4, fontWeight: 600 }),
    textField('size', '{size}', 18, 6.8, 14, 6.5, { fontSize: 6.3, fontWeight: 800 }),
    textField('diameters', 'ID {innerDiameter}  OD {outerDiameter}', 18, 13.6, 33, 3.8, { align: 'end', fontSize: 3.3, fontWeight: 700 }),
    textField('thickness', '{thickness}  {material}', 2, 19, 49, 3.2, { align: 'middle', fontSize: 3.2, fontWeight: 600 })
  ], 1.2)
];
