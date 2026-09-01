import { firstTableCell, tableCellAt, type TableCellAddress } from './table-grid';
import type { TableNodeData } from './types';

export type TableInteraction =
  | { mode: 'table'; nodeId: string }
  | { mode: 'cell'; nodeId: string; anchor: TableCellAddress; focus: TableCellAddress }
  | { mode: 'row'; nodeId: string; rowIds: string[] }
  | { mode: 'column'; nodeId: string; columnIds: string[] }
  | { mode: 'editing'; nodeId: string; cell: TableCellAddress };

export function tableInteractionFocus(
  data: TableNodeData,
  interaction: TableInteraction | null,
): TableCellAddress | null {
  if (!interaction) return null;
  if (interaction.mode === 'cell') return interaction.focus;
  if (interaction.mode === 'editing') return interaction.cell;
  if (interaction.mode === 'row') {
    const rowId = interaction.rowIds[0];
    return rowId ? { rowId, columnId: data.columns[0].id } : null;
  }
  if (interaction.mode === 'column') {
    const columnId = interaction.columnIds[0];
    return columnId ? { rowId: data.rows[0].id, columnId } : null;
  }
  return null;
}

export function tableCellRange(
  data: TableNodeData,
  anchor: TableCellAddress,
  focus: TableCellAddress,
): TableCellAddress[] {
  const anchorCell = tableCellAt(data, anchor);
  const focusCell = tableCellAt(data, focus);
  if (!anchorCell || !focusCell) return [];
  const firstRow = Math.min(anchorCell.rowIndex, focusCell.rowIndex);
  const lastRow = Math.max(anchorCell.rowIndex, focusCell.rowIndex);
  const firstColumn = Math.min(anchorCell.columnIndex, focusCell.columnIndex);
  const lastColumn = Math.max(anchorCell.columnIndex, focusCell.columnIndex);
  const addresses: TableCellAddress[] = [];
  for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex += 1) {
    for (let columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex += 1) {
      addresses.push({
        rowId: data.rows[rowIndex].id,
        columnId: data.columns[columnIndex].id,
      });
    }
  }
  return addresses;
}

function idRange(ids: string[], anchorId: string, focusId: string) {
  const anchorIndex = ids.indexOf(anchorId);
  const focusIndex = ids.indexOf(focusId);
  if (anchorIndex < 0 || focusIndex < 0) return [];
  const direction = anchorIndex <= focusIndex ? 1 : -1;
  const range: string[] = [];
  for (let index = anchorIndex; ; index += direction) {
    range.push(ids[index]);
    if (index === focusIndex) return range;
  }
}

export function tableRowRange(data: TableNodeData, anchorRowId: string, focusRowId: string) {
  return idRange(data.rows.map((row) => row.id), anchorRowId, focusRowId);
}

export function tableColumnRange(data: TableNodeData, anchorColumnId: string, focusColumnId: string) {
  return idRange(data.columns.map((column) => column.id), anchorColumnId, focusColumnId);
}

export function tableInteractionCells(
  data: TableNodeData,
  interaction: TableInteraction | null,
): TableCellAddress[] {
  if (!interaction || interaction.mode === 'table') return [];
  if (interaction.mode === 'editing') return [interaction.cell];
  if (interaction.mode === 'cell') return tableCellRange(data, interaction.anchor, interaction.focus);
  if (interaction.mode === 'row') {
    const selectedRows = new Set(interaction.rowIds);
    return data.rows.flatMap((row) => selectedRows.has(row.id)
      ? data.columns.map((column) => ({ rowId: row.id, columnId: column.id }))
      : []);
  }
  const selectedColumns = new Set(interaction.columnIds);
  return data.rows.flatMap((row) => data.columns.flatMap((column) => selectedColumns.has(column.id)
    ? [{ rowId: row.id, columnId: column.id }]
    : []));
}

export function tableInteractionGrid(
  data: TableNodeData,
  interaction: TableInteraction | null,
): string[][] {
  const addresses = tableInteractionCells(data, interaction);
  if (!addresses.length) return [];
  const cells = addresses
    .map((address) => tableCellAt(data, address))
    .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell));
  const firstRow = Math.min(...cells.map((cell) => cell.rowIndex));
  const lastRow = Math.max(...cells.map((cell) => cell.rowIndex));
  const firstColumn = Math.min(...cells.map((cell) => cell.columnIndex));
  const lastColumn = Math.max(...cells.map((cell) => cell.columnIndex));
  return data.rows.slice(firstRow, lastRow + 1).map((row) => (
    row.cells.slice(firstColumn, lastColumn + 1).map((cell) => cell.text)
  ));
}

