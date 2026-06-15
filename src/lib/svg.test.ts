import { describe, expect, it, vi } from 'vitest';
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

  it('renders stable interactive hit targets without stateful outline markup', async () => {
    const svg = await renderLabelSvg(defaultHardwareItem, defaultLabelSettings, '', 'metric', {
      interactive: true,
      hoveredFieldId: 'field-standard',
      selectedFieldId: 'field-size'
    });

    expect(svg).toContain('data-field-id="field-standard" x="3" y="4" width="29" height="5" fill="transparent" stroke="transparent" stroke-width="0"');
    expect(svg).toContain('data-field-id="field-size" x="3" y="11" width="28" height="10" fill="transparent" stroke="transparent" stroke-width="0"');
    expect(svg).not.toContain('stroke="#747f8a"');
    expect(svg).not.toContain('stroke="#1d72ff"');
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

  it('renders standard iso, side, and top image URLs in SVG output', async () => {
    const svg = await renderLabelSvg(
      { ...defaultHardwareItem, standardCodes: { DIN: 'DIN 1587' } },
      {
        ...defaultLabelSettings,
        fields: [
          {
            id: 'field-iso-image',
            kind: 'image',
            imageSource: 'iso',
            rotationDeg: 15,
            x: 2,
            y: 2,
            width: 10,
            height: 10,
            style: { fontFamily: 'Inter', fontSize: 4, fontWeight: 700, align: 'middle', visible: true }
          },
          {
            id: 'field-side-image',
            kind: 'image',
            imageSource: 'side',
            x: 14,
            y: 2,
            width: 10,
            height: 10,
            style: { fontFamily: 'Inter', fontSize: 4, fontWeight: 700, align: 'middle', visible: true }
          },
          {
            id: 'field-top-image',
            kind: 'image',
            imageSource: 'top',
            x: 26,
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

    expect(svg).toContain('./catalog-assets/din-912/iso.svg');
    expect(svg).toContain('./catalog-assets/din-912/side.svg');
    expect(svg).toContain('./catalog-assets/din-912/top.svg');
    expect(svg).toContain('transform="rotate(15 7 7)"');
  });

  it('renders a placeholder when a standard image is missing', async () => {
    const svg = await renderLabelSvg(
      { ...defaultHardwareItem, catalogId: undefined },
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
          }
        ]
      },
      '',
      'metric'
    );

    expect(svg).toContain('data:image/svg+xml;charset=utf-8');
    expect(svg).toContain('Side%20drawing');
  });

  it('embeds configured standard SVG image line thickness', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<svg xmlns="http://www.w3.org/2000/svg"><g stroke-width="0.35"><path d="M0 0L1 1"/></g></svg>'))
    );

    try {
      const svg = await renderLabelSvg(
        defaultHardwareItem,
        {
          ...defaultLabelSettings,
          fields: [
            {
              id: 'field-side-image',
              kind: 'image',
              imageSource: 'side',
              svgStrokeWidth: 0.9,
              x: 2,
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

      const href = svg.match(/href="data:image\/svg\+xml;base64,([^"]+)"/)?.[1] ?? '';
      const embeddedSvg = Buffer.from(href, 'base64').toString('utf8');

      expect(embeddedSvg).toContain('stroke-width="0.9"');
      expect(embeddedSvg).not.toContain('stroke-width="0.35"');
    } finally {
      vi.unstubAllGlobals();
    }
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
