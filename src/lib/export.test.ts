import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { defaultHardwareItem, defaultLabelSettings } from './defaults';
import { createExportZipBlob, labelArchiveFolderName, labelFilename } from './export';

const emptyLinkState = {};

describe('export helpers', () => {
  it('builds deterministic label filenames', () => {
    expect(labelFilename(defaultHardwareItem, 'svg')).toBe('din-912-iso-4762-m3-12-mm-stainless-steel-a2-a2-70.svg');
  });

  it('creates one ZIP folder per hardware card, even for duplicate labels', async () => {
    const items = [
      { ...defaultHardwareItem, id: 'item-a' },
      { ...defaultHardwareItem, id: 'item-b' }
    ];
    const blob = await createExportZipBlob(items, defaultLabelSettings, emptyLinkState, ['svg']);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const entries = Object.keys(zip.files);

    expect(entries).toContain(`${labelArchiveFolderName(items[0], 0)}/`);
    expect(entries).toContain(`${labelArchiveFolderName(items[1], 1)}/`);
    expect(entries).toContain(`${labelArchiveFolderName(items[0], 0)}/${labelFilename(items[0], 'svg')}`);
    expect(entries).toContain(`${labelArchiveFolderName(items[1], 1)}/${labelFilename(items[1], 'svg')}`);
  });

  it('stores LBX exports inside the all-label ZIP as zipped XML containers', async () => {
    const item = { ...defaultHardwareItem, id: 'item-a' };
    const blob = await createExportZipBlob([item], defaultLabelSettings, { [item.id]: 'https://example.com/a2' }, ['lbx']);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const lbxPath = `${labelArchiveFolderName(item, 0)}/${labelFilename(item, 'lbx')}`;
    const lbxBytes = await zip.file(lbxPath)?.async('arraybuffer');

    expect(lbxBytes).toBeDefined();

    const lbxZip = await JSZip.loadAsync(lbxBytes as ArrayBuffer);
    expect(Object.keys(lbxZip.files).sort()).toEqual(['Object0.png', 'label.xml', 'prop.xml']);
  });
});
