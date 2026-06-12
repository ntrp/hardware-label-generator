import QRCode from 'qrcode';
import type { HardwareItem, PurchaseLink } from '../types';
import { formatLength } from './format';

export interface QrPayloadResult {
  target: string;
  byteLength: number;
  warning?: string;
}

export const buildLinksHtml = (item: HardwareItem, links: PurchaseLink[]) => {
  const title = `${item.standard} ${item.size} ${formatLength(item.length, item.lengthUnit)}`.trim();
  const rows = links
    .filter((link) => link.url.trim())
    .map(
      (link) =>
        `<li><a href="${escapeHtml(link.url)}" rel="noreferrer">${escapeHtml(link.name || link.url)}</a></li>`
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,sans-serif;margin:24px;line-height:1.45}h1{font-size:20px}li{margin:14px 0}</style></head><body><h1>${escapeHtml(title)}</h1><ul>${rows || '<li>No purchase links saved.</li>'}</ul></body></html>`;
};

export const buildQrPayload = (item: HardwareItem, links: PurchaseLink[]): QrPayloadResult => {
  const html = buildLinksHtml(item, links);
  const target = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  const byteLength = new TextEncoder().encode(target).length;
  const warning =
    byteLength > 1800
      ? `QR payload is ${byteLength} bytes. Shorten links or keep only the most important suppliers for reliable scanning.`
      : undefined;

  return { target, byteLength, warning };
};

export const createQrSvg = async (target: string, margin = 1) =>
  QRCode.toString(target, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin,
    color: {
      dark: '#111111',
      light: '#ffffff'
    }
  });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
