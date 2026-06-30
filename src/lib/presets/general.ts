import { frameField, imageField, makePreset, tapeSizes, textField } from './common';
import type { HardwareCategory } from '../../types';

const allCategories: HardwareCategory[] = ['screw', 'bolt', 'nut', 'washer', 'rivet', 'pin', 'anchor', 'insert', 'clip', 'custom'];
const lengthCategories: HardwareCategory[] = ['screw', 'bolt', 'rivet', 'pin', 'anchor', 'insert', 'custom'];
const threadedCategories: HardwareCategory[] = ['screw', 'bolt', 'nut', 'insert'];

export const generalPresets = [
  makePreset('common-12mm-compact', 'Common 12mm compact', allCategories, tapeSizes.brother12, [
    textField('standard', '{standardIso} {standardDin}', 1.5, 1.5, 20, 3.3, { fontSize: 3, fontWeight: 600 }),
    textField('size', '{size}', 1.5, 5.1, 15, 4.8, { fontSize: 4.8, fontWeight: 800 }),
    textField('material', '{materialType}', 17, 5.4, 17.5, 3.5, { align: 'end', fontSize: 3.1, fontWeight: 700 })
  ], 1),
  makePreset('common-12mm-length', 'Common 12mm length', lengthCategories, tapeSizes.brother12, [
    textField('standard', '{standardIso}', 1.5, 1.5, 14, 3.3, { fontSize: 3, fontWeight: 600 }),
    textField('size', '{size} x {length} {lengthUnit}', 1.5, 5.1, 22, 4.8, { fontSize: 4.5, fontWeight: 800 }),
    textField('material', '{materialType}', 24.5, 5.4, 10, 3.5, { align: 'end', fontSize: 3.1, fontWeight: 700 })
  ], 1),
  makePreset('common-18mm-spec', 'Common 18mm spec', allCategories, tapeSizes.brother18, [
    textField('standard', '{standardIso} {standardDin}', 1.8, 1.8, 46, 3.6, { fontSize: 3.3, fontWeight: 600 }),
    textField('size', '{size} x {length} {lengthUnit}', 1.8, 6.2, 30, 5.4, { fontSize: 5.2, fontWeight: 800 }),
    textField('material', '{material} {materialType} {finish}', 1.8, 12.8, 46, 3.2, { align: 'middle', fontSize: 3, fontWeight: 600 })
  ], 1.2),
  makePreset('common-18mm-drawing', 'Common 18mm drawing', allCategories, tapeSizes.brother18, [
    imageField('drawing', 'side', 1.8, 2.5, 13, 11),
    textField('standard', '{standardIso} {standardDin}', 16, 1.8, 32, 3.6, { align: 'end', fontSize: 3.2, fontWeight: 600 }),
    textField('size', '{size} x {length} {lengthUnit}', 16, 6.1, 32, 5.6, { align: 'end', fontSize: 5, fontWeight: 800 }),
    textField('material', '{materialType} {finish}', 16, 12.8, 32, 3.2, { align: 'end', fontSize: 3, fontWeight: 600 })
  ], 1.2),
  makePreset('common-24mm-stacked', 'Common 24mm stacked', allCategories, tapeSizes.brother24, [
    frameField('frame', tapeSizes.brother24.widthMm, tapeSizes.brother24.heightMm),
    textField('standard', '{standardIso} {standardDin} {standardAsme}', 2, 2.3, 50, 4, { fontSize: 3.7, fontWeight: 600 }),
    textField('size', '{size} x {length} {lengthUnit}', 2, 7, 50, 7, { align: 'middle', fontSize: 6.8, fontWeight: 800 }),
    textField('material', '{material} {materialType}', 2, 15, 50, 3.5, { align: 'middle', fontSize: 3.3, fontWeight: 600 }),
    textField('finish', '{finish}', 2, 19, 50, 3, { align: 'middle', fontSize: 3, fontWeight: 600 })
  ], 1.5),
  makePreset('common-24mm-qr', 'Common 24mm QR', allCategories, tapeSizes.brother24, [
    frameField('frame', tapeSizes.brother24.widthMm, tapeSizes.brother24.heightMm),
    textField('standard', '{standardDin} {standardIso}', 2, 2.3, 32, 4, { fontSize: 3.8, fontWeight: 600 }),
    textField('size', '{size} x {length} {lengthUnit}', 2, 7, 32, 7, { fontSize: 6.8, fontWeight: 800 }),
    textField('material', '{material} {materialType}', 2, 15, 32, 3.5, { fontSize: 3.2, fontWeight: 600 }),
    textField('finish', '{finish}', 2, 19.2, 32, 3, { fontSize: 3, fontWeight: 600 }),
    imageField('qr', 'qr', 37, 3, 15.5, 15.5)
  ], 1.5),
  makePreset('common-24mm-drawing', 'Common 24mm drawing', allCategories, tapeSizes.brother24, [
    frameField('frame', tapeSizes.brother24.widthMm, tapeSizes.brother24.heightMm),
    imageField('drawing', 'side', 2, 3, 14, 12),
    textField('standard', '{standardIso} {standardDin}', 18, 2.5, 33, 3.6, { align: 'end', fontSize: 3.2, fontWeight: 600 }),
    textField('size', '{size} x {length} {lengthUnit}', 18, 6.7, 33, 6, { align: 'end', fontSize: 5.5, fontWeight: 800 }),
    textField('material', '{material} {materialType}', 2, 18.6, 49, 3.3, { align: 'middle', fontSize: 3.1, fontWeight: 600 })
  ], 1.5),
  makePreset('common-imperial-1-2in-compact', 'Common 1/2in compact', allCategories, tapeSizes.imperialHalf, [
    frameField('frame', tapeSizes.imperialHalf.widthMm, tapeSizes.imperialHalf.heightMm, { radius: 1.5, strokeWidth: 0.35 }),
    textField('standard', '{standardAsme} {standardIso}', 1.5, 1.5, 35, 3, { fontSize: 2.8, fontWeight: 600 }),
    textField('size', '{size}', 1.5, 5.1, 14, 4.6, { fontSize: 4.8, fontWeight: 800 }),
    textField('material', '{materialType}', 16, 5.4, 20, 3.5, { align: 'end', fontSize: 3, fontWeight: 700 })
  ], 1),
  makePreset('common-imperial-3-4in-spec', 'Common 3/4in spec', allCategories, tapeSizes.imperialThreeQuarter, [
    textField('standard', '{standardAsme} {standardSae} {standardIso}', 1.8, 1.6, 47, 3.2, { fontSize: 3, fontWeight: 600 }),
    textField('size', '{size} x {length} {lengthUnit}', 1.8, 5.4, 30, 6.2, { fontSize: 6, fontWeight: 800 }),
    textField('material', '{materialType}', 33, 5.7, 16, 5, { align: 'end', fontSize: 4, fontWeight: 800 }),
    textField('finish', '{finish}', 1.8, 13, 47, 3.5, { align: 'middle', fontSize: 3.1, fontWeight: 600 })
  ], 1.2),
  makePreset('common-imperial-1in-qr', 'Common 1in QR', allCategories, tapeSizes.imperialOne, [
    frameField('frame', tapeSizes.imperialOne.widthMm, tapeSizes.imperialOne.heightMm),
    textField('standard', '{standardAsme} {standardAstm}', 2.5, 2.3, 38, 4, { fontSize: 3.7, fontWeight: 600 }),
    textField('size', '{size} x {length} {lengthUnit}', 2.5, 7, 38, 7.5, { fontSize: 7.2, fontWeight: 800 }),
    textField('material', '{material} {materialType}', 2.5, 15.2, 38, 4, { fontSize: 3.6, fontWeight: 600 }),
    textField('finish', '{finish}', 2.5, 19.5, 38, 3.5, { fontSize: 3.2, fontWeight: 600 }),
    imageField('qr', 'qr', 45.5, 3.2, 16.5, 16.5)
  ], 1.5),
  makePreset('threaded-24mm-qr', 'Threaded 24mm QR', threadedCategories, tapeSizes.brother24, [
    frameField('frame', tapeSizes.brother24.widthMm, tapeSizes.brother24.heightMm),
    textField('standard', '{standardDin} {standardIso}', 2, 2.3, 32, 4, { fontSize: 3.8, fontWeight: 600 }),
    textField('size', '{size} x {length} {lengthUnit}', 2, 7, 32, 7, { fontSize: 6.8, fontWeight: 800 }),
    textField('pitch', '{threadPitchName}', 2, 14.6, 21, 4, { fontSize: 3.5, fontWeight: 600 }),
    textField('material', '{material} {materialType}', 2, 18.7, 32, 3.5, { fontSize: 3.2, fontWeight: 600 }),
    imageField('qr', 'qr', 37, 3, 15.5, 15.5),
    textField('class', '{boltClass}', 37.5, 19.2, 15, 3, { align: 'middle', fontSize: 3, fontWeight: 700 })
  ], 1.5)
];
