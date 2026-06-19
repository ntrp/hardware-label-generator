import JSZip from 'jszip';
import type { HardwareItem, LabelSettings, PurchaseLinkState, UnitSystem } from '../types';
import { formatLength, safeFilePart, type PlaceholderDisplayValue } from './format';
import { createLbxBlob } from './lbx';
import { renderLabelSvg, svgToPngBlob } from './svg';

export type ExportFormat = 'svg' | 'png' | 'lbx';

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 0);
};

export const labelFilename = (item: HardwareItem, extension: string) =>
  `${safeFilePart([item.standard, item.size, formatLength(item.length, item.lengthUnit), item.material, item.materialType, item.finish, item.boltClass].filter(Boolean).join('-'))}.${extension}`;

export const labelArchiveFolderName = (item: HardwareItem, index: number) =>
  `${String(index + 1).padStart(3, '0')}-${safeFilePart([item.standard, item.size, formatLength(item.length, item.lengthUnit), item.material, item.materialType, item.finish, item.boltClass].filter(Boolean).join('-'))}`;

export const effectivePurchaseLink = (links: PurchaseLinkState, item: HardwareItem) => links[item.id] ?? '';

export const exportSingle = async (
  item: HardwareItem,
  settings: LabelSettings,
  purchaseLink: string,
  unitSystem: UnitSystem,
  format: ExportFormat,
  displaySpecValue?: PlaceholderDisplayValue
) => {
  if (format === 'svg') {
    const svg = await renderLabelSvg(item, settings, purchaseLink, unitSystem, { displaySpecValue });
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), labelFilename(item, 'svg'));
    return;
  }

  if (format === 'png') {
    const svg = await renderLabelSvg(item, settings, purchaseLink, unitSystem, { rasterSafe: true, displaySpecValue });
    const png = await svgToPngBlob(svg, settings.widthMm, settings.heightMm);
    downloadBlob(png, labelFilename(item, 'png'));
    return;
  }

  downloadBlob(await createLbxBlob(item, settings, purchaseLink, unitSystem, displaySpecValue), labelFilename(item, 'lbx'));
};

export const createExportZipBlob = async (
  items: HardwareItem[],
  settings: LabelSettings,
  linkState: PurchaseLinkState,
  formats: ExportFormat[],
  displaySpecValue?: PlaceholderDisplayValue
) => {
  const zip = new JSZip();

  for (const [index, item] of items.entries()) {
    const folder = zip.folder(labelArchiveFolderName(item, index)) ?? zip;
    const purchaseLink = effectivePurchaseLink(linkState, item);
    const itemSettings = item.labelSettings ?? settings;

    if (formats.includes('svg')) {
      folder.file(labelFilename(item, 'svg'), await renderLabelSvg(item, itemSettings, purchaseLink, item.unitSystem, { displaySpecValue }));
    }

    if (formats.includes('png')) {
      const svg = await renderLabelSvg(item, itemSettings, purchaseLink, item.unitSystem, { rasterSafe: true, displaySpecValue });
      folder.file(labelFilename(item, 'png'), await svgToPngBlob(svg, itemSettings.widthMm, itemSettings.heightMm));
    }

    if (formats.includes('lbx')) {
      folder.file(labelFilename(item, 'lbx'), await (await createLbxBlob(item, itemSettings, purchaseLink, item.unitSystem, displaySpecValue)).arrayBuffer());
    }
  }

  return zip.generateAsync({ type: 'blob' });
};

export const exportZip = async (
  items: HardwareItem[],
  settings: LabelSettings,
  linkState: PurchaseLinkState,
  formats: ExportFormat[],
  displaySpecValue?: PlaceholderDisplayValue
) => {
  downloadBlob(await createExportZipBlob(items, settings, linkState, formats, displaySpecValue), 'fastener-labels.zip');
};
