import type { HardwareItem, LabelSettings, PlacedField, UnitSystem } from '../types';
import { defaultFrameStyle } from './defaults';
import { renderTextTemplate } from './format';
import { buildQrPayload, createQrPngDataUrl, createQrSvg } from './qr';
import { standardImageUrlForItem } from './standardImages';

const mmToPx = 3.7795275591;

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const textAlign = (field: PlacedField) => {
  if (field.style.align === 'middle') return 'center';
  if (field.style.align === 'end') return 'right';
  return 'left';
};

const customImageHref = (field: PlacedField) =>
  field.imageBase64 ? `data:${field.imageMimeType || 'application/octet-stream'};base64,${field.imageBase64}` : '';

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read standard image bytes.'));
    reader.readAsDataURL(blob);
  });

const rasterSafeStandardImageHref = async (url: string) => {
  if (!url) return '';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to fetch standard image: ${url}`);
  return blobToDataUrl(await response.blob());
};

export interface RenderLabelSvgOptions {
  interactive?: boolean;
  hoveredFieldId?: string | null;
  selectedFieldId?: string | null;
  rasterSafe?: boolean;
}

export const renderLabelSvg = async (
  item: HardwareItem,
  settings: LabelSettings,
  purchaseLink: string,
  unitSystem: UnitSystem,
  options: RenderLabelSvgOptions = {}
) => {
  const qrPayload = buildQrPayload(purchaseLink);
  let qrSvgDataUri = '';
  const standardImageHrefs = new Map<string, string>();

  if (qrPayload.target && settings.fields.some((field) => field.kind === 'image' && field.imageSource === 'qr' && field.style.visible)) {
    if (options.rasterSafe) {
      qrSvgDataUri = await createQrPngDataUrl(qrPayload.target);
    } else {
      const qrSvg = await createQrSvg(qrPayload.target);
      qrSvgDataUri = `data:image/svg+xml;base64,${btoa(qrSvg)}`;
    }
  }

  if (settings.fields.some((field) => field.kind === 'image' && field.style.visible && (field.imageSource === 'side' || field.imageSource === 'top'))) {
    await Promise.all(
      settings.fields
        .filter((field) => field.kind === 'image' && field.style.visible && (field.imageSource === 'side' || field.imageSource === 'top'))
        .map(async (field) => {
          const url = standardImageUrlForItem(item, field.imageSource);
          if (!url) return;
          standardImageHrefs.set(field.id, options.rasterSafe ? await rasterSafeStandardImageHref(url) : url);
        })
    );
  }

  const fields = settings.fields
    .filter((field) => field.style.visible)
    .map((field) => renderField(field, item, settings, unitSystem, qrSvgDataUri, standardImageHrefs, options))
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${settings.widthMm}mm" height="${settings.heightMm}mm" viewBox="0 0 ${settings.widthMm} ${settings.heightMm}">
  <rect x="0" y="0" width="${settings.widthMm}" height="${settings.heightMm}" fill="#fff"/>
  ${fields}
</svg>`;
};

export const svgToPngBlob = async (svg: string, widthMm: number, heightMm: number) => {
  const image = new Image();
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(widthMm * mmToPx * 3);
  canvas.height = Math.ceil(heightMm * mmToPx * 3);
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas rendering is not available in this browser.');
  }

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to rasterize SVG label.'));
      image.src = url;
    });

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Unable to create PNG blob.'));
    }, 'image/png');
  });
};

const estimatedTextWidth = (value: string, fontSize: number) => {
  let width = 0;

  for (const character of value) {
    if (character === ' ') width += fontSize * 0.32;
    else if ('ilI.,:;|!'.includes(character)) width += fontSize * 0.28;
    else if ('mwMW@#%&'.includes(character)) width += fontSize * 0.82;
    else width += fontSize * 0.56;
  }

  return width;
};

const ellipsizeText = (value: string, maxWidth: number, fontSize: number) => {
  if (estimatedTextWidth(value, fontSize) <= maxWidth) return value;
  const ellipsis = '...';
  let result = value;

  while (result.length > 0 && estimatedTextWidth(`${result}${ellipsis}`, fontSize) > maxWidth) {
    result = result.slice(0, -1);
  }

  return result ? `${result}${ellipsis}` : ellipsis;
};

