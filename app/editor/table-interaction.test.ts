import { describe, expect, it } from 'vitest';
import { createTableData, removeTableColumn, removeTableRow } from './table-grid';
import {
  nearestTableCellAfterStructureRemoval,
  normalizeTableInteraction,
  tableCellRange,
  tableColumnRange,
  tableInteractionCells,
  tableInteractionContainsCell,
  tableInteractionFocus,
  tableInteractionGrid,
  tableInteractionTopLeft,
  tableRowRange,
  type TableInteraction,
} from './table-interaction';

function fixture() {
  return createTableData({ rows: 3, columns: 3, headerRow: false });
}

describe('table interaction helpers', () => {
  it('returns rectangular cell ranges in row-major order', () => {
    const data = fixture();
    const anchor = { rowId: data.rows[2].id, columnId: data.columns[2].id };
    const focus = { rowId: data.rows[1].id, columnId: data.columns[0].id };
    expect(tableCellRange(data, anchor, focus)).toEqual([
      { rowId: data.rows[1].id, columnId: data.columns[0].id },
      { rowId: data.rows[1].id, columnId: data.columns[1].id },
      { rowId: data.rows[1].id, columnId: data.columns[2].id },
      { rowId: data.rows[2].id, columnId: data.columns[0].id },
      { rowId: data.rows[2].id, columnId: data.columns[1].id },
      { rowId: data.rows[2].id, columnId: data.columns[2].id },
    ]);
  });

  it('preserves the row and column anchor as the first range item', () => {
    const data = fixture();
    expect(tableRowRange(data, data.rows[1].id, data.rows[0].id)).toEqual([
      data.rows[1].id,
      data.rows[0].id,
    ]);
    expect(tableColumnRange(data, data.columns[2].id, data.columns[0].id)).toEqual([
      data.columns[2].id,
      data.columns[1].id,
      data.columns[0].id,
    ]);
  });

  it('expands cell, row, and column interactions into selected cells', () => {
    const data = fixture();
    const cell: TableInteraction = {
      mode: 'cell',
      nodeId: 'table',
      anchor: { rowId: data.rows[0].id, columnId: data.columns[0].id },
      focus: { rowId: data.rows[1].id, columnId: data.columns[1].id },
    };
    expect(tableInteractionCells(data, cell)).toHaveLength(4);
    expect(tableInteractionContainsCell(data, cell, cell.focus)).toBe(true);
    expect(tableInteractionFocus(data, cell)).toEqual(cell.focus);

    expect(tableInteractionCells(data, {
      mode: 'row',
      nodeId: 'table',
      rowIds: [data.rows[1].id],
    })).toHaveLength(3);
    expect(tableInteractionCells(data, {
      mode: 'column',
      nodeId: 'table',
      columnIds: [data.columns[2].id],
    })).toHaveLength(3);
  });

  it('extracts the selected rectangle and its top-left address', () => {
    const data = createTableData({
      rows: 3,
      columns: 3,
      headerRow: false,
      values: [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'I']],
    });
    const interaction: TableInteraction = {
      mode: 'cell',
      nodeId: 'table',
      anchor: { rowId: data.rows[2].id, columnId: data.columns[2].id },
      focus: { rowId: data.rows[1].id, columnId: data.columns[1].id },
    };
    expect(tableInteractionGrid(data, interaction)).toEqual([['E', 'F'], ['H', 'I']]);
    expect(tableInteractionTopLeft(data, interaction)).toEqual({
      rowId: data.rows[1].id,
      columnId: data.columns[1].id,
    });
  });

  it('falls back deterministically when selected structure disappears', () => {
    const data = fixture();
    const missing = { rowId: 'missing', columnId: 'missing' };
    expect(normalizeTableInteraction(data, {
      mode: 'cell',
      nodeId: 'table',
      anchor: missing,
      focus: missing,
    })).toEqual({
      mode: 'cell',
      nodeId: 'table',
      anchor: { rowId: data.rows[0].id, columnId: data.columns[0].id },
      focus: { rowId: data.rows[0].id, columnId: data.columns[0].id },
    });
  });

  it('finds the nearest surviving cell after active rows or columns are removed', () => {
    const before = createTableData({ rows: 4, columns: 4, headerRow: false });
    const focus = { rowId: before.rows[2].id, columnId: before.columns[2].id };
    const withoutMiddle = removeTableColumn(removeTableRow(before, 2), 2);
    expect(nearestTableCellAfterStructureRemoval(before, withoutMiddle, focus)).toEqual({
      rowId: before.rows[3].id,
      columnId: before.columns[3].id,
    });

    const last = { rowId: before.rows[3].id, columnId: before.columns[3].id };
    const withoutLast = removeTableColumn(removeTableRow(before, 3), 3);
    expect(nearestTableCellAfterStructureRemoval(before, withoutLast, last)).toEqual({
      rowId: before.rows[2].id,
      columnId: before.columns[2].id,
    });
  });
});
