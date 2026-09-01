// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  connectLayersCommand,
  createCanvasNodesFromRowsCommand,
  createConceptCommand,
  createRelativeConceptCommand,
  createTableCommand,
  findLayers,
  getWorkspaceSummary,
  organizeLayersIntoTableCommand,
  type EditorCommandState,
} from './editor-commands';
import { initialDocument } from './initial-document';
import { createTableData, tableCellPlainText, tableDimensions } from './table-grid';
import type { EditorEdge, EditorNode } from './types';

function initialState(): EditorCommandState {
  return {
    nodes: structuredClone(initialDocument.nodes),
    edges: structuredClone(initialDocument.edges),
  };
}

function ids(...values: string[]) {
  let index = 0;
  return () => values[index++] ?? `generated-${index}`;
}

function tableNode(values: string[][]): EditorNode {
  const data = createTableData({
    name: 'Scenes',
    rows: values.length,
    columns: values[0].length,
    values,
    headerRow: true,
  });
  return {
    id: 'table',
    type: 'table',
    position: { x: 300, y: 100 },
    style: tableDimensions(data),
    draggable: true,
    deletable: true,
    selected: true,
    data,
  };
}

describe('editor command facade', () => {
  it('returns a concise workspace summary without document content', () => {
    const state = initialState();
    state.nodes[0].selected = true;
    state.nodes[1].hidden = true;
    state.nodes[2].data.locked = true;
    const summary = getWorkspaceSummary(state, { projectId: 'project-1', projectName: 'Film plan' });

    expect(summary).toEqual({
      projectId: 'project-1',
      projectName: 'Film plan',
      layerCount: 3,
      connectorCount: 2,
      layerCounts: { concept: 3, raster: 0, vector: 0, table: 0 },
      selectedIds: ['research'],
      hiddenCount: 1,
      lockedCount: 1,
    });
    expect(JSON.stringify(summary)).not.toContain('Starting point');
  });

  it('finds visible layers with kind and result limits but no full content', () => {
    const state = initialState();
    state.nodes[1].hidden = true;
    const result = findLayers(state, { query: 'e', kinds: ['concept'], limit: 1 });

    expect(result).toEqual({
      matches: [{ id: 'research', name: 'Research', kind: 'concept' }],
      totalMatches: 2,
      truncated: true,
    });
  });

  it('creates a concept immutably with a deterministic result envelope', () => {
    const state = initialState();
    state.edges[0].selected = true;
    const outcome = createConceptCommand({
      center: { x: 500, y: 300 },
      title: 'Scene objective',
      body: 'Raise the stakes',
      createId: ids('concept-new'),
    })(state);

    expect(outcome.result).toEqual({
      ok: true,
      summary: 'Scene objective added.',
      affectedIds: ['concept-new'],
      undoAvailable: true,
    });
    expect(outcome.nodes).not.toBe(state.nodes);
    expect(outcome.nodes.slice(0, -1).every((node) => !node.selected)).toBe(true);
    expect(outcome.edges.every((edge) => !edge.selected)).toBe(true);
    expect(outcome.nodes.at(-1)).toMatchObject({
      id: 'concept-new',
      position: { x: 406, y: 261 },
      selected: true,
      data: { kind: 'concept', name: 'Scene objective', label: 'Scene objective' },
    });
    expect(state.nodes).toHaveLength(initialDocument.nodes.length);
  });

  it('rejects invalid concept and table inputs without changing references', () => {
    const state = initialState();
    const invalidConcept = createConceptCommand({ center: { x: Number.NaN, y: 0 } })(state);
    const invalidTable = createTableCommand({ center: { x: 0, y: 0 }, rows: 0, columns: 3 })(state);

    expect(invalidConcept.result).toMatchObject({ ok: false, undoAvailable: false, affectedIds: [] });
    expect(invalidTable.result).toMatchObject({ ok: false, undoAvailable: false, affectedIds: [] });
    expect(invalidConcept.nodes).toBe(state.nodes);
    expect(invalidConcept.edges).toBe(state.edges);
    expect(invalidTable.nodes).toBe(state.nodes);
    expect(invalidTable.edges).toBe(state.edges);
  });

  it('creates a bounded table without silently changing requested dimensions', () => {
    const state = initialState();
    const outcome = createTableCommand({
      center: { x: 400, y: 260 },
      rows: 2,
      columns: 2,
      values: [['Beat', 'Owner'], ['Opening', 'Mara']],
      headerRow: true,
      createId: ids('table-new'),
    })(state);
    const table = outcome.nodes.find((node) => node.id === 'table-new');

    expect(outcome.result.ok).toBe(true);
    expect(table?.data.kind).toBe('table');
    if (!table || table.data.kind !== 'table') throw new Error('Expected table.');
    expect(table.data.rows).toHaveLength(2);
    expect(table.data.columns).toHaveLength(2);
    expect(table.data.rows.map((row) => row.cells.map(tableCellPlainText))).toEqual([
      ['Beat', 'Owner'],
      ['Opening', 'Mara'],
    ]);
  });

  it('organizes explicit unlocked layers in visual reading order and keeps originals', () => {
    const state = initialState();
    const outcome = organizeLayersIntoTableCommand({
      layerIds: ['layers', 'research'],
      createId: ids('organized'),
    })(state);
    const table = outcome.nodes.find((node) => node.id === 'organized');

    expect(outcome.result).toMatchObject({ ok: true, affectedIds: ['organized'], undoAvailable: true });
    expect(outcome.nodes.filter((node) => ['layers', 'research'].includes(node.id))).toHaveLength(2);
    if (!table || table.data.kind !== 'table') throw new Error('Expected table.');
    expect(table.data.rows.slice(1).map((row) => tableCellPlainText(row.cells[0]))).toEqual([
      'Research',
      'Editable layers',
    ]);
  });

  it('rejects organizing hidden, locked, duplicate, or unknown layer IDs atomically', () => {
    const state = initialState();
    state.nodes[0].data.locked = true;
    const locked = organizeLayersIntoTableCommand({ layerIds: ['research'] })(state);
    const duplicate = organizeLayersIntoTableCommand({ layerIds: ['layers', 'layers'] })(state);
    const unknown = organizeLayersIntoTableCommand({ layerIds: ['missing'] })(state);

    expect(locked.result.ok).toBe(false);
    expect(duplicate.result.ok).toBe(false);
    expect(unknown.result.ok).toBe(false);
    expect(locked.nodes).toBe(state.nodes);
    expect(duplicate.edges).toBe(state.edges);
  });

  it('creates nodes from explicit row and column IDs while preserving the source table', () => {
    const source = tableNode([
      ['Scene', 'Status', 'Owner'],
      ['Opening', 'Ready', 'Mara'],
      ['Climax', 'Draft', 'Ivo'],
    ]);
    if (source.data.kind !== 'table') throw new Error('Expected table.');
    const state = { nodes: [source], edges: [] };
    const sourceBefore = structuredClone(source);
    const outcome = createCanvasNodesFromRowsCommand({
      tableId: source.id,
      rowIds: [source.data.rows[2].id],
      columnIds: [source.data.columns[0].id, source.data.columns[1].id],
      createId: ids('climax-node'),
    })(state);

    expect(outcome.result).toEqual({
      ok: true,
      summary: '1 canvas node created from Scenes.',
      affectedIds: ['climax-node'],
      undoAvailable: true,
    });
    expect(outcome.nodes[0]).toEqual({ ...sourceBefore, selected: false });
    expect(outcome.nodes[0].data).toEqual(sourceBefore.data);
    expect(outcome.nodes[1]).toMatchObject({ id: 'climax-node', data: { kind: 'concept', name: 'Climax' } });
  });

  it('rejects stale table row IDs without partial output', () => {
    const source = tableNode([['Scene'], ['Opening']]);
    const state = { nodes: [source], edges: [] };
    const outcome = createCanvasNodesFromRowsCommand({ tableId: source.id, rowIds: ['removed-row'] })(state);

    expect(outcome.result).toMatchObject({ ok: false, affectedIds: [], undoAvailable: false });
    expect(outcome.nodes).toBe(state.nodes);
    expect(outcome.edges).toBe(state.edges);
  });

  it('discards partially generated rows when unique IDs cannot be allocated', () => {
    const source = tableNode([['Scene'], ['Opening'], ['Climax']]);
    if (source.data.kind !== 'table') throw new Error('Expected table.');
    const state = { nodes: [source], edges: [] };
    let calls = 0;
    const outcome = createCanvasNodesFromRowsCommand({
      tableId: source.id,
      rowIds: source.data.rows.slice(1).map((row) => row.id),
      createId: () => calls++ === 0 ? 'first-new-node' : source.id,
    })(state);

    expect(outcome.result).toMatchObject({
      ok: false,
      summary: 'A unique layer ID could not be created.',
      affectedIds: [],
      undoAvailable: false,
    });
    expect(outcome.nodes).toBe(state.nodes);
    expect(outcome.edges).toBe(state.edges);
  });

  it('creates validated connections and preserves explicit handles', () => {
    const state = initialState();
    const outcome = connectLayersCommand({
      connection: { source: 'explore', target: 'layers', sourceHandle: 'bottom', targetHandle: 'top' },
      createId: ids('edge-new'),
    })(state);

    expect(outcome.result).toEqual({
      ok: true,
      summary: 'Layers connected.',
      affectedIds: ['edge-new'],
      undoAvailable: true,
    });
    expect(outcome.edges.at(-1)).toMatchObject({
      id: 'edge-new',
      source: 'explore',
      target: 'layers',
      sourceHandle: 'bottom',
      targetHandle: 'top',
    });
    const duplicate = connectLayersCommand({
      connection: { source: 'explore', target: 'layers' },
    })(outcome);
    expect(duplicate.result).toMatchObject({ ok: false, summary: 'Those layers are already connected in that direction.' });
  });

  it('inherits the parent connector direction when creating a child', () => {
    const state = initialState();
    const verticalEdge: EditorEdge = {
      id: 'vertical',
      source: 'research',
      target: 'explore',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: { label: '', kind: 'default' },
    };
    state.edges = [verticalEdge];
    const outcome = createRelativeConceptCommand({
      sourceId: 'explore',
      relation: 'child',
      createId: ids('child', 'child-edge'),
    })(state);

    expect(outcome.result).toMatchObject({
      ok: true,
      affectedIds: ['child', 'child-edge'],
      undoAvailable: true,
    });
    expect(outcome.edges.at(-1)).toMatchObject({
      source: 'explore',
      target: 'child',
      sourceHandle: 'bottom',
      targetHandle: 'top',
    });
  });
});
