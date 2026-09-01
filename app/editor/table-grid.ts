import {
  emptyRichText,
  richTextFromPlainText,
  richTextIsEmpty,
  richTextToPlainText,
} from './rich-text';
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
    content: richTextFromPlainText(text.slice(0, TABLE_MAX_CELL_TEXT)),
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

function blankCellFrom(cell: TableCell, text = ''): TableCell {
  return {
    ...cell,
    id: createId(),
    content: richTextFromPlainText(text.slice(0, TABLE_MAX_CELL_TEXT)),
  };
}

export function tableCellPlainText(cell: TableCell): string {
  return richTextToPlainText(cell.content);
}

export function tableCellHasContent(cell: TableCell): boolean {
  return !richTextIsEmpty(cell.content);
}

export function replaceTableCellPlainText(cell: TableCell, text: string): TableCell {
  return {
    ...cell,
    content: text ? richTextFromPlainText(text.slice(0, TABLE_MAX_CELL_TEXT)) : emptyRichText(),
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

export function nextTableName(nodes: EditorNode[]): string {
  const used = new Set<number>();
  for (const node of nodes) {
    if (node.data.kind !== 'table') continue;
    const match = /^table\s+([1-9]\d*)$/i.exec(node.data.name.trim().replace(/\s+/g, ' '));
    if (match) used.add(Number(match[1]));
  }
  let index = 1;
  while (used.has(index)) index += 1;
  return `Table ${index}`;
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

export function updateTableCells(
  data: TableNodeData,
  addresses: TableCellAddress[],
  updater: (cell: TableCell) => TableCell,
): TableNodeData {
  if (!addresses.length) return data;
  const selected = new Set(addresses.map((address) => `${address.rowId}\u0000${address.columnId}`));
  let changed = false;
  const rows = data.rows.map((row) => {
    let rowChanged = false;
    const cells = row.cells.map((cell, columnIndex) => {
      const column = data.columns[columnIndex];
      if (!column || !selected.has(`${row.id}\u0000${column.id}`)) return cell;
      rowChanged = true;
      changed = true;
      return updater(cell);
    });
    return rowChanged ? { ...row, cells } : row;
  });
  return changed ? { ...data, rows } : data;
}

export function insertTableRow(data: TableNodeData, index: number, values: string[] = []): TableNodeData {
  if (data.rows.length >= TABLE_MAX_ROWS || (data.rows.length + 1) * data.columns.length > TABLE_MAX_CELLS) {
    throw new Error(`A table can contain at most ${TABLE_MAX_CELLS.toLocaleString()} cells.`);
  }
  const insertionIndex = clamp(index, 0, data.rows.length);
  const template = data.rows[insertionIndex > 0 ? insertionIndex - 1 : 0];
  const rows = [...data.rows];
  rows.splice(insertionIndex, 0, template
    ? {
        id: createId(),
        height: template.height,
        cells: template.cells.map((cell, cellIndex) => blankCellFrom(cell, values[cellIndex] ?? '')),
      }
    : createRow(data.columns.length, values));
  return { ...data, rows };
}

export function duplicateTableRow(data: TableNodeData, index: number): TableNodeData {
  if (data.rows.length >= TABLE_MAX_ROWS || (data.rows.length + 1) * data.columns.length > TABLE_MAX_CELLS) {
    throw new Error(`A table can contain at most ${TABLE_MAX_CELLS.toLocaleString()} cells.`);
  }
  const source = data.rows[index];
  if (!source) return data;
  const duplicate: TableRow = {
    ...source,
    id: createId(),
    cells: source.cells.map((cell) => ({ ...cell, id: createId() })),
  };
  const rows = [...data.rows];
  rows.splice(index + 1, 0, duplicate);
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
  const templateIndex = insertionIndex > 0 ? insertionIndex - 1 : 0;
  const columns = [...data.columns];
  columns.splice(insertionIndex, 0, createColumn(data.columns[templateIndex]?.width));
  return {
    ...data,
    columns,
    rows: data.rows.map((row, rowIndex) => {
      const cells = [...row.cells];
      const template = row.cells[templateIndex];
      cells.splice(insertionIndex, 0, template
        ? blankCellFrom(template, values[rowIndex] ?? '')
        : createCell(values[rowIndex] ?? ''));
      return { ...row, cells };
    }),
  };
}

export function duplicateTableColumn(data: TableNodeData, index: number): TableNodeData {
  if (data.columns.length >= TABLE_MAX_COLUMNS || data.rows.length * (data.columns.length + 1) > TABLE_MAX_CELLS) {
    throw new Error(`A table can contain at most ${TABLE_MAX_CELLS.toLocaleString()} cells.`);
  }
  const source = data.columns[index];
  if (!source) return data;
  const columns = [...data.columns];
  columns.splice(index + 1, 0, { ...source, id: createId() });
  return {
    ...data,
    columns,
    rows: data.rows.map((row) => {
      const cells = [...row.cells];
      cells.splice(index + 1, 0, { ...row.cells[index], id: createId() });
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

export function distributeTableRows(data: TableNodeData): TableNodeData {
  const total = data.rows.reduce((sum, row) => sum + row.height, 0);
  const height = clamp(total / data.rows.length, TABLE_MIN_ROW_HEIGHT, TABLE_MAX_ROW_HEIGHT);
  return { ...data, rows: data.rows.map((row) => ({ ...row, height })) };
}

export function distributeTableColumns(data: TableNodeData): TableNodeData {
  const total = data.columns.reduce((sum, column) => sum + column.width, 0);
  const width = clamp(total / data.columns.length, TABLE_MIN_COLUMN_WIDTH, TABLE_MAX_COLUMN_WIDTH);
  return { ...data, columns: data.columns.map((column) => ({ ...column, width })) };
}

export function fitTableColumnToContent(data: TableNodeData, index: number): TableNodeData {
  if (!data.columns[index]) return data;
  const longestLine = data.rows.reduce((maximum, row) => Math.max(
    maximum,
    ...(row.cells[index] ? tableCellPlainText(row.cells[index]).split('\n').map((line) => [...line].length) : [0]),
  ), 0);
  return resizeTableColumn(data, index, Math.ceil(longestLine * 6.2 + 24));
}

export function tableCellRequiredHeight(data: TableNodeData, rowIndex: number, columnIndex: number) {
  const cell = data.rows[rowIndex]?.cells[columnIndex];
  const column = data.columns[columnIndex];
  if (!cell || !column) return TABLE_MIN_ROW_HEIGHT;
  const charactersPerLine = Math.max(1, Math.floor((column.width - 18) / 6.2));
  const wrappedLines = tableCellPlainText(cell).split('\n').reduce(
    (total, line) => total + Math.max(1, Math.ceil([...line].length / charactersPerLine)),
    0,
  );
  return Math.ceil(wrappedLines * 14 + 16);
}

export function tableRowRequiredHeight(data: TableNodeData, index: number) {
  if (!data.rows[index]) return TABLE_MIN_ROW_HEIGHT;
  return Math.max(
    TABLE_MIN_ROW_HEIGHT,
    ...data.columns.map((_, columnIndex) => tableCellRequiredHeight(data, index, columnIndex)),
  );
}

export function fitTableRowToContent(data: TableNodeData, index: number): TableNodeData {
  const row = data.rows[index];
  if (!row) return data;
  return resizeTableRow(data, index, tableRowRequiredHeight(data, index));
}

export function growTableRowToContent(data: TableNodeData, index: number): TableNodeData {
  const row = data.rows[index];
  if (!row) return data;
  const requiredHeight = tableRowRequiredHeight(data, index);
  return requiredHeight > row.height ? resizeTableRow(data, index, requiredHeight) : data;
}

export function resetTableSizing(data: TableNodeData): TableNodeData {
  return {
    ...data,
    columns: data.columns.map((column) => ({ ...column, width: TABLE_DEFAULT_COLUMN_WIDTH })),
    rows: data.rows.map((row) => ({ ...row, height: TABLE_DEFAULT_ROW_HEIGHT })),
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

export function clipboardGridToText(grid: ClipboardGrid) {
  return grid.map((row) => row.join('\t')).join('\n');
}

function escapeClipboardHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('\n', '<br>');
}

export function clipboardGridToHtml(grid: ClipboardGrid) {
  return `<table><tbody>${grid.map((row) => `<tr>${row.map((cell) => `<td>${escapeClipboardHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
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
        return replaceTableCellPlainText(cell, pastedRow[pastedColumnIndex]);
      }),
    };
  });
  return { ...next, rows };
}

export function tableSearchText(data: TableNodeData) {
  return [data.name, ...data.rows.flatMap((row) => row.cells.map(tableCellPlainText))].join(' ');
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
