import { describe, expect, it } from 'vitest';
import { buildSvgDocument } from './export-svg';
import { initialDocument } from './initial-document';
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
          title: {
            type: 'doc',
            content: [{
              type: 'paragraph',
              content: [{
                type: 'text',
                text: 'Ideas & notes',
                marks: [{ type: 'bold' }, { type: 'italic' }],
              }],
            }],
          },
          body: {
            type: 'doc',
            content: [{
              type: 'bulletList',
              content: [{
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Bold action', marks: [{ type: 'bold' }] }],
                }],
              }],
            }],
          },
          eyebrow: 'Start',
          tone: 'indigo',
          collapsed: false,
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
              locked: false,
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
              locked: false,
            },
          ],
        },
      },
    ];

    const svg = buildSvgDocument(nodes, []);

    expect(svg).toContain('<svg');
    expect(svg).toContain('Ideas &amp; notes');
    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain('Bold action');
    expect(svg).toContain('font-weight="700"');
    expect(svg).toContain('•');
    expect(svg).toContain('id="visible-path"');
    expect(svg).not.toContain('id="hidden-path"');
  });

  it('rejects an empty visible canvas', () => {
    expect(() => buildSvgDocument([], [])).toThrow('nothing visible');
  });

  it('exports connector labels and styles', () => {
    const nodes = structuredClone(initialDocument.nodes);
    const edges = structuredClone(initialDocument.edges);
    edges[0].data = { label: 'supports & explains', kind: 'dashed' };
    const svg = buildSvgDocument(nodes, edges);
    expect(svg).toContain('supports &amp; explains');
    expect(svg).toContain('stroke-dasharray="6 5"');
  });

  it('omits trailing empty checklist rows from exported SVG content and height', () => {
    const nodes = structuredClone(initialDocument.nodes);
    const concept = nodes[0];
    if (concept.data.kind !== 'concept') throw new Error('Expected a concept fixture.');
    concept.data.body = {
      type: 'doc',
      content: [{
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Only item' }] }],
          },
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph' }],
          },
        ],
      }],
    };

    const svg = buildSvgDocument([concept], []);
    expect(svg.match(/☐/g)).toHaveLength(1);
  });
});
