import { describe, expect, it } from 'vitest';
import { createTableData } from './table-grid';
import { estimateSnapshotBytes, trimHistory, type EditorSnapshot } from './history-budget';
import { initialDocument } from './initial-document';
import type { EditorNode } from './types';

function snapshotWithTable(values: string[][]): EditorSnapshot {
  const data = createTableData({ rows: values.length, columns: values[0]?.length ?? 1, values });
  const table: EditorNode = {
    id: crypto.randomUUID(),
    type: 'table',
    position: { x: 0, y: 0 },
    style: { width: 300, height: 200 },
    data,
  };
  return { nodes: [table], edges: [] };
}

describe('history budget', () => {
  it('counts complete table structure, rich content, and styling', () => {
    const empty = snapshotWithTable([['']]);
    const rich = snapshotWithTable([['A'.repeat(2_000)]]);
    rich.nodes[0].data = {
      ...rich.nodes[0].data,
      rows: rich.nodes[0].data.kind === 'table'
        ? rich.nodes[0].data.rows.map((row) => ({
            ...row,
            cells: row.cells.map((cell) => ({ ...cell, tone: 'indigo', horizontalAlign: 'right' })),
          }))
        : [],
    };
    expect(estimateSnapshotBytes(rich)).toBeGreaterThan(estimateSnapshotBytes(empty) + 3_500);
  });

  it('counts a maximum-size rich table against the byte budget', () => {
    const value = '界'.repeat(2_000);
    const snapshot = snapshotWithTable(Array.from({ length: 100 }, () => Array(20).fill(value)));
    expect(snapshot.nodes[0].data.kind).toBe('table');
    expect(estimateSnapshotBytes(snapshot)).toBeGreaterThan(8_000_000);
  });

  it('trims oldest entries by count while preserving newest order', () => {
    const history = Array.from({ length: 4 }, (_, index) => {
      const snapshot = structuredClone({ nodes: initialDocument.nodes, edges: initialDocument.edges });
      snapshot.nodes[0].id = `snapshot-${index}`;
      return snapshot;
    });
    trimHistory(history, 2, Number.POSITIVE_INFINITY);
    expect(history.map((snapshot) => snapshot.nodes[0].id)).toEqual(['snapshot-2', 'snapshot-3']);
  });

  it('trims oldest table-heavy entries by bytes and keeps the newest state', () => {
    const first = snapshotWithTable([['A'.repeat(2_000)]]);
    const second = snapshotWithTable([['B'.repeat(2_000)]]);
    const newest = snapshotWithTable([['C'.repeat(2_000)]]);
    const history = [first, second, newest];
    const twoEntryBudget = estimateSnapshotBytes(second) + estimateSnapshotBytes(newest);
    trimHistory(history, 40, twoEntryBudget);
    expect(history).toEqual([second, newest]);
  });

  it('retains one newest snapshot even when it exceeds the byte budget alone', () => {
    const newest = snapshotWithTable([['A'.repeat(2_000)]]);
    const history = [snapshotWithTable([['small']]), newest];
    trimHistory(history, 40, 1);
    expect(history).toEqual([newest]);
  });
});
