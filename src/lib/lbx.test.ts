import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { defaultFieldStyle, defaultHardwareItem, defaultLabelSettings } from './defaults';
import { createLbxBlob, generateLbxXml, generateLbxXmlFiles } from './lbx';

const clipartFixturePath = resolve(process.cwd(), 'fixtures/lbx/two_text_clipart.lbx');
const imageFixturePath = resolve(process.cwd(), 'fixtures/lbx/two_text_image.lbx');

describe('LBX export adapter', () => {
  it('exports QR elements as image files in the LBX zip', async () => {
    const generatedBlob = await createLbxBlob(
      defaultHardwareItem,
      defaultLabelSettings,
      'https://example.com/a2',
      'metric'
    );
    const generatedZip = await JSZip.loadAsync(await generatedBlob.arrayBuffer());
    const labelXml = await generatedZip.file('label.xml')?.async('string');
    const qrPng = await generatedZip.file('Object0.png')?.async('uint8array');

    expect(Object.keys(generatedZip.files).sort()).toEqual(['Object0.png', 'label.xml', 'prop.xml']);
    expect(labelXml).toContain('<image:image>');
    expect(labelXml).toContain('fileName="Object0.png"');
    expect(labelXml).not.toContain('<barcode:barcode>');
    expect(qrPng?.slice(1, 4)).toEqual(new Uint8Array([0x50, 0x4e, 0x47]));
  });

  it('recognizes Brother LBX bitmap image files from the fixture', async () => {
    const fixtureZip = await JSZip.loadAsync(readFileSync(imageFixturePath));
    const labelXml = await fixtureZip.file('label.xml')?.async('string');

    expect(Object.keys(fixtureZip.files).sort()).toEqual(['Object0.bmp', 'label.xml', 'prop.xml']);
    expect(labelXml).toContain('<image:image>');
    expect(labelXml).toContain('fileName="Object0.bmp"');
  });

  it('recognizes Brother LBX clipart fixtures without embedded image files', async () => {
    const fixtureZip = await JSZip.loadAsync(readFileSync(clipartFixturePath));
    const labelXml = await fixtureZip.file('label.xml')?.async('string');

    expect(Object.keys(fixtureZip.files).sort()).toEqual(['label.xml', 'prop.xml']);
    expect(labelXml).toContain('<image:clipart>');
  });

  it('generates Brother namespace label XML with embedded objects', () => {
    const labelXml = generateLbxXml(
      defaultHardwareItem,
      defaultLabelSettings,
      'https://example.com/a2',
      'metric'
    );

    expect(labelXml).toContain('<pt:document');
    expect(labelXml).toContain('xmlns:pt="http://schemas.brother.info/ptouch/2007/lbx/main"');
    expect(labelXml).toContain('<style:paper');
    expect(labelXml).toContain('<pt:objects>');
    expect(labelXml).toContain('<text:text>');
    expect(labelXml).toContain('<image:image>');
    expect(labelXml).not.toContain('<barcode:barcode>');
    expect(labelXml).toContain('DIN 912');
    expect(labelXml).toContain('M3');
  });

  it('generates Brother custom image object references', () => {
    const labelXml = generateLbxXml(
      defaultHardwareItem,
      {
        ...defaultLabelSettings,
        fields: [
          {
            id: 'field-custom-image',
            kind: 'image',
            imageSource: 'custom',
            imageName: 'logo.png',
            imageBase64: 'iVBORw0KGgo=',
            imageMimeType: 'image/png',
            x: 35,
            y: 5,
            width: 12,
            height: 12,
            style: { fontFamily: 'Inter', fontSize: 4, fontWeight: 700, align: 'middle', visible: true }
          }
        ]
      },
      '',
      'metric'
    );

    expect(labelXml).toContain('<image:image>');
    expect(labelXml).toContain('originalName="logo.png"');
    expect(labelXml).toContain('fileName="Object0.png"');
  });

  it('generates Brother standard side image object references', () => {
    const labelXml = generateLbxXml(
      { ...defaultHardwareItem, standardCodes: { DIN: 'DIN 1587' } },
      {
        ...defaultLabelSettings,
        fields: [
          {
            id: 'field-side-image',
            kind: 'image',
            imageSource: 'side',
            x: 2,
            y: 2,
            width: 12,
            height: 12,
            style: { ...defaultFieldStyle }
          }
        ]
      },
      '',
      'metric'
    );

    expect(labelXml).toContain('<image:image>');
    expect(labelXml).toContain('originalName="Object0.svg"');
    expect(labelXml).toContain('fileName="Object0.svg"');
  });

  it('generates Brother standard ISO drawing image objects with rotation', () => {
    const labelXml = generateLbxXml(
      defaultHardwareItem,
      {
        ...defaultLabelSettings,
        fields: [
          {
            id: 'field-iso-image',
            kind: 'image',
            imageSource: 'iso',
            rotationDeg: 30,
            x: 2,
            y: 2,
            width: 12,
            height: 12,
            style: { ...defaultFieldStyle }
          }
        ]
      },
      '',
      'metric'
    );

    expect(labelXml).toContain('<image:image>');
    expect(labelXml).toContain('angle="30"');
    expect(labelXml).toContain('fileName="Object0.svg"');
  });

  it('stores configured standard SVG image line thickness in LBX image files', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<svg xmlns="http://www.w3.org/2000/svg"><g stroke-width="0.35"><path d="M0 0L1 1"/></g></svg>'))
    );

    try {
      const generatedBlob = await createLbxBlob(
        defaultHardwareItem,
        {
          ...defaultLabelSettings,
          fields: [
            {
              id: 'field-side-image',
              kind: 'image',
              imageSource: 'side',
              svgStrokeWidth: 1.1,
              x: 2,
              y: 2,
              width: 12,
              height: 12,
              style: { ...defaultFieldStyle }
            }
          ]
        },
        '',
        'metric'
      );
      const zip = await JSZip.loadAsync(await generatedBlob.arrayBuffer());

      await expect(zip.file('Object0.svg')?.async('string')).resolves.toContain('stroke-width="1.1"');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('stores custom image bytes with their original supported file type', async () => {
    const svgImage = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2"/></svg>';
    const generatedBlob = await createLbxBlob(
      defaultHardwareItem,
      {
        ...defaultLabelSettings,
        fields: [
          {
            id: 'field-custom-image',
            kind: 'image',
            imageSource: 'custom',
            imageName: 'logo.svg',
            imageBase64: Buffer.from(svgImage).toString('base64'),
            imageMimeType: 'image/svg+xml',
            x: 35,
            y: 5,
            width: 12,
            height: 12,
            style: { fontFamily: 'Inter', fontSize: 4, fontWeight: 700, align: 'middle', visible: true }
          }
        ]
      },
      '',
      'metric'
    );
    const zip = await JSZip.loadAsync(await generatedBlob.arrayBuffer());

    expect(Object.keys(zip.files).sort()).toEqual(['Object0.svg', 'label.xml', 'prop.xml']);
    await expect(zip.file('Object0.svg')?.async('string')).resolves.toBe(svgImage);
    await expect(zip.file('label.xml')?.async('string')).resolves.toContain('fileName="Object0.svg"');
  });

  it('generates the Brother metadata property XML', () => {
    const files = generateLbxXmlFiles(defaultHardwareItem, defaultLabelSettings, 'https://example.com/a2', 'metric');

    expect(files['prop.xml']).toContain('<meta:properties');
    expect(files['prop.xml']).toContain('<meta:appName>com.brother.PtouchEditor</meta:appName>');
    expect(files['prop.xml']).toContain('<meta:numPages>1</meta:numPages>');
  });
});
