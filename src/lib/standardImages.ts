import { catalogAssetManifest } from '../data/catalogAssets';
import type { HardwareItem, ImageSource, StandardCatalogEntry } from '../types';

export const standardImageSources = ['iso', 'side', 'top'] as const;
export type StandardImageSource = (typeof standardImageSources)[number];
export const catalogAssetSources = ['isoRender', 'iso', 'side', 'top'] as const;
export type CatalogAssetSource = (typeof catalogAssetSources)[number];

export interface StandardImageReference {
  catalogId: string;
  isoRenderUrl: string;
  isoUrl: string;
  sideUrl: string;
  topUrl: string;
}

const assetBaseUrl = './catalog-assets/';

const escapeSvgText = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const missingCatalogAssetSvg = (label = 'Image missing') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 96">
  <rect width="160" height="96" rx="8" fill="#f4f6f8"/>
  <path d="M38 60l22-25 17 18 10-11 35 38H38z" fill="#d7dee5"/>
  <circle cx="112" cy="30" r="10" fill="#d7dee5"/>
  <rect x="24" y="18" width="112" height="60" rx="6" fill="none" stroke="#98a4ae" stroke-width="3" stroke-dasharray="7 5"/>
  <text x="80" y="88" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="#66727c">${escapeSvgText(label)}</text>
</svg>`;

export const missingCatalogAssetDataUrl = (label?: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(missingCatalogAssetSvg(label))}`;

export const catalogAssetUrlForId = (catalogId: string | undefined, source: CatalogAssetSource) => {
  if (!catalogId) return missingCatalogAssetDataUrl(catalogAssetLabel(source));
  const manifestEntry = catalogAssetManifest[catalogId];
  const filename = manifestEntry?.[source];
  return filename ? `${assetBaseUrl}${catalogId}/${filename}` : missingCatalogAssetDataUrl(catalogAssetLabel(source));
};

export const catalogAssetUrlForEntry = (entry: StandardCatalogEntry | undefined, source: CatalogAssetSource) =>
  catalogAssetUrlForId(entry?.id, source);

export const catalogAssetUrlForItem = (item: HardwareItem | undefined, source: CatalogAssetSource) =>
  catalogAssetUrlForId(item?.catalogId, source);

export const standardImageReferenceForCatalogId = (catalogId: string | undefined): StandardImageReference | undefined => {
  if (!catalogId || !catalogAssetManifest[catalogId]) return undefined;
  return {
    catalogId,
    isoRenderUrl: catalogAssetUrlForId(catalogId, 'isoRender'),
    isoUrl: catalogAssetUrlForId(catalogId, 'iso'),
    sideUrl: catalogAssetUrlForId(catalogId, 'side'),
    topUrl: catalogAssetUrlForId(catalogId, 'top')
  };
};

export const standardImageReferenceForItem = (item: HardwareItem) => standardImageReferenceForCatalogId(item.catalogId);

export const standardImageUrlForItem = (item: HardwareItem, source: ImageSource | undefined) => {
  if (isStandardImageSource(source)) return catalogAssetUrlForItem(item, source);
  return '';
};

export const catalogAssetLabel = (source: CatalogAssetSource) => {
  if (source === 'isoRender') return 'ISO render';
  if (source === 'iso') return 'ISO drawing';
  if (source === 'side') return 'Side drawing';
  return 'Top drawing';
};

export const standardImageLabel = (source: ImageSource | undefined) => {
  if (source === 'iso') return 'ISO drawing';
  if (source === 'side') return 'Side drawing';
  if (source === 'top') return 'Top drawing';
  if (source === 'custom') return 'Custom image';
  return 'Purchase link QR';
};

export const isStandardImageSource = (source: ImageSource | undefined): source is StandardImageSource =>
  source === 'iso' || source === 'side' || source === 'top';
