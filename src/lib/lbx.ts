import JSZip from 'jszip';
import type { HardwareItem, LabelSettings, PlacedField, UnitSystem } from '../types';
import { defaultFrameStyle } from './defaults';
import { renderTextTemplate } from './format';
import { buildQrPayload, createQrPngDataUrl } from './qr';
import { isStandardImageSource, standardImageLabel, standardImageUrlForItem } from './standardImages';

export interface LbxXmlFiles {
  'label.xml': string;
  'prop.xml': string;
  [path: `Object${number}.${string}`]: string | Uint8Array;
}

const ptPerMm = 2.8;
const appName = 'com.brother.PtouchEditor';
const printerId = '30256';
const printerName = 'Brother PT-P710BT';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const pt = (valueMm: number) => `${Number((valueMm * ptPerMm).toFixed(2))}pt`;

const textAlign = (align: PlacedField['style']['align']) => {
  if (align === 'middle') return 'CENTER';
  if (align === 'end') return 'RIGHT';
  return 'LEFT';
};

const lineStyle = (style: string) => {
  if (style === 'dashed') return 'DASH';
  if (style === 'dotted') return 'DOT';
  return 'SOLID';
};

const lbxImageFields = (item: HardwareItem, settings: LabelSettings) =>
  settings.fields.filter(
    (field) =>
      field.kind === 'image' &&
      field.style.visible &&
      (field.imageSource === 'qr' || isStandardImageSource(field.imageSource) || (field.imageSource === 'custom' && field.imageBase64))
  ).filter((field) => !isStandardImageSource(field.imageSource) || Boolean(standardImageUrlForItem(item, field.imageSource)));

const lbxExportedImageFields = (item: HardwareItem, settings: LabelSettings, purchaseLink: string) =>
  lbxImageFields(item, settings).filter((field) => field.imageSource !== 'qr' || purchaseLink.trim());

const imageExtension = (field: PlacedField) => {
  if (field.imageSource === 'qr') return 'png';
  if (isStandardImageSource(field.imageSource)) return 'svg';

  const nameExtension = field.imageName?.split('.').pop()?.toLowerCase();
  if (nameExtension === 'bmp' || nameExtension === 'png' || nameExtension === 'svg') {
    return nameExtension;
  }

  if (field.imageMimeType === 'image/bmp' || field.imageMimeType === 'image/x-ms-bmp') return 'bmp';
  if (field.imageMimeType === 'image/png') return 'png';
  if (field.imageMimeType === 'image/svg+xml') return 'svg';

  return 'png';
};

const imageFileName = (imageIndex: number, field: PlacedField) => `Object${imageIndex}.${imageExtension(field)}` as const;

const objectStyleXml = (field: PlacedField, objectName: string, extra = '') => `<pt:objectStyle x="${pt(field.x)}" y="${pt(field.y)}" width="${pt(field.width)}" height="${pt(field.height)}" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE">
  <pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"></pt:pen>
  <pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"></pt:brush>
  <pt:expanded objectName="${escapeXml(objectName)}" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" templateMergeID="0" allowOutOfBoundsTransfer="false" linkStatus="NONE" linkID="0"${extra}></pt:expanded>
</pt:objectStyle>`;