export function tableInteractionTopLeft(
  data: TableNodeData,
  interaction: TableInteraction | null,
): TableCellAddress | null {
  const addresses = tableInteractionCells(data, interaction);
  const cells = addresses
    .map((address) => tableCellAt(data, address))
    .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell));
  if (!cells.length) return null;
  const rowIndex = Math.min(...cells.map((cell) => cell.rowIndex));
  const columnIndex = Math.min(...cells.map((cell) => cell.columnIndex));
  return { rowId: data.rows[rowIndex].id, columnId: data.columns[columnIndex].id };
}

export function tableInteractionContainsCell(
  data: TableNodeData,
  interaction: TableInteraction | null,
  address: TableCellAddress,
) {
  if (!interaction || interaction.mode === 'table') return false;
  if (interaction.mode === 'editing') {
    return interaction.cell.rowId === address.rowId && interaction.cell.columnId === address.columnId;
  }
  if (interaction.mode === 'row') return interaction.rowIds.includes(address.rowId);
  if (interaction.mode === 'column') return interaction.columnIds.includes(address.columnId);
  const target = tableCellAt(data, address);
  const anchor = tableCellAt(data, interaction.anchor);
  const focus = tableCellAt(data, interaction.focus);
  if (!target || !anchor || !focus) return false;
  return target.rowIndex >= Math.min(anchor.rowIndex, focus.rowIndex)
    && target.rowIndex <= Math.max(anchor.rowIndex, focus.rowIndex)
    && target.columnIndex >= Math.min(anchor.columnIndex, focus.columnIndex)
    && target.columnIndex <= Math.max(anchor.columnIndex, focus.columnIndex);
}

export function normalizeTableInteraction(
  data: TableNodeData,
  interaction: TableInteraction,
): TableInteraction {
  if (interaction.mode === 'table') return interaction;
  if (interaction.mode === 'editing') {
    return tableCellAt(data, interaction.cell)
      ? interaction
      : { mode: 'cell', nodeId: interaction.nodeId, anchor: firstTableCell(data), focus: firstTableCell(data) };
  }
  if (interaction.mode === 'cell') {
    if (tableCellAt(data, interaction.anchor) && tableCellAt(data, interaction.focus)) return interaction;
    const cell = firstTableCell(data);
    return { mode: 'cell', nodeId: interaction.nodeId, anchor: cell, focus: cell };
  }
  if (interaction.mode === 'row') {
    const rowIds = interaction.rowIds.filter((id) => data.rows.some((row) => row.id === id));
    if (rowIds.length) return rowIds.length === interaction.rowIds.length ? interaction : { ...interaction, rowIds };
  } else {
    const columnIds = interaction.columnIds.filter((id) => data.columns.some((column) => column.id === id));
    if (columnIds.length) return columnIds.length === interaction.columnIds.length ? interaction : { ...interaction, columnIds };
  }
  const cell = firstTableCell(data);
  return { mode: 'cell', nodeId: interaction.nodeId, anchor: cell, focus: cell };
}

export function nearestTableCellAfterStructureRemoval(
  before: TableNodeData,
  after: TableNodeData,
  focus: TableCellAddress | null,
): TableCellAddress {
  const previous = tableCellAt(before, focus) ?? tableCellAt(before, firstTableCell(before))!;
  const survivingRow = after.rows.find((row) => row.id === previous.row.id);
  const survivingColumn = after.columns.find((column) => column.id === previous.column.id);
  const removedRowsBefore = before.rows
    .slice(0, previous.rowIndex)
    .filter((row) => !after.rows.some((candidate) => candidate.id === row.id)).length;
  const removedColumnsBefore = before.columns
    .slice(0, previous.columnIndex)
    .filter((column) => !after.columns.some((candidate) => candidate.id === column.id)).length;
  const rowIndex = Math.max(0, Math.min(
    previous.rowIndex - removedRowsBefore,
    after.rows.length - 1,
  ));
  const columnIndex = Math.max(0, Math.min(
    previous.columnIndex - removedColumnsBefore,
    after.columns.length - 1,
  ));
  return {
    rowId: survivingRow?.id ?? after.rows[rowIndex].id,
    columnId: survivingColumn?.id ?? after.columns[columnIndex].id,
  };
}
