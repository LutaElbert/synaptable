'use client';

import {
  Handle,
  NodeResizer,
  Position,
  type NodeProps,
  type ResizeParams,
} from '@xyflow/react';
import {
  createContext,
  useContext,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {
  TABLE_CAPTION_HEIGHT,
  TABLE_MAX_CELL_TEXT,
  TABLE_MIN_COLUMN_WIDTH,
  TABLE_MIN_ROW_HEIGHT,
  clipboardGrid,
  type ClipboardGrid,
  type TableCellAddress,
} from './table-grid';
import type { EditorNode } from './types';

export type ActiveTableCell = TableCellAddress & {
  nodeId: string;
  mode: 'selected' | 'editing';
};

export type TableNavigationDirection = 'up' | 'down' | 'left' | 'right' | 'next' | 'previous';

export type TableNodeActionContextValue = {
  activeCell: ActiveTableCell | null;
  selectedNodeCount: number;
  recordResizeStart: (id: string) => void;
  recordResize: (id: string, dimensions: ResizeParams) => void;
  recordResizeEnd: (id: string, dimensions: ResizeParams) => void;
  selectCell: (id: string, address: TableCellAddress) => void;
  beginCellEdit: (id: string, address: TableCellAddress) => void;
  updateCellText: (id: string, address: TableCellAddress, text: string) => void;
  commitCellEdit: () => void;
  cancelCellEdit: () => void;
  navigateCell: (id: string, address: TableCellAddress, direction: TableNavigationDirection) => void;
  pasteGrid: (id: string, address: TableCellAddress, grid: ClipboardGrid) => void;
};

export const TableNodeActionContext = createContext<TableNodeActionContextValue | null>(null);

function useTableNodeActions() {
  const value = useContext(TableNodeActionContext);
  if (!value) throw new Error('Table node actions are unavailable.');
  return value;
}

function TableHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
    </>
  );
}

