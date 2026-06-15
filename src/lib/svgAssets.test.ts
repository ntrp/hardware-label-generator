import { describe, expect, it } from 'vitest';
import { applySvgStrokeWidth, normalizedSvgStrokeWidth } from './svgAssets';

describe('SVG asset helpers', () => {
  it('normalizes positive stroke widths only', () => {
    expect(normalizedSvgStrokeWidth(1.234)).toBe(1.23);
    expect(normalizedSvgStrokeWidth(0)).toBeUndefined();
    expect(normalizedSvgStrokeWidth(Number.NaN)).toBeUndefined();
    expect(normalizedSvgStrokeWidth(undefined)).toBeUndefined();
  });

  it('rewrites SVG stroke width attributes and inline styles', () => {
    const svg = '<svg><g stroke-width="0.35" style="stroke-width:0.2;stroke:#000"><path stroke-width=\'0.1\'/></g></svg>';

    expect(applySvgStrokeWidth(svg, 0.8)).toBe('<svg><g stroke-width="0.8" style="stroke-width:0.8;stroke:#000"><path stroke-width="0.8"/></g></svg>');
  });
});
