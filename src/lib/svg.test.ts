import { describe, expect, it } from 'vitest';
import { defaultHardwareItem, defaultLabelSettings } from './defaults';
import { renderLabelSvg } from './svg';

describe('SVG rendering', () => {
  it('renders label geometry and fastener text', async () => {
    const svg = await renderLabelSvg(defaultHardwareItem, defaultLabelSettings, 'https://example.com/a2', 'metric');

    expect(svg).toContain('width="54mm"');
    expect(svg).toContain('DIN 912 ISO 4762');
    expect(svg).toContain('text-overflow:ellipsis');
    expect(svg).toContain('M3');
    expect(svg).toContain('12 mm');
    expect(svg).toContain('data:image/svg+xml');
    expect(svg).not.toContain('width="53.3" height="29.3"');
  });

  it('renders gray hover outlines and blue selected outlines', async () => {
    const svg = await renderLabelSvg(defaultHardwareItem, defaultLabelSettings, '', 'metric', {
      interactive: true,
      hoveredFieldId: 'field-standard',
      selectedFieldId: 'field-size'
    });

    expect(svg).toContain('data-field-id="field-standard" x="3" y="4" width="29" height="5" fill="transparent" stroke="#747f8a" stroke-width="0.85"');
    expect(svg).toContain('data-field-id="field-size" x="3" y="11" width="28" height="10" fill="transparent" stroke="#1d72ff" stroke-width="0.75"');
  });

  it('renders styled frame elements as explicit label borders', async () => {
    const svg = await renderLabelSvg(
      defaultHardwareItem,
      {
        ...defaultLabelSettings,
        fields: [
          {
            id: 'field-frame',
            kind: 'frame',
            x: 1,
            y: 1,
            width: 52,
            height: 28,
            style: { fontFamily: 'Inter', fontSize: 7, fontWeight: 700, align: 'start', visible: true },
            frameStyle: { shape: 'rounded', strokeWidth: 0.8, radius: 3, lineStyle: 'dashed' }
          }
        ]
      },
      '',
      'metric'
    );

    expect(svg).toContain('x="0.4" y="0.4" width="53.2" height="29.2"');
    expect(svg).toContain('stroke-width="0.8" rx="3" stroke-dasharray="2 1.2"');
  });

  it('renders custom image bytes in SVG output', async () => {
    const svg = await renderLabelSvg(
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

    expect(svg).toContain('href="data:image/png;base64,iVBORw0KGgo="');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it('renders standard side and top image URLs in SVG output', async () => {
    const svg = await renderLabelSvg(
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
            width: 10,
            height: 10,
            style: { fontFamily: 'Inter', fontSize: 4, fontWeight: 700, align: 'middle', visible: true }
          },
          {
            id: 'field-top-image',
            kind: 'image',
            imageSource: 'top',
            x: 14,
            y: 2,
            width: 10,
            height: 10,
            style: { fontFamily: 'Inter', fontSize: 4, fontWeight: 700, align: 'middle', visible: true }
          }
        ]
      },
      '',
      'metric'
    );

    expect(svg).toContain('./catalog-assets/din-912/side.svg');
    expect(svg).toContain('./catalog-assets/din-912/top.svg');
  });

  it('can render a raster-safe SVG for PNG export', async () => {
    const svg = await renderLabelSvg(defaultHardwareItem, defaultLabelSettings, 'https://example.com/a2', 'metric', { rasterSafe: true });

    expect(svg).not.toContain('<foreignObject');
    expect(svg).not.toContain('text-overflow:ellipsis');
    expect(svg).toContain('<text');
    expect(svg).toContain('<clipPath');
    expect(svg).toContain('data:image/png;base64');
    expect(svg).toContain('DIN 912');
  });
});
