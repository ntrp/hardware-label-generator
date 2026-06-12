import { describe, expect, it } from 'vitest';
import { defaultAppState, defaultHardwareItem, defaultLabelSettings } from './defaults';
import { effectivePurchaseLinks } from './export';
import { renderLabelSvg } from './svg';

describe('SVG rendering', () => {
  it('renders label geometry and fastener text', async () => {
    const svg = await renderLabelSvg(defaultHardwareItem, defaultLabelSettings, effectivePurchaseLinks(defaultAppState.purchaseLinks, defaultHardwareItem), 'metric');

    expect(svg).toContain('width="54mm"');
    expect(svg).toContain('DIN 912 ISO 4762');
    expect(svg).toContain('text-overflow:ellipsis');
    expect(svg).toContain('M3');
    expect(svg).toContain('12 mm');
    expect(svg).toContain('data:image/svg+xml');
    expect(svg).not.toContain('width="53.3" height="29.3"');
  });

  it('renders gray hover outlines and blue selected outlines', async () => {
    const svg = await renderLabelSvg(defaultHardwareItem, defaultLabelSettings, [], 'metric', {
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
      [],
      'metric'
    );

    expect(svg).toContain('x="0.4" y="0.4" width="53.2" height="29.2"');
    expect(svg).toContain('stroke-width="0.8" rx="3" stroke-dasharray="2 1.2"');
  });
});
