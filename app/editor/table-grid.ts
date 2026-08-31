import { richTextToPlainText } from './rich-text';
import type {
  EditorNode,
  TableCell,
  TableCellTone,
  TableColumn,
  TableNodeData,
  TableRow,
} from './types';

export const TABLE_DEFAULT_COLUMNS = 3;
export const TABLE_DEFAULT_ROWS = 3;
export const TABLE_DEFAULT_COLUMN_WIDTH = 120;
export const TABLE_DEFAULT_ROW_HEIGHT = 44;
export const TABLE_MIN_COLUMN_WIDTH = 80;
export const TABLE_MAX_COLUMN_WIDTH = 360;
export const TABLE_MIN_ROW_HEIGHT = 36;
export const TABLE_MAX_ROW_HEIGHT = 180;
export const TABLE_CAPTION_HEIGHT = 38;
export const TABLE_MAX_ROWS = 100;
export const TABLE_MAX_COLUMNS = 30;
export const TABLE_MAX_CELLS = 2_000;
export const TABLE_MAX_CELL_TEXT = 2_000;
export const TABLE_CELL_TONES: readonly TableCellTone[] = [
  'none',
  'gray',
  'indigo',
  'mint',
  'amber',
  'rose',
];

export type TableCellAddress = {
  rowId: string;
  columnId: string;
};

export type ClipboardGrid = string[][];

