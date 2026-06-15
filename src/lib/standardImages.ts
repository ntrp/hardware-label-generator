import { catalogAssetManifest } from '../data/catalogAssets';
import type { HardwareItem, ImageSource, StandardCatalogEntry } from '../types';

export const standardImageSources = ['side', 'top'] as const;
export type StandardImageSource = (typeof standardImageSources)[number];
export const catalogAssetSources = ['iso', 'side', 'top'] as const;
export type CatalogAssetSource = (typeof catalogAssetSources)[number];

export interface StandardImageReference {
  catalogId: string;
  isoUrl: string;
  sideUrl: string;
  topUrl: string;
}

const assetBaseUrl = './catalog-assets/';

export const catalogAssetUrlForId = (catalogId: string | undefined, source: CatalogAssetSource) => {
  if (!catalogId) return '';
  const manifestEntry = catalogAssetManifest[catalogId];
  const filename = manifestEntry?.[source];
  return filename ? `${assetBaseUrl}${catalogId}/${filename}` : '';
};

export const catalogAssetUrlForEntry = (entry: StandardCatalogEntry | undefined, source: CatalogAssetSource) =>
  catalogAssetUrlForId(entry?.id, source);

export const catalogAssetUrlForItem = (item: HardwareItem | undefined, source: CatalogAssetSource) =>
  catalogAssetUrlForId(item?.catalogId, source);

export const standardImageReferenceForCatalogId = (catalogId: string | undefined): StandardImageReference | undefined => {
  if (!catalogId || !catalogAssetManifest[catalogId]) return undefined;
  return {
    catalogId,
    isoUrl: catalogAssetUrlForId(catalogId, 'iso'),
    sideUrl: catalogAssetUrlForId(catalogId, 'side'),
    topUrl: catalogAssetUrlForId(catalogId, 'top')
  };
};

export const standardImageReferenceForItem = (item: HardwareItem) => standardImageReferenceForCatalogId(item.catalogId);

export const standardImageUrlForItem = (item: HardwareItem, source: ImageSource | undefined) => {
  if (source === 'side' || source === 'top') return catalogAssetUrlForItem(item, source);
  return '';
};

export const catalogAssetLabel = (source: CatalogAssetSource) => {
  if (source === 'iso') return 'ISO render';
  if (source === 'side') return 'Side drawing';
  return 'Top drawing';
};

export const standardImageLabel = (source: ImageSource | undefined) => {
  if (source === 'side') return 'Side drawing';
  if (source === 'top') return 'Top drawing';
  if (source === 'custom') return 'Custom image';
  return 'Purchase link QR';
};

export const isStandardImageSource = (source: ImageSource | undefined): source is StandardImageSource =>
  source === 'side' || source === 'top';
