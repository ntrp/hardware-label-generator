import QRCode from 'qrcode';

export interface QrPayloadResult {
  target: string;
  byteLength: number;
  warning?: string;
}

export const buildQrPayload = (link: string): QrPayloadResult => {
  const target = link.trim();
  const byteLength = new TextEncoder().encode(target).length;
  const warning = byteLength > 1800 ? `QR payload is ${byteLength} bytes. Shorten the purchase link for reliable scanning.` : undefined;

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

export const createQrPngDataUrl = async (target: string, margin = 1) =>
  QRCode.toDataURL(target, {
    type: 'image/png',
    errorCorrectionLevel: 'M',
    margin,
    color: {
      dark: '#111111',
      light: '#ffffff'
    }
  });
