// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import {
  adjacentTableCell,
  clipboardGrid,
  clipboardGridToHtml,
  clipboardGridToText,
  cloneTableData,
  createTableData,
  distributeTableColumns,
  distributeTableRows,
  duplicateTableColumn,
  duplicateTableRow,
  fitTableColumnToContent,
  fitTableRowToContent,
  growTableRowToContent,
  insertTableColumn,
  insertTableRow,
  moveTableColumn,
  moveTableRow,
  pasteTableGrid,
  removeTableColumn,
  removeTableRow,
  resizeTableColumn,
  resizeTableRow,
  resetTableSizing,
  scaleTable,
  sequentialTableCell,
  tableCellAt,
  tableCellPlainText,
  tableDimensions,
  tableFromNodes,
  tableCellRequiredHeight,
  tableRowRequiredHeight,
  updateTableCell,
  updateTableCells,
  replaceTableCellPlainText,
} from './table-grid';

const cellTexts = (cells: ReturnType<typeof createTableData>['rows'][number]['cells']) => (
  cells.map(tableCellPlainText)
);

describe('table grid operations', () => {
  it('creates a semantic-ready 3 by 3 table with stable ids', () => {
    const table = createTableData();
    expect(table.columns).toHaveLength(3);
    expect(table.rows).toHaveLength(3);
    expect(table.rows.every((row) => row.cells.length === table.columns.length)).toBe(true);
    expect(cellTexts(table.rows[0].cells)).toEqual(['Column 1', 'Column 2', 'Column 3']);
    expect(new Set(table.rows.flatMap((row) => row.cells.map((cell) => cell.id))).size).toBe(9);
  });

  it('updates one cell without replacing unrelated rows', () => {
    const table = createTableData();
    const address = { rowId: table.rows[1].id, columnId: table.columns[1].id };
    const next = updateTableCell(table, address, (cell) => replaceTableCellPlainText(cell, 'Changed'));
    expect(tableCellAt(next, address) && tableCellPlainText(tableCellAt(next, address)!.cell)).toBe('Changed');
    expect(next.rows[0]).toBe(table.rows[0]);
    expect(next.rows[2]).toBe(table.rows[2]);
  });

  it('updates only the addressed cell range', () => {
    const table = createTableData({ rows: 3, columns: 3, headerRow: false });
    const addresses = [
      { rowId: table.rows[0].id, columnId: table.columns[1].id },
      { rowId: table.rows[1].id, columnId: table.columns[1].id },
    ];
    const next = updateTableCells(table, addresses, (cell) => replaceTableCellPlainText(cell, 'Selected'));
    expect(cellTexts(next.rows[0].cells)).toEqual(['', 'Selected', '']);
    expect(cellTexts(next.rows[1].cells)).toEqual(['', 'Selected', '']);
    expect(next.rows[2]).toBe(table.rows[2]);
  });

  it('inserts, removes, and moves rows without corrupting the matrix', () => {
    const table = createTableData({ rows: 2, columns: 2 });
    const inserted = insertTableRow(table, 1, ['Middle', 'Row']);
    expect(cellTexts(inserted.rows[1].cells)).toEqual(['Middle', 'Row']);
    const moved = moveTableRow(inserted, 1, 1);
    expect(tableCellPlainText(moved.rows[2].cells[0])).toBe('Middle');
    const removed = removeTableRow(moved, 0);
    expect(removed.rows).toHaveLength(2);
    expect(removed.rows.every((row) => row.cells.length === 2)).toBe(true);
  });

  it('inserts, removes, and moves columns together with their cells', () => {
    const table = createTableData({ rows: 2, columns: 2, values: [['A', 'B'], ['C', 'D']] });
    const inserted = insertTableColumn(table, 1, ['X', 'Y']);
    expect(inserted.rows.map((row) => cellTexts(row.cells))).toEqual([
      ['A', 'X', 'B'],
      ['C', 'Y', 'D'],
    ]);
    const moved = moveTableColumn(inserted, 1, 1);
    expect(cellTexts(moved.rows[0].cells)).toEqual(['A', 'B', 'X']);
    const removed = removeTableColumn(moved, 1);
    expect(removed.rows.map((row) => cellTexts(row.cells))).toEqual([
      ['A', 'X'],
      ['C', 'Y'],
    ]);
  });

  it('inherits formatting on insert and regenerates ids on row and column duplication', () => {
    let table = createTableData({ rows: 2, columns: 2, headerRow: false });
    table = updateTableCell(table, {
      rowId: table.rows[0].id,
      columnId: table.columns[0].id,
    }, (cell) => ({ ...cell, tone: 'mint', horizontalAlign: 'center' }));
    table = resizeTableRow(resizeTableColumn(table, 0, 188), 0, 72);

    const insertedRow = insertTableRow(table, 1);
    expect(insertedRow.rows[1].height).toBe(72);
    expect(insertedRow.rows[1].cells[0]).toMatchObject({ tone: 'mint', horizontalAlign: 'center' });
    expect(tableCellPlainText(insertedRow.rows[1].cells[0])).toBe('');
    const insertedColumn = insertTableColumn(table, 1);
    expect(insertedColumn.columns[1].width).toBe(188);
    expect(insertedColumn.rows[0].cells[1]).toMatchObject({ tone: 'mint', horizontalAlign: 'center' });
    expect(tableCellPlainText(insertedColumn.rows[0].cells[1])).toBe('');

    const duplicatedRow = duplicateTableRow(table, 0);
    expect(duplicatedRow.rows[1].cells[0]).toMatchObject({ tone: 'mint', horizontalAlign: 'center' });
    expect(duplicatedRow.rows[1].id).not.toBe(table.rows[0].id);
    expect(duplicatedRow.rows[1].cells[0].id).not.toBe(table.rows[0].cells[0].id);
    const duplicatedColumn = duplicateTableColumn(table, 0);
    expect(duplicatedColumn.columns[1].id).not.toBe(table.columns[0].id);
    expect(duplicatedColumn.rows[0].cells[1].id).not.toBe(table.rows[0].cells[0].id);
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

  it('fits, distributes, and resets row and column sizing', () => {
    let table = createTableData({
      rows: 2,
      columns: 2,
      headerRow: false,
      values: [['A long value that needs more room', 'Short'], ['Line one\nLine two', 'Value']],
    });
    table = resizeTableColumn(resizeTableColumn(table, 0, 80), 1, 200);
    table = resizeTableRow(resizeTableRow(table, 0, 36), 1, 100);
    expect(fitTableColumnToContent(table, 0).columns[0].width).toBeGreaterThan(80);
    expect(fitTableRowToContent(table, 0).rows[0].height).toBeGreaterThanOrEqual(36);
    expect(distributeTableColumns(table).columns.map((column) => column.width)).toEqual([140, 140]);
    expect(distributeTableRows(table).rows.map((row) => row.height)).toEqual([68, 68]);
    const reset = resetTableSizing(table);
    expect(reset.columns.map((column) => column.width)).toEqual([120, 120]);
    expect(reset.rows.map((row) => row.height)).toEqual([44, 44]);
  });

  it('measures wrapped cell content and only grows rows that need more room', () => {
    let table = createTableData({
      rows: 1,
      columns: 2,
      headerRow: false,
      values: [['Line one\nLine two\nLine three', 'Short']],
    });
    const required = tableCellRequiredHeight(table, 0, 0);
    expect(required).toBeGreaterThan(table.rows[0].height);
    expect(tableRowRequiredHeight(table, 0)).toBe(required);
    table = growTableRowToContent(table, 0);
    expect(table.rows[0].height).toBe(required);
    expect(growTableRowToContent(table, 0)).toBe(table);

    table = updateTableCell(table, {
      rowId: table.rows[0].id,
      columnId: table.columns[0].id,
    }, (cell) => replaceTableCellPlainText(cell, Array.from({ length: 20 }, (_, index) => `Line ${index}`).join('\n')));
    expect(tableRowRequiredHeight(table, 0)).toBeGreaterThan(180);
    expect(growTableRowToContent(table, 0).rows[0].height).toBe(180);
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

  it('serializes selected matrices as TSV and escaped HTML', () => {
    const grid = [['A', '<script>alert("x")</script>'], ['Line one\nLine two', '']];
    expect(clipboardGridToText(grid)).toBe('A\t<script>alert("x")</script>\nLine one\nLine two\t');
    expect(clipboardGridToHtml(grid)).toBe(
      '<table><tbody><tr><td>A</td><td>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</td></tr><tr><td>Line one<br>Line two</td><td></td></tr></tbody></table>',
    );
  });

  it('pastes at the active cell and expands the table once', () => {
    const table = createTableData({ rows: 2, columns: 2 });
    const address = { rowId: table.rows[1].id, columnId: table.columns[1].id };
    const pasted = pasteTableGrid(table, address, [['A', 'B'], ['C', 'D']]);
    expect(pasted.rows).toHaveLength(3);
    expect(pasted.columns).toHaveLength(3);
    expect(pasted.rows.slice(1).map((row) => cellTexts(row.cells.slice(1)))).toEqual([
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
    expect(cellTexts(table.rows[0].cells)).toEqual(['Layer', 'Notes', 'Type']);
    expect(tableCellPlainText(table.rows[1].cells[0])).toBe('Research');
    expect(tableCellPlainText(table.rows[1].cells[2])).toBe('Concept');
    expect(table.rows).toHaveLength(3);
  });

  it('supports the 2,000-cell boundary and rejects growth without mutation', () => {
    const table = createTableData({ rows: 100, columns: 20, headerRow: false });
    expect(table.rows.flatMap((row) => row.cells)).toHaveLength(2_000);
    const last = { rowId: table.rows[99].id, columnId: table.columns[19].id };
    expect(() => pasteTableGrid(table, last, [['A'], ['B']])).toThrow('2,000-cell table limit');
    expect(tableCellAt(table, last) && tableCellPlainText(tableCellAt(table, last)!.cell)).toBe('');
    expect(() => createTableData({ rows: 100, columns: 21 })).toThrow('2,000 cells');
  });
});