function createId() {
  return crypto.randomUUID();
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function createCell(text = ''): TableCell {
  return {
    id: createId(),
    text: text.slice(0, TABLE_MAX_CELL_TEXT),
    tone: 'none',
    horizontalAlign: 'left',
  };
}

function createColumn(width = TABLE_DEFAULT_COLUMN_WIDTH): TableColumn {
  return {
    id: createId(),
    width: clamp(width, TABLE_MIN_COLUMN_WIDTH, TABLE_MAX_COLUMN_WIDTH),
  };
}

function createRow(columnCount: number, values: string[] = []): TableRow {
  return {
    id: createId(),
    height: TABLE_DEFAULT_ROW_HEIGHT,
    cells: Array.from({ length: columnCount }, (_, index) => createCell(values[index] ?? '')),
  };
}

export function createTableData({
  name = 'New table',
  rows = TABLE_DEFAULT_ROWS,
  columns = TABLE_DEFAULT_COLUMNS,
  values = [],
  headerRow = true,
  headerColumn = false,
}: {
  name?: string;
  rows?: number;
  columns?: number;
  values?: string[][];
  headerRow?: boolean;
  headerColumn?: boolean;
} = {}): TableNodeData {
  const rowCount = clamp(Math.trunc(rows), 1, TABLE_MAX_ROWS);
  const columnCount = clamp(Math.trunc(columns), 1, TABLE_MAX_COLUMNS);
  if (rowCount * columnCount > TABLE_MAX_CELLS) {
    throw new Error(`A table can contain at most ${TABLE_MAX_CELLS.toLocaleString()} cells.`);
  }
  const tableRows = Array.from({ length: rowCount }, (_, rowIndex) => (
    createRow(
      columnCount,
      values[rowIndex] ?? (headerRow && rowIndex === 0
        ? Array.from({ length: columnCount }, (__, columnIndex) => `Column ${columnIndex + 1}`)
        : []),
    )
  ));
  return {
    kind: 'table',
    name,
    opacity: 1,
    locked: false,
    columns: Array.from({ length: columnCount }, () => createColumn()),
    rows: tableRows,
    headerRow,
    headerColumn,
  };
}

export function tableDimensions(data: TableNodeData) {
  return {
    width: data.columns.reduce((total, column) => total + column.width, 0),
    height: TABLE_CAPTION_HEIGHT + data.rows.reduce((total, row) => total + row.height, 0),
  };
}

export function tableCellAt(
  data: TableNodeData,
  address: TableCellAddress | null,
): { rowIndex: number; columnIndex: number; row: TableRow; column: TableColumn; cell: TableCell } | null {
  if (!address) return null;
  const rowIndex = data.rows.findIndex((row) => row.id === address.rowId);
  const columnIndex = data.columns.findIndex((column) => column.id === address.columnId);
  if (rowIndex < 0 || columnIndex < 0) return null;
  const row = data.rows[rowIndex];
  const column = data.columns[columnIndex];
  const cell = row.cells[columnIndex];
  return cell ? { rowIndex, columnIndex, row, column, cell } : null;
}

export function firstTableCell(data: TableNodeData): TableCellAddress {
  return { rowId: data.rows[0].id, columnId: data.columns[0].id };
}

export function adjacentTableCell(
  data: TableNodeData,
  address: TableCellAddress,
  rowDelta: number,
  columnDelta: number,
): TableCellAddress {
  const current = tableCellAt(data, address);
  if (!current) return firstTableCell(data);
  const rowIndex = clamp(current.rowIndex + rowDelta, 0, data.rows.length - 1);
  const columnIndex = clamp(current.columnIndex + columnDelta, 0, data.columns.length - 1);
  return { rowId: data.rows[rowIndex].id, columnId: data.columns[columnIndex].id };
}

export function sequentialTableCell(
  data: TableNodeData,
  address: TableCellAddress,
  direction: -1 | 1,
): TableCellAddress | null {
  const current = tableCellAt(data, address);
  if (!current) return firstTableCell(data);
  const index = current.rowIndex * data.columns.length + current.columnIndex + direction;
  if (index < 0 || index >= data.rows.length * data.columns.length) return null;
  const rowIndex = Math.floor(index / data.columns.length);
  const columnIndex = index % data.columns.length;
  return { rowId: data.rows[rowIndex].id, columnId: data.columns[columnIndex].id };
}

export function updateTableCell(
  data: TableNodeData,
  address: TableCellAddress,
  updater: (cell: TableCell) => TableCell,
): TableNodeData {
  const current = tableCellAt(data, address);
  if (!current) return data;
  return {
    ...data,
    rows: data.rows.map((row, rowIndex) => rowIndex === current.rowIndex
      ? {
          ...row,
          cells: row.cells.map((cell, columnIndex) => columnIndex === current.columnIndex
            ? updater(cell)
            : cell),
        }
      : row),
  };
}

export function insertTableRow(data: TableNodeData, index: number, values: string[] = []): TableNodeData {
  if (data.rows.length >= TABLE_MAX_ROWS || (data.rows.length + 1) * data.columns.length > TABLE_MAX_CELLS) {
    throw new Error(`A table can contain at most ${TABLE_MAX_CELLS.toLocaleString()} cells.`);
  }
  const rows = [...data.rows];
  rows.splice(clamp(index, 0, rows.length), 0, createRow(data.columns.length, values));
  return { ...data, rows };
}

export function removeTableRow(data: TableNodeData, index: number): TableNodeData {
  if (data.rows.length <= 1) throw new Error('A table must keep at least one row.');
  return { ...data, rows: data.rows.filter((_, rowIndex) => rowIndex !== index) };
}

export function moveTableRow(data: TableNodeData, index: number, direction: -1 | 1): TableNodeData {
  const nextIndex = clamp(index + direction, 0, data.rows.length - 1);
  if (index < 0 || index === nextIndex) return data;
  const rows = [...data.rows];
  const [row] = rows.splice(index, 1);
  rows.splice(nextIndex, 0, row);
  return { ...data, rows };
}

export function insertTableColumn(data: TableNodeData, index: number, values: string[] = []): TableNodeData {
  if (data.columns.length >= TABLE_MAX_COLUMNS || data.rows.length * (data.columns.length + 1) > TABLE_MAX_CELLS) {
    throw new Error(`A table can contain at most ${TABLE_MAX_CELLS.toLocaleString()} cells.`);
  }
  const insertionIndex = clamp(index, 0, data.columns.length);
  const columns = [...data.columns];
  columns.splice(insertionIndex, 0, createColumn());
  return {
    ...data,
    columns,
    rows: data.rows.map((row, rowIndex) => {
      const cells = [...row.cells];
      cells.splice(insertionIndex, 0, createCell(values[rowIndex] ?? ''));
      return { ...row, cells };
    }),
  };
}

export function removeTableColumn(data: TableNodeData, index: number): TableNodeData {
  if (data.columns.length <= 1) throw new Error('A table must keep at least one column.');
  return {
    ...data,
    columns: data.columns.filter((_, columnIndex) => columnIndex !== index),
    rows: data.rows.map((row) => ({
      ...row,
      cells: row.cells.filter((_, columnIndex) => columnIndex !== index),
    })),
  };
}

export function moveTableColumn(data: TableNodeData, index: number, direction: -1 | 1): TableNodeData {
  const nextIndex = clamp(index + direction, 0, data.columns.length - 1);
  if (index < 0 || index === nextIndex) return data;
  const columns = [...data.columns];
  const [column] = columns.splice(index, 1);
  columns.splice(nextIndex, 0, column);
  return {
    ...data,
    columns,
    rows: data.rows.map((row) => {
      const cells = [...row.cells];
      const [cell] = cells.splice(index, 1);
      cells.splice(nextIndex, 0, cell);
      return { ...row, cells };
    }),
  };
}

export function resizeTableRow(data: TableNodeData, index: number, height: number): TableNodeData {
  return {
    ...data,
    rows: data.rows.map((row, rowIndex) => rowIndex === index
      ? { ...row, height: clamp(height, TABLE_MIN_ROW_HEIGHT, TABLE_MAX_ROW_HEIGHT) }
      : row),
  };
}

export function resizeTableColumn(data: TableNodeData, index: number, width: number): TableNodeData {
  return {
    ...data,
    columns: data.columns.map((column, columnIndex) => columnIndex === index
      ? { ...column, width: clamp(width, TABLE_MIN_COLUMN_WIDTH, TABLE_MAX_COLUMN_WIDTH) }
      : column),
  };
}

export function scaleTable(data: TableNodeData, targetWidth: number, targetHeight: number): TableNodeData {
  const current = tableDimensions(data);
  const widthScale = Math.max(0.01, targetWidth / current.width);
  const currentRowsHeight = Math.max(1, current.height - TABLE_CAPTION_HEIGHT);
  const targetRowsHeight = Math.max(TABLE_MIN_ROW_HEIGHT, targetHeight - TABLE_CAPTION_HEIGHT);
  const heightScale = targetRowsHeight / currentRowsHeight;
  return {
    ...data,
    columns: data.columns.map((column) => ({
      ...column,
      width: clamp(column.width * widthScale, TABLE_MIN_COLUMN_WIDTH, TABLE_MAX_COLUMN_WIDTH),
    })),
    rows: data.rows.map((row) => ({
      ...row,
      height: clamp(row.height * heightScale, TABLE_MIN_ROW_HEIGHT, TABLE_MAX_ROW_HEIGHT),
    })),
  };
}

export function cloneTableData(data: TableNodeData, name = `${data.name} copy`): TableNodeData {
  const columns = data.columns.map((column) => ({ ...column, id: createId() }));
  return {
    ...structuredClone(data),
    name,
    locked: false,
    columns,
    rows: data.rows.map((row) => ({
      ...structuredClone(row),
      id: createId(),
      cells: row.cells.map((cell) => ({ ...structuredClone(cell), id: createId() })),
    })),
  };
}

function trimTrailingBlankRow(grid: ClipboardGrid) {
  while (grid.length > 1 && grid.at(-1)?.every((cell) => cell === '')) grid.pop();
  return grid;
}

export function clipboardGridFromText(text: string): ClipboardGrid {
  const normalized = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  const rows = normalized.split('\n').map((row) => row.split('\t'));
  return trimTrailingBlankRow(rows.length ? rows : [['']]);
}

export function clipboardGridFromHtml(html: string): ClipboardGrid | null {
  if (!html || typeof DOMParser === 'undefined') return null;
  const document = new DOMParser().parseFromString(html, 'text/html');
  const table = document.querySelector('table');
  if (!table) return null;
  const rows = [...table.querySelectorAll('tr')].map((row) => (
    [...row.querySelectorAll(':scope > th, :scope > td')].map((cell) => cell.textContent ?? '')
  ));
  return rows.length ? trimTrailingBlankRow(rows) : null;
}

export function clipboardGrid(html: string, text: string): ClipboardGrid {
  return clipboardGridFromHtml(html) ?? clipboardGridFromText(text);
}

export function pasteTableGrid(
  data: TableNodeData,
  address: TableCellAddress,
  grid: ClipboardGrid,
): TableNodeData {
  const current = tableCellAt(data, address);
  if (!current) return data;
  const rowsToAdd = Math.max(0, current.rowIndex + grid.length - data.rows.length);
  const pastedColumnCount = Math.max(1, ...grid.map((row) => row.length));
  const columnsToAdd = Math.max(0, current.columnIndex + pastedColumnCount - data.columns.length);
  const nextRows = data.rows.length + rowsToAdd;
  const nextColumns = data.columns.length + columnsToAdd;
  if (
    nextRows > TABLE_MAX_ROWS
    || nextColumns > TABLE_MAX_COLUMNS
    || nextRows * nextColumns > TABLE_MAX_CELLS
  ) {
    throw new Error(`That paste would exceed the ${TABLE_MAX_CELLS.toLocaleString()}-cell table limit.`);
  }
  if (grid.some((row) => row.some((value) => value.length > TABLE_MAX_CELL_TEXT))) {
    throw new Error(`A table cell can contain at most ${TABLE_MAX_CELL_TEXT.toLocaleString()} characters.`);
  }

  let next = data;
  for (let index = 0; index < rowsToAdd; index += 1) next = insertTableRow(next, next.rows.length);
  for (let index = 0; index < columnsToAdd; index += 1) next = insertTableColumn(next, next.columns.length);

  const rows = next.rows.map((row, rowIndex) => {
    const pastedRowIndex = rowIndex - current.rowIndex;
    if (pastedRowIndex < 0 || pastedRowIndex >= grid.length) return row;
    const pastedRow = grid[pastedRowIndex];
    return {
      ...row,
      cells: row.cells.map((cell, columnIndex) => {
        const pastedColumnIndex = columnIndex - current.columnIndex;
        if (pastedColumnIndex < 0 || pastedColumnIndex >= pastedRow.length) return cell;
        return { ...cell, text: pastedRow[pastedColumnIndex] };
      }),
    };
  });
  return { ...next, rows };
}

export function tableSearchText(data: TableNodeData) {
  return [data.name, ...data.rows.flatMap((row) => row.cells.map((cell) => cell.text))].join(' ');
}

export function tableFromNodes(nodes: EditorNode[], name = 'Organized ideas'): TableNodeData {
  const values = [
    ['Layer', 'Notes', 'Type'],
    ...nodes.map((node) => {
      if (node.data.kind === 'concept') {
        return [node.data.label || node.data.name, richTextToPlainText(node.data.body), 'Concept'];
      }
      if (node.data.kind === 'table') {
        return [node.data.name, `${node.data.rows.length} × ${node.data.columns.length}`, 'Table'];
      }
      return [node.data.name, '', node.data.kind === 'raster' ? 'Image' : 'Vector'];
    }),
  ];
  return createTableData({
    name,
    rows: values.length,
    columns: 3,
    values,
    headerRow: true,
  });
}
