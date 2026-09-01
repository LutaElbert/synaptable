// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { createTableData, tableDimensions } from './table-grid';
import {
  calculatePdfLayout,
  clampRasterDimensions,
  resolveExportContent,
  tableToCsv,
} from './export-file';
import type { EditorEdge, EditorNode } from './types';

function tableNode(selected = false): EditorNode {
  const data = createTableData({
    name: 'Schedule',
    rows: 3,
    columns: 3,
    values: [
      ['Scene', 'Owner', 'Notes'],
      ['Opening', 'Chloé', 'Line one\nLine two'],
      ['Finale', 'Ana, Jr.', 'She said "go"'],
    ],
  });
  return {
    id: 'table-a',
    type: 'table',
    position: { x: 100, y: 120 },
    selected,
    style: tableDimensions(data),
    data,
  };
}

function conceptNode(id: string, selected = false, hidden = false): EditorNode {
  return {
    id,
    type: 'concept',
    position: { x: 0, y: 0 },
    selected,
    hidden,
    data: {
      kind: 'concept',
      name: id,
      label: id,
      title: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: id }] }] },
      body: { type: 'doc', content: [{ type: 'paragraph' }] },
      eyebrow: 'Idea',
      tone: 'ink',
      collapsed: false,
      horizontalAlign: 'left',
      verticalAlign: 'top',
      opacity: 1,
      locked: false,
    },
  };
}

describe('export scope resolution', () => {
  it('exports visible canvas nodes and only connectors whose endpoints are present', () => {
    const nodes = [conceptNode('a'), conceptNode('b'), conceptNode('hidden', false, true)];
    const edges: EditorEdge[] = [
      { id: 'ab', source: 'a', target: 'b', data: { label: '', kind: 'default' } },
      { id: 'ah', source: 'a', target: 'hidden', data: { label: '', kind: 'default' } },
    ];
    const content = resolveExportContent(nodes, edges, 'canvas');
    expect(content.nodes.map((node) => node.id)).toEqual(['a', 'b']);
    expect(content.edges.map((edge) => edge.id)).toEqual(['ab']);
  });

  it('exports selected layers and connectors entirely inside that selection', () => {
    const nodes = [conceptNode('a', true), conceptNode('b', true), conceptNode('c')];
    const edges: EditorEdge[] = [
      { id: 'ab', source: 'a', target: 'b', data: { label: '', kind: 'default' } },
      { id: 'bc', source: 'b', target: 'c', data: { label: '', kind: 'default' } },
    ];
    const content = resolveExportContent(nodes, edges, 'selection');
    expect(content.nodes.map((node) => node.id)).toEqual(['a', 'b']);
    expect(content.edges.map((edge) => edge.id)).toEqual(['ab']);
  });

  it('rejects an empty layer selection', () => {
    expect(() => resolveExportContent([conceptNode('a')], [], 'selection')).toThrow('Select at least one layer');
  });

  it('slices the smallest selected table rectangle for cell exports', () => {
    const node = tableNode(true);
    if (node.data.kind !== 'table') throw new Error('Expected table fixture.');
    const addresses = [
      { rowId: node.data.rows[1].id, columnId: node.data.columns[1].id },
      { rowId: node.data.rows[2].id, columnId: node.data.columns[2].id },
    ];
    const content = resolveExportContent([node], [], 'table-cells', { nodeId: node.id, addresses });
    expect(content.table?.rows.map((row) => row.cells.map((cell) => cell.text))).toEqual([
      ['Chloé', 'Line one\nLine two'],
      ['Ana, Jr.', 'She said "go"'],
    ]);
    expect(content.table?.headerRow).toBe(false);
    expect(content.nodes[0].position).toEqual({ x: 0, y: 0 });
  });
});

describe('CSV export', () => {
  it('writes a UTF-8 BOM, CRLF rows, and RFC-style escaping', () => {
    const node = tableNode();
    if (node.data.kind !== 'table') throw new Error('Expected table fixture.');
    const csv = tableToCsv(node.data);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Opening,Chloé,"Line one\nLine two"');
    expect(csv).toContain('Finale,"Ana, Jr.","She said ""go"""');
    expect(csv.split('\r\n')).toHaveLength(3);
  });
});

describe('raster and PDF geometry', () => {
  it('keeps ordinary raster requests at their requested scale', () => {
    expect(clampRasterDimensions(800, 600, 2)).toEqual({
      width: 1600,
      height: 1200,
      scale: 2,
      reduced: false,
    });
  });

  it('reduces oversized rasters within dimension and pixel safety limits', () => {
    const result = clampRasterDimensions(30_000, 20_000, 4);
    expect(result.reduced).toBe(true);
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(16_384);
    expect(result.width * result.height).toBeLessThanOrEqual(64_000_000);
  });

  it('fits content inside a landscape A4 page while preserving aspect ratio', () => {
    const layout = calculatePdfLayout(1200, 600, 'a4', 'auto', 24);
    expect(layout.pageWidth).toBeGreaterThan(layout.pageHeight);
    expect(layout.imageX).toBeGreaterThanOrEqual(24);
    expect(layout.imageY).toBeGreaterThanOrEqual(24);
    expect(layout.imageWidth / layout.imageHeight).toBeCloseTo(2);
  });
});
