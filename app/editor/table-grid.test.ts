// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import {
  adjacentTableCell,
  clipboardGrid,
  cloneTableData,
  createTableData,
  insertTableColumn,
  insertTableRow,
  moveTableColumn,
  moveTableRow,
  pasteTableGrid,
  removeTableColumn,
  removeTableRow,
  resizeTableColumn,
  resizeTableRow,
  scaleTable,
  sequentialTableCell,
  tableCellAt,
  tableDimensions,
  tableFromNodes,
  updateTableCell,
} from './table-grid';

describe('table grid operations', () => {
  it('creates a semantic-ready 3 by 3 table with stable ids', () => {
    const table = createTableData();
    expect(table.columns).toHaveLength(3);
    expect(table.rows).toHaveLength(3);
    expect(table.rows.every((row) => row.cells.length === table.columns.length)).toBe(true);
    expect(table.rows[0].cells.map((cell) => cell.text)).toEqual(['Column 1', 'Column 2', 'Column 3']);
    expect(new Set(table.rows.flatMap((row) => row.cells.map((cell) => cell.id))).size).toBe(9);
  });

  it('updates one cell without replacing unrelated rows', () => {
    const table = createTableData();
    const address = { rowId: table.rows[1].id, columnId: table.columns[1].id };
    const next = updateTableCell(table, address, (cell) => ({ ...cell, text: 'Changed' }));
    expect(tableCellAt(next, address)?.cell.text).toBe('Changed');
    expect(next.rows[0]).toBe(table.rows[0]);
    expect(next.rows[2]).toBe(table.rows[2]);
  });

  it('inserts, removes, and moves rows without corrupting the matrix', () => {
    const table = createTableData({ rows: 2, columns: 2 });
    const inserted = insertTableRow(table, 1, ['Middle', 'Row']);
    expect(inserted.rows[1].cells.map((cell) => cell.text)).toEqual(['Middle', 'Row']);
    const moved = moveTableRow(inserted, 1, 1);
    expect(moved.rows[2].cells[0].text).toBe('Middle');
    const removed = removeTableRow(moved, 0);
    expect(removed.rows).toHaveLength(2);
    expect(removed.rows.every((row) => row.cells.length === 2)).toBe(true);
  });

  it('inserts, removes, and moves columns together with their cells', () => {
    const table = createTableData({ rows: 2, columns: 2, values: [['A', 'B'], ['C', 'D']] });
    const inserted = insertTableColumn(table, 1, ['X', 'Y']);
    expect(inserted.rows.map((row) => row.cells.map((cell) => cell.text))).toEqual([
      ['A', 'X', 'B'],
      ['C', 'Y', 'D'],
    ]);
    const moved = moveTableColumn(inserted, 1, 1);
    expect(moved.rows[0].cells.map((cell) => cell.text)).toEqual(['A', 'B', 'X']);
    const removed = removeTableColumn(moved, 1);
    expect(removed.rows.map((row) => row.cells.map((cell) => cell.text))).toEqual([
      ['A', 'X'],
      ['C', 'Y'],
    ]);
  });

  it('clamps row, column, and whole-table resizing', () => {
    const table = createTableData({ rows: 2, columns: 2 });
    const resized = resizeTableColumn(resizeTableRow(table, 0, 1), 0, 10_000);
    expect(resized.rows[0].height).toBe(36);
    expect(resized.columns[0].width).toBe(360);
    const scaled = scaleTable(resized, 160, 110);
    expect(scaled.columns.every((column) => column.width >= 80)).toBe(true);
    expect(scaled.rows.every((row) => row.height >= 36)).toBe(true);
    expect(tableDimensions(scaled).width).toBeGreaterThanOrEqual(160);
  });

  it('navigates by row and column ids rather than transient indexes', () => {
    const table = createTableData({ rows: 2, columns: 2 });
    const first = { rowId: table.rows[0].id, columnId: table.columns[0].id };
    expect(adjacentTableCell(table, first, 1, 1)).toEqual({
      rowId: table.rows[1].id,
      columnId: table.columns[1].id,
    });
    expect(sequentialTableCell(table, first, 1)).toEqual({
      rowId: table.rows[0].id,
      columnId: table.columns[1].id,
    });
    expect(sequentialTableCell(table, first, -1)).toBeNull();
  });

  it('parses spreadsheet HTML before TSV and keeps only text content', () => {
    const grid = clipboardGrid(
      '<table><tr><th>Name</th><th><strong>Status</strong></th></tr><tr><td>&lt;script&gt;</td><td>Ready</td></tr></table>',
      'fallback',
    );
    expect(grid).toEqual([
      ['Name', 'Status'],
      ['<script>', 'Ready'],
    ]);
    expect(clipboardGrid('', 'A\tB\r\nC\tD\r\n')).toEqual([
      ['A', 'B'],
      ['C', 'D'],
    ]);
  });

  it('pastes at the active cell and expands the table once', () => {
    const table = createTableData({ rows: 2, columns: 2 });
    const address = { rowId: table.rows[1].id, columnId: table.columns[1].id };
    const pasted = pasteTableGrid(table, address, [['A', 'B'], ['C', 'D']]);
    expect(pasted.rows).toHaveLength(3);
    expect(pasted.columns).toHaveLength(3);
    expect(pasted.rows.slice(1).map((row) => row.cells.slice(1).map((cell) => cell.text))).toEqual([
      ['A', 'B'],
      ['C', 'D'],
    ]);
  });

  it('regenerates all nested ids when duplicating a table', () => {
    const table = createTableData({ rows: 2, columns: 2 });
    const copy = cloneTableData(table);
    expect(copy.name).toBe('New table copy');
    expect(copy.columns.map((column) => column.id)).not.toEqual(table.columns.map((column) => column.id));
    expect(copy.rows.map((row) => row.id)).not.toEqual(table.rows.map((row) => row.id));
    expect(copy.rows.flatMap((row) => row.cells.map((cell) => cell.id)))
      .not.toEqual(table.rows.flatMap((row) => row.cells.map((cell) => cell.id)));
  });

  it('maps selected canvas layers into non-destructive plain-text rows', () => {
    const table = tableFromNodes(initialDocument.nodes.slice(0, 2));
    expect(table.rows[0].cells.map((cell) => cell.text)).toEqual(['Layer', 'Notes', 'Type']);
    expect(table.rows[1].cells[0].text).toBe('Research');
    expect(table.rows[1].cells[2].text).toBe('Concept');
    expect(table.rows).toHaveLength(3);
  });

  it('supports the 2,000-cell boundary and rejects growth without mutation', () => {
    const table = createTableData({ rows: 100, columns: 20, headerRow: false });
    expect(table.rows.flatMap((row) => row.cells)).toHaveLength(2_000);
    const last = { rowId: table.rows[99].id, columnId: table.columns[19].id };
    expect(() => pasteTableGrid(table, last, [['A'], ['B']])).toThrow('2,000-cell table limit');
    expect(tableCellAt(table, last)?.cell.text).toBe('');
    expect(() => createTableData({ rows: 100, columns: 21 })).toThrow('2,000 cells');
  });
});