const renderInteractiveWrapper = (field: PlacedField, content: string, options: RenderLabelSvgOptions) => {
  if (!options.interactive) {
    return content;
  }

  const isHovered = options.hoveredFieldId === field.id;
  const isSelected = options.selectedFieldId === field.id;
  const stroke = isSelected ? '#1d72ff' : isHovered ? '#747f8a' : 'transparent';
  const strokeWidth = isSelected ? 0.75 : isHovered ? 0.85 : 0;

  return `<g data-field-id="${escapeXml(field.id)}" class="label-field" style="cursor: move">
    <rect data-field-id="${escapeXml(field.id)}" x="${field.x}" y="${field.y}" width="${field.width}" height="${field.height}" fill="transparent" stroke="${stroke}" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke" pointer-events="all"/>
    <g pointer-events="none">${content}</g>
  </g>`;
};

const renderField = (
  field: PlacedField,
  item: HardwareItem,
  settings: LabelSettings,
  unitSystem: UnitSystem,
  qrSvgDataUri: string,
  standardImageHrefs: Map<string, string>,
  options: RenderLabelSvgOptions
) => {
  if (field.kind === 'frame') {
    const frameField = { ...field, x: 0, y: 0, width: settings.widthMm, height: settings.heightMm };
    const frameStyle = { ...defaultFrameStyle, ...field.frameStyle };
    const dashArray = frameStyle.lineStyle === 'dashed' ? ' stroke-dasharray="2 1.2"' : frameStyle.lineStyle === 'dotted' ? ' stroke-dasharray="0.1 1.1" stroke-linecap="round"' : '';
    const radius = frameStyle.shape === 'rounded' ? frameStyle.radius : 0;
    const inset = frameStyle.strokeWidth / 2;
    const width = Math.max(0, frameField.width - frameStyle.strokeWidth);
    const height = Math.max(0, frameField.height - frameStyle.strokeWidth);

    return renderInteractiveWrapper(
      frameField,
      `<rect x="${inset}" y="${inset}" width="${width}" height="${height}" fill="none" stroke="#111" stroke-width="${frameStyle.strokeWidth}" rx="${radius}"${dashArray}/>`,
      options
    );
  }

  if (field.kind === 'image') {
    const href = field.imageSource === 'custom' ? customImageHref(field) : field.imageSource === 'qr' ? qrSvgDataUri : standardImageHrefs.get(field.id) ?? '';
    if (!href) return '';
    return renderInteractiveWrapper(
      field,
      `<image x="${field.x}" y="${field.y}" width="${field.width}" height="${field.height}" href="${escapeXml(href)}" preserveAspectRatio="xMidYMid meet"/>`,
      options
    );
  }

  const value = renderTextTemplate(field.text ?? '', item, unitSystem);

  if (options.rasterSafe) {
    const textAnchor = field.style.align === 'middle' ? 'middle' : field.style.align === 'end' ? 'end' : 'start';
    const textX = field.style.align === 'middle' ? field.x + field.width / 2 : field.style.align === 'end' ? field.x + field.width : field.x;
    const textY = field.y + Math.min(field.height, field.style.fontSize) * 0.82;
    const clipId = `clip-${field.id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
    const clippedValue = ellipsizeText(value, field.width, field.style.fontSize);

    return renderInteractiveWrapper(
      field,
      `<clipPath id="${escapeXml(clipId)}"><rect x="${field.x}" y="${field.y}" width="${field.width}" height="${field.height}"/></clipPath>
    <text x="${textX}" y="${textY}" clip-path="url(#${escapeXml(clipId)})" font-family="${escapeXml(field.style.fontFamily)}" font-size="${field.style.fontSize}" font-weight="${field.style.fontWeight}" text-anchor="${textAnchor}" fill="#111">${escapeXml(clippedValue)}</text>`,
      options
    );
  }

  return renderInteractiveWrapper(
    field,
    `<foreignObject x="${field.x}" y="${field.y}" width="${field.width}" height="${field.height}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-family:${escapeXml(field.style.fontFamily)};font-size:${field.style.fontSize}px;font-weight:${field.style.fontWeight};line-height:${field.style.fontSize}px;text-align:${textAlign(field)};color:#111;">${escapeXml(value)}</div>
    </foreignObject>`,
    options
  );
};
