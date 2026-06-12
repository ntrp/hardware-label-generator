import { describe, expect, it } from 'vitest';
import { defaultHardwareItem } from './defaults';
import { buildQrPayload } from './qr';

describe('QR payloads', () => {
  it('embeds link data in a standalone data URL', () => {
    const payload = buildQrPayload(defaultHardwareItem, [
      { id: '1', name: 'Supplier', url: 'https://example.com/a2' }
    ]);

    expect(payload.target).toContain('data:text/html');
    expect(decodeURIComponent(payload.target)).toContain('https://example.com/a2');
    expect(payload.warning).toBeUndefined();
  });

  it('warns for large QR payloads', () => {
    const payload = buildQrPayload(defaultHardwareItem, [
      { id: '1', name: 'Large', url: `https://example.com/${'x'.repeat(2200)}` }
    ]);

    expect(payload.warning).toContain('QR payload');
  });
});
