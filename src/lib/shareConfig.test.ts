import { describe, expect, it } from 'vitest';
import { defaultAppState } from './defaults';
import { createShareConfigUrl, parseShareConfigPayload, sharedConfigPayloadFromLocation } from './shareConfig';

describe('share config', () => {
  it('creates a URL-safe config link that can be parsed back to state', async () => {
    const url = await createShareConfigUrl(defaultAppState, { href: 'https://example.test/labels?foo=bar' } as Location);
    const payload = sharedConfigPayloadFromLocation({ href: url } as Location);

    expect(url).toMatch(/^https:\/\/example\.test\/labels\?foo=bar&config=/);
    expect(payload).toBeTruthy();
    expect(payload).not.toMatch(/[+/=]/);
    await expect(parseShareConfigPayload(payload!)).resolves.toEqual(defaultAppState);
  });
});
