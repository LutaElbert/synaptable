import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import {
  parseProjectBackup,
  serializeProjectBackup,
  validateEditorDocument,
} from './document-file';
import { createTableData, tableCellPlainText, tableDimensions } from './table-grid';
import type { EditorNode } from './types';

describe('SynapTable project backups', () => {
  it('round-trips a valid document through the portable envelope', () => {
    const source = serializeProjectBackup(initialDocument);
    const restored = parseProjectBackup(source);

    expect(restored.title).toBe(initialDocument.title);
    expect(restored.nodes).toHaveLength(initialDocument.nodes.length);
    expect(restored.edges).toHaveLength(initialDocument.edges.length);
    expect(restored.nodes.every((node) => node.selected === false)).toBe(true);
    expect(restored.schemaVersion).toBe(6);
  });

  it('migrates version 1 projects to the current document version', () => {
    const legacy = structuredClone(initialDocument) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    const nodes = legacy.nodes as Array<{ data: Record<string, unknown> }>;
    for (const node of nodes) {
      delete node.data.body;
      delete node.data.collapsed;
      delete node.data.title;
    }
    const migrated = validateEditorDocument(legacy);
    expect(migrated.schemaVersion).toBe(6);
    const concept = migrated.nodes.find((node) => node.data.kind === 'concept');
    expect(concept?.data.kind === 'concept' && concept.data.body.type).toBe('doc');
    expect(concept?.data.kind === 'concept' && concept.data.title.type).toBe('doc');
  });

  it('migrates version 2 labels into formatted titles', () => {
    const legacy = structuredClone(initialDocument) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 2;
    const nodes = legacy.nodes as Array<{ data: Record<string, unknown> }>;
    for (const node of nodes) delete node.data.title;
    const migrated = validateEditorDocument(legacy);
    const concept = migrated.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    expect(migrated.schemaVersion).toBe(6);
    expect(concept.data.title.content?.[0].content?.[0].marks).toEqual([{ type: 'bold' }]);
  });

  it('migrates version 3 concepts to default content alignment', () => {
    const legacy = structuredClone(initialDocument) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 3;
    const nodes = legacy.nodes as Array<{ data: Record<string, unknown> }>;
    for (const node of nodes) {
      delete node.data.horizontalAlign;
      delete node.data.verticalAlign;
    }
    const migrated = validateEditorDocument(legacy);
    const concept = migrated.nodes.find((node) => node.data.kind === 'concept');
    expect(migrated.schemaVersion).toBe(6);
    expect(concept?.data.kind === 'concept' && concept.data.horizontalAlign).toBe('left');
    expect(concept?.data.kind === 'concept' && concept.data.verticalAlign).toBe('top');
  });

  it('migrates and round-trips content alignment from version 4 projects', () => {
    const document = structuredClone(initialDocument);
    const legacy = document as unknown as { schemaVersion: number };
    legacy.schemaVersion = 4;
    const concept = document.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.horizontalAlign = 'right';
    concept.data.verticalAlign = 'bottom';
    const restored = parseProjectBackup(serializeProjectBackup(document));
    const restoredConcept = restored.nodes.find((node) => node.id === concept.id);
    expect(restoredConcept?.data.kind === 'concept' && restoredConcept.data.horizontalAlign).toBe('right');
    expect(restoredConcept?.data.kind === 'concept' && restoredConcept.data.verticalAlign).toBe('bottom');
  });

  it('round-trips rich table cells through backup validation', () => {
    const document = structuredClone(initialDocument);
    const data = createTableData({
      name: 'Shoot schedule',
      rows: 3,
      columns: 2,
      values: [['Scene', 'Time'], ['Opening', '08:00'], ['Finale', '17:30']],
      headerRow: true,
      headerColumn: true,
    });
    data.rows[1].cells[0].content = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Opening',
          marks: [
            { type: 'bold' },
            { type: 'link', attrs: { href: 'https://example.com/opening' } },
          ],
        }],
      }],
    };
    const dimensions = tableDimensions(data);
    const table: EditorNode = {
      id: 'schedule-table',
      type: 'table',
      position: { x: 700, y: 200 },
      style: dimensions,
      data,
    };
    document.nodes.push(table);

    const restored = parseProjectBackup(serializeProjectBackup(document));
    const restoredTable = restored.nodes.find((node) => node.id === table.id);
    expect(restored.schemaVersion).toBe(6);
    expect(restoredTable?.data.kind).toBe('table');
    expect(restoredTable?.data.kind === 'table' && tableCellPlainText(restoredTable.data.rows[2].cells[0])).toBe('Finale');
    expect(restoredTable?.data.kind === 'table' && restoredTable.data.rows[1].cells[0].content.content?.[0].content?.[0].marks)
      .toEqual([
        { type: 'bold' },
        { type: 'link', attrs: { href: 'https://example.com/opening' } },
      ]);
    expect(restoredTable?.data.kind === 'table' && restoredTable.data.headerColumn).toBe(true);
  });

  it('migrates version 5 plain-text table cells into rich content', () => {
    const document = structuredClone(initialDocument);
    const tableData = createTableData({
      rows: 1,
      columns: 1,
      values: [['Legacy scene']],
      headerRow: false,
    });
    document.nodes.push({
      id: 'legacy-table',
      type: 'table',
      position: { x: 0, y: 0 },
      style: tableDimensions(tableData),
      data: tableData,
    });
    const legacy = document as unknown as {
      schemaVersion: number;
      nodes: Array<{ data: Record<string, unknown> }>;
    };
    legacy.schemaVersion = 5;
    const table = legacy.nodes.find((node) => node.data.kind === 'table');
    const rows = table?.data.rows as Array<{ cells: Array<Record<string, unknown>> }>;
    for (const row of rows) {
      for (const cell of row.cells) {
        cell.text = tableCellPlainText(cell as unknown as ReturnType<typeof createTableData>['rows'][number]['cells'][number]);
        delete cell.content;
      }
    }

    const migrated = validateEditorDocument(legacy);
    const migratedTable = migrated.nodes.find((node) => node.id === 'legacy-table');
    expect(migrated.schemaVersion).toBe(6);
    expect(migratedTable?.data.kind === 'table' && tableCellPlainText(migratedTable.data.rows[0].cells[0]))
      .toBe('Legacy scene');
  });

  it('rejects ragged, duplicate-id, and oversized table data', () => {
    const document = structuredClone(initialDocument);
    const data = createTableData({ rows: 2, columns: 2 });
    document.nodes.push({
      id: 'invalid-table',
      type: 'table',
      position: { x: 0, y: 0 },
      data,
    });
    const table = document.nodes.at(-1);
    if (!table || table.data.kind !== 'table') throw new Error('Missing table fixture.');

    table.data.rows[0].cells.pop();
    expect(() => validateEditorDocument(document)).toThrow('does not match');

    table.data.rows[0].cells.push(structuredClone(table.data.rows[1].cells[0]));
    expect(() => validateEditorDocument(document)).toThrow('duplicate table ids');

    table.data.rows[0].cells[1].id = crypto.randomUUID();
    table.data.rows[0].cells[1].content = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(2_001) }] }],
    };
    expect(() => validateEditorDocument(document)).toThrow('too long');
  });

  it('removes trailing empty checklist rows while loading saved documents', () => {
    const stored = structuredClone(initialDocument);
    const concept = stored.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.body = {
      type: 'doc',
      content: [{
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep' }] }],
          },
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph' }],
          },
        ],
      }],
    };

    const restored = validateEditorDocument(stored);
    const restoredConcept = restored.nodes.find((node) => node.id === concept.id);
    expect(restoredConcept?.data.kind === 'concept' && restoredConcept.data.body.content?.[0].content).toHaveLength(1);
  });

  it('rejects multiline concept titles', () => {
    const invalid = structuredClone(initialDocument);
    const concept = invalid.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.title = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
      ],
    };
    expect(() => validateEditorDocument(invalid)).toThrow('single line');
  });

  it('rejects unsafe links in concept titles', () => {
    const unsafe = structuredClone(initialDocument);
    const concept = unsafe.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.title.content = [{
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'unsafe',
        marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
      }],
    }];
    expect(() => validateEditorDocument(unsafe)).toThrow('unsafe link');
  });

  it('rejects unsafe rich-text links', () => {
    const unsafe = structuredClone(initialDocument);
    const concept = unsafe.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.body = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{
        type: 'text',
        text: 'unsafe',
        marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
      }] }],
    };
    expect(() => validateEditorDocument(unsafe)).toThrow('unsafe link');
  });

  it('rejects duplicate layer ids', () => {
    const duplicate = structuredClone(initialDocument);
    duplicate.nodes[1].id = duplicate.nodes[0].id;
    expect(() => validateEditorDocument(duplicate)).toThrow('duplicate layer ids');
  });

  it.each([
    {
      name: 'duplicate connector ids',
      message: 'duplicate connector ids',
      mutate(document: typeof initialDocument) {
        document.edges[1].id = document.edges[0].id;
      },
    },
    {
      name: 'missing connector endpoints',
      message: 'missing layer',
      mutate(document: typeof initialDocument) {
        document.edges[0].target = 'missing-layer';
      },
    },
    {
      name: 'self-connections',
      message: 'layer to itself',
      mutate(document: typeof initialDocument) {
        document.edges[0].target = document.edges[0].source;
      },
    },
    {
      name: 'duplicate directed connectors',
      message: 'duplicate directed connectors',
      mutate(document: typeof initialDocument) {
        document.edges[1].source = document.edges[0].source;
        document.edges[1].target = document.edges[0].target;
      },
    },
  ])('rejects $name in portable backups', ({ message, mutate }) => {
    const document = structuredClone(initialDocument);
    mutate(document);
    const envelope = JSON.stringify({
      format: 'synaptable-project',
      version: 2,
      document,
    });
    expect(() => parseProjectBackup(envelope)).toThrow(message);
  });

  it('repairs invalid local graph edges without losing valid layers', () => {
    const local = structuredClone(initialDocument);
    local.edges.push({ ...structuredClone(local.edges[0]), id: 'duplicate-pair' });
    local.edges.push({ ...structuredClone(local.edges[0]), id: 'orphan', target: 'missing-layer' });
    const repaired = validateEditorDocument(local);
    expect(repaired.nodes).toHaveLength(local.nodes.length);
    expect(repaired.edges).toHaveLength(initialDocument.edges.length);
  });

  it('rejects unsupported project envelopes', () => {
    expect(() => parseProjectBackup('{"format":"another-app","version":1}')).toThrow(
      'not a supported SynapTable',
    );
  });
});
