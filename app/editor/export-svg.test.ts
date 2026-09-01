import { describe, expect, it } from 'vitest';
import { buildSvgDocument, buildSvgExport } from './export-svg';
import { initialDocument } from './initial-document';
import { createTableData, tableDimensions } from './table-grid';
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
          horizontalAlign: 'left',
          verticalAlign: 'top',
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

  it('applies configurable padding and an optional white background', () => {
    const node = structuredClone(initialDocument.nodes[0]);
    node.style = { width: 220, height: 100 };
    const transparent = buildSvgExport([node], [], { padding: 0 });
    const white = buildSvgExport([node], [], { padding: 20, background: 'white' });
    expect(white.width).toBe(transparent.width + 40);
    expect(white.height).toBe(transparent.height + 40);
    expect(white.svg).toContain(`<rect width="${white.width}" height="${white.height}" fill="#ffffff" />`);
    expect(transparent.svg).not.toContain('fill="#ffffff" />');
  });

  it('exports connector labels and styles', () => {
    const nodes = structuredClone(initialDocument.nodes);
    const edges = structuredClone(initialDocument.edges);
    edges[0].data = { label: 'supports & explains', kind: 'dashed' };
    const svg = buildSvgDocument(nodes, edges);
    expect(svg).toContain('supports &amp; explains');
    expect(svg).toContain('stroke-dasharray="6 5"');
  });

  it('exports content alignment and bottom-to-top child connectors', () => {
    const nodes = structuredClone(initialDocument.nodes.slice(0, 2));
    const parent = nodes[0];
    const child = nodes[1];
    if (parent.data.kind !== 'concept') throw new Error('Expected a concept fixture.');
    parent.style = { width: 220, height: 180 };
    parent.data.horizontalAlign = 'center';
    parent.data.verticalAlign = 'bottom';
    child.position = { x: 130, y: 500 };
    const edge = {
      ...structuredClone(initialDocument.edges[0]),
      source: parent.id,
      target: child.id,
      sourceHandle: 'bottom',
      targetHandle: 'top',
    };
    const svg = buildSvgDocument(nodes, [edge]);
    expect(svg).toContain('text-anchor="middle"');
    expect(svg).toContain('M 158 228 C 158');
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

  it('exports table captions, cells, headers, styling, and escaped text', () => {
    const data = createTableData({
      name: 'Shoot & schedule',
      rows: 2,
      columns: 2,
      values: [['Scene', 'Status'], ['Opening <shot>', 'Ready']],
      headerRow: true,
    });
    data.rows[1].cells[1].tone = 'mint';
    data.rows[1].cells[1].horizontalAlign = 'right';
    const node: EditorNode = {
      id: 'table-a',
      type: 'table',
      position: { x: 20, y: 30 },
      style: tableDimensions(data),
      data,
    };

    const svg = buildSvgDocument([node], []);

    expect(svg).toContain('Shoot &amp; schedule');
    expect(svg).toContain('Opening &lt;shot&gt;');
    expect(svg).toContain('fill="#e8f7ef"');
    expect(svg).toContain('text-anchor="end"');
    expect(svg).toContain('font-weight="700"');
  });

  it('preserves rich table-cell marks and safe links in SVG', () => {
    const data = createTableData({ rows: 1, columns: 1, headerRow: false });
    data.rows[0].cells[0].content = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Formatted scene',
          marks: [
            { type: 'bold' },
            { type: 'italic' },
            { type: 'underline' },
            { type: 'strike' },
            { type: 'link', attrs: { href: 'https://example.com/scene' } },
          ],
        }],
      }],
    };
    const node: EditorNode = {
      id: 'rich-table',
      type: 'table',
      position: { x: 0, y: 0 },
      style: tableDimensions(data),
      data,
    };
    const svg = buildSvgDocument([node], []);
    expect(svg).toContain('font-weight="700"');
    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain('text-decoration="underline line-through"');
    expect(svg).toContain('href="https://example.com/scene"');
    expect(svg).toContain('Formatted scene');
  });
});
