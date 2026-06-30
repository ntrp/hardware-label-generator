import type { FieldStyle, FrameStyle, HardwareCategory, ImageSource, LabelPreset, PlacedField } from '../../types';

export const tapeSizes = {
  brother12: { widthMm: 36, heightMm: 12, tapeWidthMm: 12 },
  brother18: { widthMm: 50, heightMm: 18, tapeWidthMm: 18 },
  brother24: { widthMm: 54, heightMm: 24, tapeWidthMm: 24 },
  imperialHalf: { widthMm: 38.1, heightMm: 12.7, tapeWidthMm: 12.7 },
  imperialThreeQuarter: { widthMm: 50.8, heightMm: 19.05, tapeWidthMm: 19.05 },
  imperialOne: { widthMm: 63.5, heightMm: 25.4, tapeWidthMm: 25.4 }
} as const;

export const presetTextStyle: FieldStyle = {
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: 4,
  fontWeight: 700,
  align: 'start',
  visible: true
};

export const presetFrameStyle: FrameStyle = {
  shape: 'rounded',
  strokeWidth: 0.45,
  radius: 2.5,
  lineStyle: 'solid'
};

type TextOptions = Partial<Pick<PlacedField, 'height' | 'rotationDeg' | 'width' | 'x' | 'y'>> & {
  align?: FieldStyle['align'];
  fontSize?: number;
  fontWeight?: FieldStyle['fontWeight'];
};

export const textField = (id: string, text: string, x: number, y: number, width: number, height: number, options: TextOptions = {}): PlacedField => ({
  id,
  kind: 'text',
  text,
  x,
  y,
  width,
  height,
  rotationDeg: options.rotationDeg,
  style: {
    ...presetTextStyle,
    fontSize: options.fontSize ?? presetTextStyle.fontSize,
    fontWeight: options.fontWeight ?? presetTextStyle.fontWeight,
    align: options.align ?? presetTextStyle.align
  }
});

export const imageField = (id: string, imageSource: ImageSource, x: number, y: number, width: number, height: number): PlacedField => ({
  id,
  kind: 'image',
  imageSource,
  x,
  y,
  width,
  height,
  style: { ...presetTextStyle }
});

export const frameField = (id: string, width: number, height: number, frameStyle: Partial<FrameStyle> = {}): PlacedField => ({
  id,
  kind: 'frame',
  x: 0,
  y: 0,
  width,
  height,
  style: { ...presetTextStyle },
  frameStyle: { ...presetFrameStyle, ...frameStyle }
});

export const makePreset = (
  id: string,
  name: string,
  categories: HardwareCategory[],
  size: { widthMm: number; heightMm: number; tapeWidthMm: number },
  fields: PlacedField[],
  marginMm = 1.5
): LabelPreset => ({
  id,
  name,
  categories,
  widthMm: size.widthMm,
  heightMm: size.heightMm,
  tapeWidthMm: size.tapeWidthMm,
  marginMm,
  fields
});
