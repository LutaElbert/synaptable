import { describe, expect, it } from 'vitest';
import { createTableData, tableDimensions } from './table-grid';
import { canvasNodesFromTable, tableSelectionForCanvas } from './table-to-canvas';
import { richTextToPlainText } from './rich-text';
import type { EditorNode } from './types';

function tableNode(values: string[][], options: { headerRow?: boolean; headerColumn?: boolean } = {}): EditorNode {
  const data = createTableData({
    name: 'Casting',
    rows: values.length,
    columns: values[0].length,
    values,
    headerRow: options.headerRow ?? true,
    headerColumn: options.headerColumn ?? false,
  });
  return {
    id: 'table',
    type: 'table',
    position: { x: 100, y: 80 },
    style: tableDimensions(data),
    data,
  };
}

describe('table to canvas conversion', () => {
  it('maps data rows to ordered concepts and uses headers as body labels', () => {
    const table = tableNode([
      ['Character', 'Role', 'Notes'],
      ['Mara', 'Lead', 'Carries the story'],
      ['Ivo', 'Friend', 'Comic relief'],
    ]);
    const source = structuredClone(table);
    const nodes = canvasNodesFromTable(table, [table], { mode: 'table', nodeId: table.id });

    expect(nodes.map((node) => node.data.name)).toEqual(['Mara', 'Ivo']);
    expect(nodes.map((node) => node.data.kind === 'concept' ? richTextToPlainText(node.data.body) : '')).toEqual([
      'Role\nLead\nNotes\nCarries the story',
      'Role\nFriend\nNotes\nComic relief',
    ]);
    expect(nodes[1].position.y).toBeGreaterThan(nodes[0].position.y);
    expect(nodes[0].position.x).toBeGreaterThan(table.position.x + tableDimensions(table.data.kind === 'table' ? table.data : createTableData()).width);
    expect(table).toEqual(source);
  });

  it('uses only a selected rectangular range and keeps explicit row order', () => {
    const table = tableNode([
      ['Name', 'Status', 'Owner'],
      ['Scene 1', 'Ready', 'Ana'],
      ['Scene 2', 'Draft', 'Bo'],
    ]);
    if (table.data.kind !== 'table') throw new Error('Expected table.');
    const interaction = {
      mode: 'cell' as const,
      nodeId: table.id,
      anchor: { rowId: table.data.rows[2].id, columnId: table.data.columns[0].id },
      focus: { rowId: table.data.rows[1].id, columnId: table.data.columns[1].id },
    };
    expect(tableSelectionForCanvas(table.data, interaction)).toEqual({ rowIndexes: [1, 2], columnIndexes: [0, 1] });
    const nodes = canvasNodesFromTable(table, [table], interaction);
    expect(nodes.map((node) => node.data.name)).toEqual(['Scene 1', 'Scene 2']);
    expect(nodes.map((node) => node.data.kind === 'concept' ? richTextToPlainText(node.data.body) : '')).toEqual([
      'Status\nReady',
      'Status\nDraft',
    ]);
  });

  it('skips a header column for titles and preserves empty rows as identifiable concepts', () => {
    const table = tableNode([
      ['Index', 'Title', 'Notes'],
      ['1', 'Opening', ''],
      ['2', '', ''],
    ], { headerColumn: true });
    const nodes = canvasNodesFromTable(table, [table], { mode: 'table', nodeId: table.id });
    expect(nodes.map((node) => node.data.name)).toEqual(['Opening', 'Untitled row']);
    expect(nodes[0].data.kind === 'concept' ? richTextToPlainText(nodes[0].data.body) : '').toBe('Index\n1');
  });

  it('retains supported marks, removes unsafe links, and avoids existing node bounds', () => {
    const table = tableNode([
      ['Name', 'Link'],
      ['Mara', 'Portfolio'],
    ]);
    if (table.data.kind !== 'table') throw new Error('Expected table.');
    table.data.rows[1].cells[1].content = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Portfolio', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'javascript:alert(1)' } }] }],
      }],
    };
    const blocker: EditorNode = {
      id: 'blocker',
      type: 'concept',
      position: { x: 560, y: 80 },
      style: { width: 220, height: 120 },
      data: {
        kind: 'concept', name: 'Blocker', label: 'Blocker', title: { type: 'doc', content: [] }, body: { type: 'doc', content: [] },
        eyebrow: '', tone: 'ink', collapsed: false, horizontalAlign: 'left', verticalAlign: 'top', opacity: 1, locked: false,
      },
    };
    const [node] = canvasNodesFromTable(table, [table, blocker], { mode: 'table', nodeId: table.id });
    expect(node.position.y).toBeGreaterThan(blocker.position.y);
    if (node.data.kind !== 'concept') throw new Error('Expected concept.');
    const marks = node.data.body.content?.flatMap((block) => block.content ?? []).flatMap((child) => child.marks ?? []) ?? [];
    expect(marks.some((mark) => mark.type === 'bold')).toBe(true);
    expect(marks.some((mark) => mark.type === 'link')).toBe(false);
  });
});
