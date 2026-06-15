import type { HardwareItem, ImageSource, StandardCodeMap, StandardFamily } from '../types';

const fastenersBaseUrl = 'https://www.fasteners.eu';
const imageFamilies: StandardFamily[] = ['DIN', 'ISO', 'EN', 'ASME', 'ASTM', 'SAE', 'JIS'];
export const standardImageSources = ['side', 'top'] as const;
export type StandardImageSource = (typeof standardImageSources)[number];

export interface StandardImageReference {
  family: StandardFamily;
  number: string;
  pageUrl: string;
  sideUrl: string;
  topUrl: string;
}

const standardNumberFromCode = (family: StandardFamily, code: string) => {
  const withoutFamily = code.replace(new RegExp(`^\\s*${family}\\s+`, 'i'), '').trim();
  const withoutCommonPrefixes = withoutFamily.replace(/^(EN|ISO)\s+/i, '').trim();
  return withoutCommonPrefixes.match(/[A-Za-z]?\d[A-Za-z0-9./-]*/)?.[0];
};

const productSlug = (family: StandardFamily, number: string) => `${family.toLowerCase()}${number.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

const drawingSlug = (family: StandardFamily, number: string) => `${family.toLowerCase()}-${number.toLowerCase().replace(/\//g, '-')}`;

export const standardImageReferenceFromCodes = (codes: StandardCodeMap): StandardImageReference | undefined => {
  for (const family of imageFamilies) {
    const code = codes[family];
    if (!code) continue;
    const number = standardNumberFromCode(family, code);
    if (!number) continue;

    return {
      family,
      number,
      pageUrl: `${fastenersBaseUrl}/standards/${family}/${encodeURIComponent(number)}/`,
      sideUrl: `${fastenersBaseUrl}/img/products/3d/${productSlug(family, number)}.jpg`,
      topUrl: `${fastenersBaseUrl}/img/products/${drawingSlug(family, number)}.jpg`
    };
  }

  return undefined;
};

export const standardImageReferenceForItem = (item: HardwareItem) => standardImageReferenceFromCodes(item.standardCodes);

export const standardImageUrlForItem = (item: HardwareItem, source: ImageSource | undefined) => {
  const reference = standardImageReferenceForItem(item);
  if (!reference) return '';
  if (source === 'side') return reference.sideUrl;
  if (source === 'top') return reference.topUrl;
  return '';
};

export const standardImageLabel = (source: ImageSource | undefined) => {
  if (source === 'side') return 'Side image';
  if (source === 'top') return 'Top image';
  if (source === 'custom') return 'Custom image';
  return 'Purchase link QR';
};

export const isStandardImageSource = (source: ImageSource | undefined): source is StandardImageSource =>
  source === 'side' || source === 'top';
