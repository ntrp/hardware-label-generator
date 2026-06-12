import { describe, expect, it } from 'vitest';
import { buildQrPayload } from './qr';

describe('QR payloads', () => {
  it('uses the purchase link as the QR target', () => {
    const payload = buildQrPayload('https://example.com/a2');

    expect(payload.target).toBe('https://example.com/a2');
    expect(payload.warning).toBeUndefined();
  });

  it('warns for large QR payloads', () => {
    const payload = buildQrPayload(`https://example.com/${'x'.repeat(2200)}`);

    expect(payload.warning).toContain('QR payload');
  });
});