export function TableNode({ id, data, selected }: NodeProps<EditorNode>) {
  const actions = useTableNodeActions();
  if (data.kind !== 'table') return null;
  const active = actions.activeCell?.nodeId === id ? actions.activeCell : null;
  const minimumWidth = data.columns.length * TABLE_MIN_COLUMN_WIDTH;
  const minimumHeight = TABLE_CAPTION_HEIGHT + data.rows.length * TABLE_MIN_ROW_HEIGHT;

  const navigate = (
    event: KeyboardEvent<HTMLElement>,
    address: TableCellAddress,
    direction: TableNavigationDirection,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    actions.navigateCell(id, address, direction);
  };

  const handleCellKeyboard = (event: KeyboardEvent<HTMLElement>, address: TableCellAddress) => {
    if (data.locked) return;
    if (event.key === 'ArrowUp') navigate(event, address, 'up');
    else if (event.key === 'ArrowDown') navigate(event, address, 'down');
    else if (event.key === 'ArrowLeft') navigate(event, address, 'left');
    else if (event.key === 'ArrowRight') navigate(event, address, 'right');
    else if (event.key === 'Tab') navigate(event, address, event.shiftKey ? 'previous' : 'next');
    else if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      event.stopPropagation();
      actions.beginCellEdit(id, address);
    }
  };

  const handleEditorKeyboard = (event: KeyboardEvent<HTMLTextAreaElement>, address: TableCellAddress) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      actions.cancelCellEdit();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      actions.commitCellEdit();
      actions.navigateCell(id, address, event.shiftKey ? 'previous' : 'next');
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      actions.commitCellEdit();
    }
  };

  const handlePaste = (
    event: ClipboardEvent<HTMLElement>,
    address: TableCellAddress,
    editing: boolean,
  ) => {
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    const grid = clipboardGrid(html, text);
    const multiCell = grid.length > 1 || grid.some((row) => row.length > 1);
    if (editing && !multiCell) return;
    event.preventDefault();
    event.stopPropagation();
    actions.pasteGrid(id, address, grid);
  };

  const cellContents = (
    rowIndex: number,
    columnIndex: number,
    address: TableCellAddress,
  ) => {
    const cell = data.rows[rowIndex].cells[columnIndex];
    const isActive = active?.rowId === address.rowId && active.columnId === address.columnId;
    if (isActive && active.mode === 'editing' && !data.locked) {
      return (
        <textarea
          className="table-cell-editor nodrag nowheel"
          aria-label={`Edit ${data.name}, row ${rowIndex + 1}, column ${columnIndex + 1}`}
          value={cell.text}
          maxLength={TABLE_MAX_CELL_TEXT}
          autoFocus
          onChange={(event) => actions.updateCellText(id, address, event.target.value)}
          onKeyDown={(event) => handleEditorKeyboard(event, address)}
          onPaste={(event) => handlePaste(event, address, true)}
          onBlur={actions.commitCellEdit}
        />
      );
    }
    return <span>{cell.text || '\u00a0'}</span>;
  };

  const cellProps = (
    rowIndex: number,
    columnIndex: number,
    address: TableCellAddress,
  ) => {
    const cell = data.rows[rowIndex].cells[columnIndex];
    const isActive = active?.rowId === address.rowId && active.columnId === address.columnId;
    return {
      className: `table-cell cell-tone-${cell.tone} ${isActive ? 'is-active' : ''} ${data.locked ? 'is-locked' : ''}`,
      style: { textAlign: cell.horizontalAlign } as const,
      tabIndex: data.locked ? -1 : isActive || (!active && rowIndex === 0 && columnIndex === 0) ? 0 : -1,
      'data-table-node-id': id,
      'data-table-row-id': address.rowId,
      'data-table-column-id': address.columnId,
      'aria-label': `${data.name}, row ${rowIndex + 1}, column ${columnIndex + 1}${cell.text ? `: ${cell.text}` : ''}`,
      onFocus: (event: FocusEvent<HTMLElement>) => {
        if (event.target === event.currentTarget) actions.selectCell(id, address);
      },
      onClick: (event: MouseEvent<HTMLElement>) => {
        if (event.target instanceof Element && event.target.closest('textarea')) return;
        event.stopPropagation();
        actions.selectCell(id, address);
      },
      onDoubleClick: (event: MouseEvent<HTMLElement>) => {
        if (event.target instanceof Element && event.target.closest('textarea')) return;
        event.stopPropagation();
        if (!data.locked) actions.beginCellEdit(id, address);
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => handleCellKeyboard(event, address),
      onPaste: (event: ClipboardEvent<HTMLElement>) => handlePaste(event, address, false),
    };
  };

  const renderRow = (rowIndex: number) => {
    const row = data.rows[rowIndex];
    return (
      <tr key={row.id} style={{ height: row.height }}>
        {row.cells.map((_, columnIndex) => {
          const address = { rowId: row.id, columnId: data.columns[columnIndex].id };
          const isHeader = (data.headerRow && rowIndex === 0) || (data.headerColumn && columnIndex === 0);
          const contents = cellContents(rowIndex, columnIndex, address);
          const props = cellProps(rowIndex, columnIndex, address);
          return isHeader ? (
            <th
              key={row.cells[columnIndex].id}
              scope={data.headerRow && rowIndex === 0 ? 'col' : 'row'}
              {...props}
            >{contents}</th>
          ) : (
            <td key={row.cells[columnIndex].id} {...props}>{contents}</td>
          );
        })}
      </tr>
    );
  };

  return (
    <>
      <NodeResizer
        isVisible={Boolean(selected && actions.selectedNodeCount === 1 && !data.locked && active?.mode !== 'editing')}
        minWidth={minimumWidth}
        minHeight={minimumHeight}
        onResizeStart={() => actions.recordResizeStart(id)}
        onResize={(_, dimensions) => actions.recordResize(id, dimensions)}
        onResizeEnd={(_, dimensions) => actions.recordResizeEnd(id, dimensions)}
      />
      <article className="table-node" style={{ opacity: data.opacity }}>
        <table className="canvas-table nodrag nowheel">
          <caption>
            <strong>{data.name}</strong>
            <span>{data.rows.length} × {data.columns.length}</span>
          </caption>
          <colgroup>
            {data.columns.map((column) => <col key={column.id} style={{ width: column.width }} />)}
          </colgroup>
          {data.headerRow ? <thead>{renderRow(0)}</thead> : null}
          <tbody>{data.rows.slice(data.headerRow ? 1 : 0).map((_, index) => renderRow(index + (data.headerRow ? 1 : 0)))}</tbody>
        </table>
      </article>
      <TableHandles />
    </>
  );
}
