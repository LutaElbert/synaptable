import { describe, expect, it } from 'vitest';
import { createTableData } from './table-grid';
import { createStarterDocument, duplicateProjectDocument } from './project-library';
import { initialDocument } from './initial-document';
import type { EditorNode } from './types';

describe('project library documents', () => {
  it('creates blank, idea, and table starters', () => {
    expect(createStarterDocument('blank').nodes).toEqual([]);
    expect(createStarterDocument('idea').nodes).toHaveLength(initialDocument.nodes.length);
    const table = createStarterDocument('table');
    expect(table.nodes).toHaveLength(1);
    expect(table.nodes[0].data.kind).toBe('table');
  });

  it('duplicates graph content with independent nested ids', () => {
    const table: EditorNode = {
      id: 'table',
      type: 'table',
      position: { x: 0, y: 0 },
      data: createTableData({ values: [['Header'], ['Value']] }),
    };
    const source = structuredClone(initialDocument);
    source.nodes.push(table);
    const copy = duplicateProjectDocument(source);
    expect(copy.title).toBe(`Copy of ${source.title}`);
    expect(new Set(copy.nodes.map((node) => node.id))).not.toEqual(new Set(source.nodes.map((node) => node.id)));
    expect(copy.edges[0].source).not.toBe(source.edges[0].source);
    const sourceTable = source.nodes.at(-1)?.data;
    const copiedTable = copy.nodes.at(-1)?.data;
    if (sourceTable?.kind !== 'table' || copiedTable?.kind !== 'table') throw new Error('Expected table fixtures.');
    expect(copiedTable.rows[0].id).not.toBe(sourceTable.rows[0].id);
    expect(copiedTable.rows[0].cells[0].id).not.toBe(sourceTable.rows[0].cells[0].id);
  });
});
