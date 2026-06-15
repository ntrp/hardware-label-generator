export const defaultTechnicalDrawingStrokeWidth = 0.35;

export const normalizedSvgStrokeWidth = (value: number | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Number(value.toFixed(2));
};

export const applySvgStrokeWidth = (svg: string, strokeWidth: number | undefined) => {
  const normalized = normalizedSvgStrokeWidth(strokeWidth);
  if (!normalized) return svg;

  return svg
    .replace(/\bstroke-width\s*=\s*"[^"]*"/g, `stroke-width="${normalized}"`)
    .replace(/\bstroke-width\s*=\s*'[^']*'/g, `stroke-width="${normalized}"`)
    .replace(/stroke-width\s*:\s*[^;"']+/g, `stroke-width:${normalized}`);
};