const renderTextObject = (field: PlacedField, item: HardwareItem, unitSystem: UnitSystem, index: number) => {
  const text = renderTextTemplate(field.text ?? '', item, unitSystem);
  const fontSize = pt(field.style.fontSize);
  const weight = field.style.fontWeight >= 700 ? 700 : field.style.fontWeight;
  const fontName = field.style.fontFamily.split(',')[0]?.replace(/["']/g, '').trim() || 'Helsinki';

  return `<text:text>
  ${objectStyleXml(field, `Text${index + 1}`)}
  <text:ptFontInfo>
    <text:logFont name="${escapeXml(fontName)}" width="0" italic="false" weight="${weight}" charSet="0" pitchAndFamily="2"></text:logFont>
    <text:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="${fontSize}" orgSize="${fontSize}" textColor="#000000" textPrintColorNumber="1"></text:fontExt>
  </text:ptFontInfo>
  <text:textControl control="LONGTEXTFIXED" clipFrame="false" aspectNormal="true" shrink="true" autoLF="true" avoidImage="false"></text:textControl>
  <text:textAlign horizontalAlignment="${textAlign(field.style.align)}" verticalAlignment="CENTER" inLineAlignment="BASELINE"></text:textAlign>
  <text:textStyle vertical="false" nullBlock="false" charSpace="0" lineSpace="0" orgPoint="${fontSize}" combinedChars="false"></text:textStyle>
  <text:transferSettings editOnPrintFormat="" editOnPrintOrder="0"></text:transferSettings>
  <pt:data>${escapeXml(text)}</pt:data>
  <text:stringItem charLen="${text.length}">
    <text:ptFontInfo>
      <text:logFont name="${escapeXml(fontName)}" width="0" italic="false" weight="${weight}" charSet="0" pitchAndFamily="2"></text:logFont>
      <text:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="${fontSize}" orgSize="${fontSize}" textColor="#000000" textPrintColorNumber="1"></text:fontExt>
    </text:ptFontInfo>
  </text:stringItem>
</text:text>`;
};

const renderFrameObject = (field: PlacedField, index: number) => {
  const frameField = { ...field, x: 0, y: 0 };
  const frameStyle = { ...defaultFrameStyle, ...field.frameStyle };
  const radius = frameStyle.shape === 'rounded' ? pt(frameStyle.radius) : '0pt';

  return `<draw:rect>
  ${objectStyleXml(frameField, `Frame${index + 1}`)}
  <draw:rectStyle arc="${radius}" lineStyle="${lineStyle(frameStyle.lineStyle)}" lineWidth="${pt(frameStyle.strokeWidth)}" lineColor="#000000" fillStyle="NULL" fillColor="#FFFFFF"></draw:rectStyle>
</draw:rect>`;
};

const renderImageObject = (field: PlacedField, index: number, imageIndex: number) => {
  const fileName = imageFileName(imageIndex, field);
  const originalName = field.imageSource === 'qr' || isStandardImageSource(field.imageSource) ? fileName : field.imageName?.trim() || fileName;

  return `<image:image>
  ${objectStyleXml(field, `Bitmap${index + 1}`)}
  <image:imageStyle originalName="${escapeXml(originalName)}" alignInText="NONE" firstMerge="true" IpName="" fileName="${fileName}">
    <image:transparent flag="false" color="#FFFFFF"></image:transparent>
    <image:trimming flag="false" shape="RECTANGLE" trimOrgX="0pt" trimOrgY="0pt" trimOrgWidth="0pt" trimOrgHeight="0pt"></image:trimming>
    <image:orgPos x="${pt(field.x)}" y="${pt(field.y)}" width="${pt(field.width)}" height="${pt(field.height)}"></image:orgPos>
    <image:effect effect="MONO" brightness="50" contrast="50" photoIndex="4"></image:effect>
    <image:mono operationKind="ERRORDIFFUSION" reverse="0" ditherKind="MESH" threshold="128" gamma="100" ditherEdge="0" rgbconvProportionRed="30" rgbconvProportionGreen="59" rgbconvProportionBlue="11" rgbconvProportionReversed="0"></image:mono>
  </image:imageStyle>
</image:image>`;
};

const renderObjects = (item: HardwareItem, settings: LabelSettings, purchaseLink: string, unitSystem: UnitSystem) =>
  settings.fields
    .filter((field) => field.style.visible)
    .map((field, index) => {
      if (field.kind === 'frame') return renderFrameObject({ ...field, width: settings.widthMm, height: settings.heightMm }, index);
      if (field.kind === 'image' && (field.imageSource === 'qr' || isStandardImageSource(field.imageSource) || (field.imageSource === 'custom' && field.imageBase64))) {
        const imageIndex = lbxExportedImageFields(item, settings, purchaseLink).findIndex((candidate) => candidate.id === field.id);
        return imageIndex >= 0 ? renderImageObject(field, index, imageIndex) : '';
      }
      if (field.kind === 'text') return renderTextObject(field, item, unitSystem, index);
      return '';
    })
    .filter(Boolean)
    .join('');

const generateLabelXml = (item: HardwareItem, settings: LabelSettings, purchaseLink: string, unitSystem: UnitSystem) => {
  const tapeWidthMm = settings.tapeWidthMm || settings.heightMm;
  const paperWidth = pt(tapeWidthMm);
  const paperHeight = pt(settings.widthMm);
  const marginX = Math.min(settings.marginMm, settings.widthMm / 2);
  const marginY = Math.min(settings.marginMm, tapeWidthMm / 2);
  const backgroundWidth = Math.max(0, settings.widthMm - marginX * 2);
  const backgroundHeight = Math.max(0, tapeWidthMm - marginY * 2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<pt:document xmlns:pt="http://schemas.brother.info/ptouch/2007/lbx/main" xmlns:style="http://schemas.brother.info/ptouch/2007/lbx/style" xmlns:text="http://schemas.brother.info/ptouch/2007/lbx/text" xmlns:draw="http://schemas.brother.info/ptouch/2007/lbx/draw" xmlns:image="http://schemas.brother.info/ptouch/2007/lbx/image" xmlns:barcode="http://schemas.brother.info/ptouch/2007/lbx/barcode" xmlns:database="http://schemas.brother.info/ptouch/2007/lbx/database" xmlns:table="http://schemas.brother.info/ptouch/2007/lbx/table" xmlns:cable="http://schemas.brother.info/ptouch/2007/lbx/cable" version="1.10" generator="${appName}">
  <pt:body currentSheet="Sheet 1" direction="LTR">
    <style:sheet name="Sheet 1">
      <style:paper media="0" width="${paperWidth}" height="${paperHeight}" marginLeft="${pt(marginY)}" marginTop="${pt(marginX)}" marginRight="${pt(marginY)}" marginBottom="${pt(marginX)}" orientation="landscape" autoLength="false" monochromeDisplay="true" printColorDisplay="false" printColorsID="0" paperColor="#FFFFFF" paperInk="#000000" split="1" format="259" backgroundTheme="0" printerID="${printerId}" printerName="${printerName}"></style:paper>
      <style:cutLine regularCut="0pt" freeCut=""></style:cutLine>
      <style:backGround x="${pt(marginX)}" y="${pt(marginY)}" width="${pt(backgroundWidth)}" height="${pt(backgroundHeight)}" brushStyle="NULL" brushId="0" userPattern="NONE" userPatternId="0" color="#000000" printColorNumber="1" backColor="#FFFFFF" backPrintColorNumber="0"></style:backGround>
      <pt:objects>${renderObjects(item, settings, purchaseLink, unitSystem)}</pt:objects>
    </style:sheet>
  </pt:body>
</pt:document>`;
};

const generatePropXml = () => {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  return `<?xml version="1.0" encoding="UTF-8"?>
<meta:properties xmlns:meta="http://schemas.brother.info/ptouch/2007/lbx/meta" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
  <meta:appName>${appName}</meta:appName>
  <dc:title></dc:title>
  <dc:subject></dc:subject>
  <dc:creator>standalone-fastener-label-generator</dc:creator>
  <meta:keyword></meta:keyword>
  <dc:description></dc:description>
  <meta:template></meta:template>
  <dcterms:created>${timestamp}</dcterms:created>
  <dcterms:modified>${timestamp}</dcterms:modified>
  <meta:lastPrinted></meta:lastPrinted>
  <meta:modifiedBy></meta:modifiedBy>
  <meta:revision>1</meta:revision>
  <meta:editTime>0</meta:editTime>
  <meta:numPages>1</meta:numPages>
  <meta:numWords>0</meta:numWords>
  <meta:numChars>0</meta:numChars>
  <meta:security>0</meta:security>
  <meta:transferScript></meta:transferScript>
</meta:properties>`;
};

export const generateLbxXmlFiles = (item: HardwareItem, settings: LabelSettings, purchaseLink: string, unitSystem: UnitSystem) =>
  ({
    'label.xml': generateLabelXml(item, settings, purchaseLink, unitSystem),
    'prop.xml': generatePropXml()
  }) satisfies LbxXmlFiles;

export const generateLbxXml = (item: HardwareItem, settings: LabelSettings, purchaseLink: string, unitSystem: UnitSystem) =>
  generateLbxXmlFiles(item, settings, purchaseLink, unitSystem)['label.xml'];

export const createLbxBlob = async (item: HardwareItem, settings: LabelSettings, purchaseLink: string, unitSystem: UnitSystem) => {
  const zip = new JSZip();
  const files: LbxXmlFiles = {
    ...generateLbxXmlFiles(item, settings, purchaseLink, unitSystem),
    ...(await generateImageFiles(item, settings, purchaseLink))
  };

  Object.entries(files).forEach(([path, content]) => {
    zip.file(path, content);
  });

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
};

const generateImageFiles = async (item: HardwareItem, settings: LabelSettings, purchaseLink: string) => {
  const entries = await Promise.all(
    lbxExportedImageFields(item, settings, purchaseLink).map(async (field, index) => [imageFileName(index, field), await imageFieldBytes(field, item, purchaseLink)] as const)
  );

  return Object.fromEntries(entries) as Partial<LbxXmlFiles>;
};

const imageFieldBytes = async (field: PlacedField, item: HardwareItem, purchaseLink: string) => {
  if (field.imageSource === 'qr') {
    const payload = buildQrPayload(purchaseLink);
    if (!payload.target) return new Uint8Array();
    return dataUrlToBytes(await createQrPngDataUrl(payload.target));
  }

  if (isStandardImageSource(field.imageSource)) {
    const url = standardImageUrlForItem(item, field.imageSource);
    if (!url) throw new Error(`${standardImageLabel(field.imageSource)} is not available for this catalog part.`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to fetch ${standardImageLabel(field.imageSource).toLowerCase()} from local catalog assets.`);
    return new Uint8Array(await response.arrayBuffer());
  }

  if (!field.imageBase64) {
    throw new Error('Custom image element is missing image data.');
  }

  return base64ToBytes(field.imageBase64);
};

const dataUrlToBytes = (value: string) => base64ToBytes(value.split(',')[1] ?? '');

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};
