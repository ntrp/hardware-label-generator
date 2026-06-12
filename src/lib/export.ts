import JSZip from 'jszip';
import type { HardwareItem, LabelSettings, PurchaseLink, PurchaseLinkState, UnitSystem } from '../types';
import { formatLength, safeFilePart } from './format';
import { createLbxBlob } from './lbx';
import { renderLabelSvg, svgToPngBlob } from './svg';

export type ExportFormat = 'svg' | 'png' | 'lbx';

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const labelFilename = (item: HardwareItem, extension: string) =>
  `${safeFilePart([item.standard, item.size, formatLength(item.length, item.lengthUnit), item.material].filter(Boolean).join('-'))}.${extension}`;

export const labelArchiveFolderName = (item: HardwareItem, index: number) =>
  `${String(index + 1).padStart(3, '0')}-${safeFilePart([item.standard, item.size, formatLength(item.length, item.lengthUnit), item.material].filter(Boolean).join('-'))}`;

export const purchaseLinkScopeKey = (item: HardwareItem) => item.catalogId ?? item.id;

export const effectivePurchaseLinks = (links: PurchaseLinkState, item: HardwareItem) =>
  links.overrideByItem[item.id] ? links.overrides[item.id] ?? [] : links.shared[purchaseLinkScopeKey(item)] ?? [];

export const exportSingle = async (
  item: HardwareItem,
  settings: LabelSettings,
  links: PurchaseLink[],
  unitSystem: UnitSystem,
  format: ExportFormat
) => {
  if (format === 'svg') {
    const svg = await renderLabelSvg(item, settings, links, unitSystem);
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), labelFilename(item, 'svg'));
    return;
  }

  if (format === 'png') {
    const svg = await renderLabelSvg(item, settings, links, unitSystem);
    const png = await svgToPngBlob(svg, settings.widthMm, settings.heightMm);
    downloadBlob(png, labelFilename(item, 'png'));
    return;
  }

  downloadBlob(await createLbxBlob(item, settings, links, unitSystem), labelFilename(item, 'lbx'));
};

export const createExportZipBlob = async (
  items: HardwareItem[],
  settings: LabelSettings,
  linkState: PurchaseLinkState,
  formats: ExportFormat[]
) => {
  const zip = new JSZip();

  for (const [index, item] of items.entries()) {
    const folder = zip.folder(labelArchiveFolderName(item, index)) ?? zip;
    const links = effectivePurchaseLinks(linkState, item);

    if (formats.includes('svg')) {
      folder.file(labelFilename(item, 'svg'), await renderLabelSvg(item, settings, links, item.unitSystem));
    }

    if (formats.includes('png')) {
      const svg = await renderLabelSvg(item, settings, links, item.unitSystem);
      folder.file(labelFilename(item, 'png'), await svgToPngBlob(svg, settings.widthMm, settings.heightMm));
    }

    if (formats.includes('lbx')) {
      folder.file(labelFilename(item, 'lbx'), await (await createLbxBlob(item, settings, links, item.unitSystem)).arrayBuffer());
    }
  }

  return zip.generateAsync({ type: 'blob' });
};

export const exportZip = async (
  items: HardwareItem[],
  settings: LabelSettings,
  linkState: PurchaseLinkState,
  formats: ExportFormat[]
) => {
  downloadBlob(await createExportZipBlob(items, settings, linkState, formats), 'fastener-labels.zip');
};
