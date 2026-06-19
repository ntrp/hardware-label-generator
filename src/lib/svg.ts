import type { HardwareItem, LabelSettings, PlacedField, UnitSystem } from '../types';
import { defaultFrameStyle } from './defaults';
import { renderTextTemplate, type PlaceholderDisplayValue } from './format';
import { buildQrPayload, createQrPngDataUrl, createQrSvg } from './qr';
import { isStandardImageSource, missingCatalogAssetDataUrl, standardImageUrlForItem } from './standardImages';
import { applySvgStrokeWidth, normalizedSvgStrokeWidth } from './svgAssets';

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

const svgTextToDataUrl = (svg: string) => {
  const bytes = new TextEncoder().encode(svg);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `data:image/svg+xml;base64,${btoa(binary)}`;
};

const standardImageHrefCache = new Map<string, Promise<string>>();

const standardImageHref = async (url: string, field: PlacedField, rasterSafe: boolean | undefined) => {
  const fallback = missingCatalogAssetDataUrl('Image missing');
  if (!url) return fallback;
  if (url.startsWith('data:')) return url;
  const strokeWidth = normalizedSvgStrokeWidth(field.svgStrokeWidth);
  const cacheKey = `${rasterSafe ? 'raster' : 'svg'}|${url}|${strokeWidth ?? 'default'}`;
  const cached = standardImageHrefCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const hrefPromise = (async () => {
    if (strokeWidth) {
      try {
        const response = await fetch(url);
        if (!response.ok) return fallback;
        return svgTextToDataUrl(applySvgStrokeWidth(await response.text(), strokeWidth));
      } catch {
        return fallback;
      }
    }

    if (!rasterSafe) return url;

    try {
      return await rasterSafeStandardImageHref(url);
    } catch {
      return fallback;
    }
  })();

  standardImageHrefCache.set(cacheKey, hrefPromise);
  return hrefPromise;
};

export interface RenderLabelSvgOptions {
  interactive?: boolean;
  hoveredFieldId?: string | null;
  selectedFieldId?: string | null;
  rasterSafe?: boolean;
  omitImageContent?: boolean;
  displaySpecValue?: PlaceholderDisplayValue;
}

export const resolveLabelImageHref = async (field: PlacedField, item: HardwareItem, purchaseLink: string, rasterSafe?: boolean) => {
  if (field.kind !== 'image') return '';
  if (field.imageSource === 'custom') return customImageHref(field);

  if (field.imageSource === 'qr') {
    const qrPayload = buildQrPayload(purchaseLink);
    if (!qrPayload.target) return '';
    if (rasterSafe) return createQrPngDataUrl(qrPayload.target);
    const qrSvg = await createQrSvg(qrPayload.target);
    return `data:image/svg+xml;base64,${btoa(qrSvg)}`;
  }

  const url = standardImageUrlForItem(item, field.imageSource);
  return standardImageHref(url, field, rasterSafe);
};

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

  if (!options.omitImageContent && qrPayload.target && settings.fields.some((field) => field.kind === 'image' && field.imageSource === 'qr' && field.style.visible)) {
    if (options.rasterSafe) {
      qrSvgDataUri = await createQrPngDataUrl(qrPayload.target);
    } else {
      const qrSvg = await createQrSvg(qrPayload.target);
      qrSvgDataUri = `data:image/svg+xml;base64,${btoa(qrSvg)}`;
    }
  }

  if (!options.omitImageContent && settings.fields.some((field) => field.kind === 'image' && field.style.visible && isStandardImageSource(field.imageSource))) {
    await Promise.all(
      settings.fields
        .filter((field) => field.kind === 'image' && field.style.visible && isStandardImageSource(field.imageSource))
        .map(async (field) => {
          const url = standardImageUrlForItem(item, field.imageSource);
          standardImageHrefs.set(field.id, await standardImageHref(url, field, options.rasterSafe));
        })
    );
  }

  const visibleFields = settings.fields.filter((field) => field.style.visible);
  const orderedFields = [
    ...visibleFields.filter((field) => field.kind === 'frame'),
    ...visibleFields.filter((field) => field.kind !== 'frame')
  ];
  const fields = orderedFields
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

  if (field.kind === 'frame') {
    return `<g class="label-frame" pointer-events="none">${content}</g>`;
  }

  return `<g data-field-id="${escapeXml(field.id)}" class="label-field" style="cursor: move">
    <rect data-field-id="${escapeXml(field.id)}" x="${field.x}" y="${field.y}" width="${field.width}" height="${field.height}" fill="transparent" stroke="transparent" stroke-width="0" vector-effect="non-scaling-stroke" pointer-events="all"/>
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
    if (options.omitImageContent) {
      return renderInteractiveWrapper(field, '', options);
    }

    const href = field.imageSource === 'custom' ? customImageHref(field) : field.imageSource === 'qr' ? qrSvgDataUri : standardImageHrefs.get(field.id) ?? '';
    if (!href) return '';
    const rotationDeg = Number.isFinite(field.rotationDeg) ? Number(field.rotationDeg) : 0;
    const centerX = field.x + field.width / 2;
    const centerY = field.y + field.height / 2;
    const transform = rotationDeg ? ` transform="rotate(${rotationDeg} ${centerX} ${centerY})"` : '';
    return renderInteractiveWrapper(
      field,
      `<image x="${field.x}" y="${field.y}" width="${field.width}" height="${field.height}" href="${escapeXml(href)}" preserveAspectRatio="xMidYMid meet"${transform}/>`,
      options
    );
  }

  const value = renderTextTemplate(field.text ?? '', item, unitSystem, options.displaySpecValue);

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
