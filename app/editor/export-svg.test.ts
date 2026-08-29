import { describe, expect, it } from 'vitest';
import { buildSvgDocument } from './export-svg';
import type { EditorNode } from './types';

describe('buildSvgDocument', () => {
  it('exports visible concepts and only visible vector paths', () => {
    const nodes: EditorNode[] = [
      {
        id: 'concept-a',
        type: 'concept',
        position: { x: 10, y: 20 },
        data: {
          kind: 'concept',
          name: 'Ideas & notes',
          label: 'Ideas & notes',
          eyebrow: 'Start',
          tone: 'indigo',
          opacity: 1,
          locked: false,
        },
      },
      {
        id: 'vector-a',
        type: 'vector',
        position: { x: 260, y: 20 },
        style: { width: 100, height: 80 },
        data: {
          kind: 'vector',
          name: 'Vector',
          sourceName: 'source.png',
          viewBox: [0, 0, 100, 80],
          opacity: 1,
          locked: false,
          paths: [
            {
              id: 'visible-path',
              name: 'Visible',
              d: 'M0 0H10V10Z',
              fill: '#635bff',
              stroke: 'none',
              strokeWidth: 0,
              opacity: 1,
              visible: true,
            },
            {
              id: 'hidden-path',
              name: 'Hidden',
              d: 'M20 20H30V30Z',
              fill: '#000000',
              stroke: 'none',
              strokeWidth: 0,
              opacity: 1,
              visible: false,
            },
          ],
        },
      },
    ];

    const svg = buildSvgDocument(nodes, []);

    expect(svg).toContain('<svg');
    expect(svg).toContain('Ideas &amp; notes');
    expect(svg).toContain('id="visible-path"');
    expect(svg).not.toContain('id="hidden-path"');
  });

  it('rejects an empty visible canvas', () => {
    expect(() => buildSvgDocument([], [])).toThrow('nothing visible');
  });
});
