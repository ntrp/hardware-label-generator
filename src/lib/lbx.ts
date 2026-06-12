import JSZip from 'jszip';
import type { HardwareItem, LabelSettings, PurchaseLink, UnitSystem } from '../types';
import { defaultFrameStyle } from './defaults';
import { renderTextTemplate } from './format';
import { buildQrPayload } from './qr';

export interface LbxFixture {
  name: string;
  xml: string;
}

export interface LbxXmlFiles {
  'label.xml': string;
  'objects.xml': string;
  'metadata.xml': string;
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const generateObjectXml = (item: HardwareItem, settings: LabelSettings, links: PurchaseLink[], unitSystem: UnitSystem) => {
  const payload = buildQrPayload(item, links);

  return settings.fields
    .filter((field) => field.style.visible)
    .map((field) => {
      if (field.kind === 'image' && field.imageSource === 'qr') {
        return `<object type="barcode" symbology="QR" x="${field.x}" y="${field.y}" width="${field.width}" height="${field.height}"><data>${escapeXml(payload.target)}</data></object>`;
      }

      if (field.kind === 'frame') {
        const frameStyle = { ...defaultFrameStyle, ...field.frameStyle };
        return `<object type="frame" x="${field.x}" y="${field.y}" width="${field.width}" height="${field.height}" shape="${frameStyle.shape}" thickness="${frameStyle.strokeWidth}" radius="${frameStyle.radius}" lineStyle="${frameStyle.lineStyle}"/>`;
      }

      return `<object type="text" x="${field.x}" y="${field.y}" width="${field.width}" height="${field.height}" font="${escapeXml(field.style.fontFamily)}" size="${field.style.fontSize}" weight="${field.style.fontWeight}" align="${field.style.align}"><text>${escapeXml(renderTextTemplate(field.text ?? '', item, unitSystem))}</text></object>`;
    })
    .join('');
};

export const generateLbxXmlFiles = (
  item: HardwareItem,
  settings: LabelSettings,
  links: PurchaseLink[],
  unitSystem: UnitSystem,
  fixture?: LbxFixture
) => {
  const objects = generateObjectXml(item, settings, links, unitSystem);
  const metadata = `<metadata standard="${escapeXml(item.standard)}" size="${escapeXml(item.size)}" category="${escapeXml(item.category)}"/>`;
  const objectsXml = `<?xml version="1.0" encoding="UTF-8"?>
<objects>${objects}</objects>`;
  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?>
${metadata}`;

  const generated = `<?xml version="1.0" encoding="UTF-8"?>
<BrotherLabelDocument generator="standalone-fastener-label-generator" fidelity="${fixture ? 'fixture-guided' : 'unverified-template'}">
  <media kind="continuous-tape" widthMm="${settings.tapeWidthMm}" labelWidthMm="${settings.widthMm}" labelHeightMm="${settings.heightMm}"/>
  ${metadata}
  <objectsFile path="objects.xml"/>
</BrotherLabelDocument>`;

  const labelXml = fixture ? mergeWithFixture(generated, fixture) : markUnverified(generated);

  return {
    'label.xml': labelXml,
    'objects.xml': objectsXml,
    'metadata.xml': metadataXml
  } satisfies LbxXmlFiles;
};

export const generateLbxXml = (
  item: HardwareItem,
  settings: LabelSettings,
  links: PurchaseLink[],
  unitSystem: UnitSystem,
  fixture?: LbxFixture
) => generateLbxXmlFiles(item, settings, links, unitSystem, fixture)['label.xml'];

export const createLbxBlob = async (
  item: HardwareItem,
  settings: LabelSettings,
  links: PurchaseLink[],
  unitSystem: UnitSystem,
  fixture?: LbxFixture
) => {
  const zip = new JSZip();
  const files = generateLbxXmlFiles(item, settings, links, unitSystem, fixture);

  Object.entries(files).forEach(([path, xml]) => {
    zip.file(path, xml);
  });

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
};

const markUnverified = (generated: string) =>
  generated.replace(
    '<BrotherLabelDocument',
    '<!-- LBX fixture missing: provide Brother P-touch Editor golden .lbx files for full-fidelity validation. This browser-only exporter emits a structured zipped-XML LBX template until fixtures are added. -->\n<BrotherLabelDocument'
  );

const mergeWithFixture = (generated: string, fixture: LbxFixture) => {
  if (!fixture.xml.includes('</')) {
    return generated;
  }

  return `<!-- Generated from fixture: ${escapeXml(fixture.name)} -->\n${generated}`;
};
