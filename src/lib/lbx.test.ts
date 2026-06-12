import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { defaultAppState, defaultHardwareItem, defaultLabelSettings } from './defaults';
import { effectivePurchaseLinks } from './export';
import { createLbxBlob, generateLbxXml } from './lbx';

describe('LBX export adapter', () => {
  it('marks unverified exports when no fixture is available', () => {
    const lbx = generateLbxXml(defaultHardwareItem, defaultLabelSettings, effectivePurchaseLinks(defaultAppState.purchaseLinks, defaultHardwareItem), 'metric');

    expect(lbx).toContain('LBX fixture missing');
    expect(lbx).toContain('continuous-tape');
    expect(lbx).toContain('DIN 912 / ISO 4762');
  });

  it('records the fixture name when fixture-guided', () => {
    const lbx = generateLbxXml(defaultHardwareItem, defaultLabelSettings, [], 'metric', {
      name: '24mm-qr-sidecar.lbx',
      xml: '<xml></xml>'
    });

    expect(lbx).toContain('Generated from fixture: 24mm-qr-sidecar.lbx');
    expect(lbx).toContain('fidelity="fixture-guided"');
  });

  it('creates LBX files as ZIP containers of XML files', async () => {
    const blob = await createLbxBlob(defaultHardwareItem, defaultLabelSettings, effectivePurchaseLinks(defaultAppState.purchaseLinks, defaultHardwareItem), 'metric');
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const entries = Object.keys(zip.files);

    expect(entries).toEqual(expect.arrayContaining(['label.xml', 'objects.xml', 'metadata.xml']));
    await expect(zip.file('label.xml')?.async('string')).resolves.toContain('BrotherLabelDocument');
    await expect(zip.file('objects.xml')?.async('string')).resolves.toContain('<objects>');
    await expect(zip.file('metadata.xml')?.async('string')).resolves.toContain('DIN 912 / ISO 4762');
  });
});
