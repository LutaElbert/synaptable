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
  useEffect,
  useContext,
  useRef,
  type CSSProperties,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import {
  TABLE_CAPTION_HEIGHT,
  TABLE_MAX_CELL_TEXT,
  TABLE_MAX_COLUMN_WIDTH,
  TABLE_MAX_ROW_HEIGHT,
  TABLE_MIN_COLUMN_WIDTH,
  TABLE_MIN_ROW_HEIGHT,
  clipboardGrid,
  tableCellRequiredHeight,
  type ClipboardGrid,
  type TableCellAddress,
} from './table-grid';
import {
  tableInteractionContainsCell,
  tableInteractionFocus,
  type TableInteraction,
} from './table-interaction';
import type { EditorNode } from './types';

export type TableNavigationDirection =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'next'
  | 'previous'
  | 'row-start'
  | 'row-end'
  | 'table-start'
  | 'table-end';

export type TableNodeActionContextValue = {
  interaction: TableInteraction | null;
  selectedNodeCount: number;
  recordResizeStart: (id: string) => void;
  recordResize: (id: string, dimensions: ResizeParams) => void;
  recordResizeEnd: (id: string, dimensions?: ResizeParams) => void;
  cancelResize: () => void;
  resizeColumn: (id: string, columnIndex: number, width: number) => void;
  resizeRow: (id: string, rowIndex: number, height: number) => void;
  insertRow: (id: string, index: number) => void;
  insertColumn: (id: string, index: number) => void;
  selectTable: (id: string) => void;
  selectCell: (id: string, address: TableCellAddress, extend?: boolean) => void;
  selectRow: (id: string, rowId: string, extend?: boolean) => void;
  selectColumn: (id: string, columnId: string, extend?: boolean) => void;
  beginCellEdit: (id: string, address: TableCellAddress, replacement?: string) => void;
  updateCellText: (id: string, address: TableCellAddress, text: string) => void;
  commitCellEdit: () => void;
  cancelCellEdit: () => void;
  clearCells: (id: string) => void;
  copyCells: (id: string, clipboardData: DataTransfer, cut: boolean) => void;
  navigateCell: (
    id: string,
    address: TableCellAddress,
    direction: TableNavigationDirection,
    extend?: boolean,
  ) => void;
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

type BoundaryResize = {
  kind: 'row' | 'column';
  index: number;
  pointerId: number;
  startClient: number;
  startSize: number;
  scale: number;
};

export function TableNode({ id, data, selected }: NodeProps<EditorNode>) {
  const actions = useTableNodeActions();
  const boundaryResizeRef = useRef<BoundaryResize | null>(null);

  useEffect(() => {
    const cancelWithEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !boundaryResizeRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      boundaryResizeRef.current = null;
      actions.cancelResize();
    };
    window.addEventListener('keydown', cancelWithEscape, true);
    return () => window.removeEventListener('keydown', cancelWithEscape, true);
  }, [actions]);

  if (data.kind !== 'table') return null;
  const interaction = actions.interaction?.nodeId === id ? actions.interaction : null;
  const focus = tableInteractionFocus(data, interaction);
  const hasSingleCanvasSelection = Boolean(selected && actions.selectedNodeCount === 1);
  const showInnerControls = hasSingleCanvasSelection && !data.locked && interaction?.mode !== 'editing';
  const minimumWidth = data.columns.length * TABLE_MIN_COLUMN_WIDTH;
  const minimumHeight = TABLE_CAPTION_HEIGHT + data.rows.length * TABLE_MIN_ROW_HEIGHT;

  const columnCenters = data.columns.map((column, index) => (
    data.columns.slice(0, index).reduce((total, item) => total + item.width, 0) + column.width / 2
  ));
  const rowCenters = data.rows.map((row, index) => (
    TABLE_CAPTION_HEIGHT
    + data.rows.slice(0, index).reduce((total, item) => total + item.height, 0)
    + row.height / 2
  ));
  const columnEnds = data.columns.map((_, index) => (
    data.columns.slice(0, index + 1).reduce((total, item) => total + item.width, 0)
  ));
  const rowEnds = data.rows.map((_, index) => (
    TABLE_CAPTION_HEIGHT + data.rows.slice(0, index + 1).reduce((total, item) => total + item.height, 0)
  ));

  const startBoundaryResize = (
    event: PointerEvent<HTMLElement>,
    kind: BoundaryResize['kind'],
    index: number,
    startSize: number,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const table = event.currentTarget.closest<HTMLElement>('.table-node');
    const renderedWidth = table?.getBoundingClientRect().width ?? minimumWidth;
    const scale = Math.max(0.01, renderedWidth / data.columns.reduce((sum, column) => sum + column.width, 0));
    event.currentTarget.setPointerCapture(event.pointerId);
    boundaryResizeRef.current = {
      kind,
      index,
      pointerId: event.pointerId,
      startClient: kind === 'column' ? event.clientX : event.clientY,
      startSize,
      scale,
    };
    actions.recordResizeStart(id);
  };

  const moveBoundary = (event: PointerEvent<HTMLElement>) => {
    const resize = boundaryResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const client = resize.kind === 'column' ? event.clientX : event.clientY;
    const size = resize.startSize + (client - resize.startClient) / resize.scale;
    if (resize.kind === 'column') actions.resizeColumn(id, resize.index, size);
    else actions.resizeRow(id, resize.index, size);
  };

  const finishBoundaryResize = (event: PointerEvent<HTMLElement>) => {
    const resize = boundaryResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    boundaryResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    actions.recordResizeEnd(id);
  };

  const cancelBoundaryResize = (event: PointerEvent<HTMLElement>) => {
    const resize = boundaryResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    boundaryResizeRef.current = null;
    actions.cancelResize();
  };

  const resizeBoundaryWithKeyboard = (
    event: KeyboardEvent<HTMLElement>,
    kind: BoundaryResize['kind'],
    index: number,
    size: number,
  ) => {
    const decrease = kind === 'column' ? event.key === 'ArrowLeft' : event.key === 'ArrowUp';
    const increase = kind === 'column' ? event.key === 'ArrowRight' : event.key === 'ArrowDown';
    if (!decrease && !increase) return;
    event.preventDefault();
    event.stopPropagation();
    actions.recordResizeStart(id);
    if (kind === 'column') actions.resizeColumn(id, index, size + (increase ? 8 : -8));
    else actions.resizeRow(id, index, size + (increase ? 8 : -8));
    actions.recordResizeEnd(id);
  };

  const navigate = (
    event: KeyboardEvent<HTMLElement>,
    address: TableCellAddress,
    direction: TableNavigationDirection,
    extend = false,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    actions.navigateCell(id, address, direction, extend);
  };

  const handleCellKeyboard = (event: KeyboardEvent<HTMLElement>, address: TableCellAddress) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      actions.selectTable(id);
      return;
    }
    if (data.locked) return;
    if (event.key === 'ArrowUp') navigate(event, address, 'up', event.shiftKey);
    else if (event.key === 'ArrowDown') navigate(event, address, 'down', event.shiftKey);
    else if (event.key === 'ArrowLeft') navigate(event, address, 'left', event.shiftKey);
    else if (event.key === 'ArrowRight') navigate(event, address, 'right', event.shiftKey);
    else if (event.key === 'Home') navigate(event, address, event.metaKey || event.ctrlKey ? 'table-start' : 'row-start', event.shiftKey);
    else if (event.key === 'End') navigate(event, address, event.metaKey || event.ctrlKey ? 'table-end' : 'row-end', event.shiftKey);
    else if (event.key === 'Tab') navigate(event, address, event.shiftKey ? 'previous' : 'next');
    else if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      event.stopPropagation();
      actions.beginCellEdit(id, interaction?.mode === 'cell' ? interaction.anchor : address);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      actions.clearCells(id);
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      actions.beginCellEdit(id, address, event.key);
    }
  };

  const handleEditorKeyboard = (event: KeyboardEvent<HTMLTextAreaElement>, address: TableCellAddress) => {
    // Editing keys belong to the native textarea. Do not let the surrounding
    // cell interpret Enter, arrows, Home/End, or Delete as grid commands.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      actions.cancelCellEdit();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      actions.commitCellEdit();
      actions.navigateCell(id, address, event.shiftKey ? 'previous' : 'next');
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
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

  const handleCopy = (event: ClipboardEvent<HTMLElement>, cut: boolean) => {
    if (data.locked) return;
    event.preventDefault();
    event.stopPropagation();
    actions.copyCells(id, event.clipboardData, cut);
  };

  const cellContents = (
    rowIndex: number,
    columnIndex: number,
    address: TableCellAddress,
  ) => {
    const cell = data.rows[rowIndex].cells[columnIndex];
    const isEditing = interaction?.mode === 'editing'
      && interaction.cell.rowId === address.rowId
      && interaction.cell.columnId === address.columnId;
    if (isEditing && !data.locked) {
      return (
        <textarea
          className="table-cell-editor nodrag nowheel"
          aria-label={`Edit ${data.name}, row ${rowIndex + 1}, column ${columnIndex + 1}`}
          dir="auto"
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
    const isSelected = tableInteractionContainsCell(data, interaction, address);
    const isFocus = focus?.rowId === address.rowId && focus.columnId === address.columnId;
    const isAnchor = interaction?.mode === 'cell'
      && interaction.anchor.rowId === address.rowId
      && interaction.anchor.columnId === address.columnId;
    const isOverflowing = tableCellRequiredHeight(data, rowIndex, columnIndex) > data.rows[rowIndex].height;
    return {
      className: `table-cell nodrag cell-tone-${cell.tone} ${isSelected ? 'is-selected' : ''} ${isFocus ? 'is-active' : ''} ${isOverflowing ? 'has-overflow' : ''} ${data.locked ? 'is-locked' : ''}`,
      style: {
        textAlign: cell.horizontalAlign,
        '--table-cell-content-height': `${Math.max(0, data.rows[rowIndex].height - 14)}px`,
      } as CSSProperties,
      tabIndex: data.locked || !hasSingleCanvasSelection || !isFocus ? -1 : 0,
      'data-table-node-id': id,
      'data-table-row-id': address.rowId,
      'data-table-column-id': address.columnId,
      'data-table-selected': isSelected ? 'true' : undefined,
      'data-range-anchor': isAnchor ? 'true' : undefined,
      'data-range-focus': isFocus ? 'true' : undefined,
      'data-cell-overflow': isOverflowing ? 'true' : undefined,
      dir: 'auto' as const,
      'aria-label': `${data.name}, row ${rowIndex + 1}, column ${columnIndex + 1}${cell.text ? `: ${cell.text}` : ''}${isSelected ? ', selected' : ''}${isOverflowing ? ', content clipped' : ''}`,
      onClick: (event: MouseEvent<HTMLElement>) => {
        if (event.target instanceof Element && event.target.closest('textarea')) return;
        event.stopPropagation();
        if (!hasSingleCanvasSelection) actions.selectTable(id);
        else actions.selectCell(id, address, event.shiftKey);
      },
      onDoubleClick: (event: MouseEvent<HTMLElement>) => {
        if (event.target instanceof Element && event.target.closest('textarea')) return;
        event.stopPropagation();
        if (!data.locked) actions.beginCellEdit(id, address);
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => handleCellKeyboard(event, address),
      onPaste: (event: ClipboardEvent<HTMLElement>) => handlePaste(event, address, false),
      onCopy: (event: ClipboardEvent<HTMLElement>) => handleCopy(event, false),
      onCut: (event: ClipboardEvent<HTMLElement>) => handleCopy(event, true),
    };
  };

  const renderRow = (rowIndex: number) => {
    const row = data.rows[rowIndex];
    return (
      <tr key={row.id} style={{ height: row.height }} data-table-row-id={row.id}>
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
        isVisible={Boolean(hasSingleCanvasSelection && !data.locked && interaction?.mode !== 'editing')}
        minWidth={minimumWidth}
        minHeight={minimumHeight}
        onResizeStart={() => actions.recordResizeStart(id)}
        onResize={(_, dimensions) => actions.recordResize(id, dimensions)}
        onResizeEnd={(_, dimensions) => actions.recordResizeEnd(id, dimensions)}
      />
      <article
        className="table-node"
        style={{ opacity: data.opacity }}
        data-table-node-id={id}
        data-table-interaction={interaction?.mode ?? 'none'}
      >
        <table className="canvas-table nowheel">
          <caption
            onClick={(event) => {
              event.stopPropagation();
              actions.selectTable(id);
            }}
          >
            <strong>{data.name}</strong>
            <span>{data.rows.length} × {data.columns.length}</span>
          </caption>
          <colgroup>
            {data.columns.map((column) => <col key={column.id} style={{ width: column.width }} data-table-column-id={column.id} />)}
          </colgroup>
          {data.headerRow ? <thead>{renderRow(0)}</thead> : null}
          <tbody>{data.rows.slice(data.headerRow ? 1 : 0).map((_, index) => renderRow(index + (data.headerRow ? 1 : 0)))}</tbody>
        </table>
        {showInnerControls ? (
          <div className="table-direct-controls nodrag nowheel" role="group" aria-label="Table row, column, and size controls">
            {data.columns.map((column, columnIndex) => (
              <button
                key={column.id}
                type="button"
                className="table-grabber table-column-grabber"
                style={{ left: columnCenters[columnIndex] }}
                data-table-column-grabber={column.id}
                aria-label={`Select column ${columnIndex + 1}`}
                aria-pressed={interaction?.mode === 'column' && interaction.columnIds.includes(column.id)}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  actions.selectColumn(id, column.id, event.shiftKey);
                }}
                onCopy={(event) => handleCopy(event, false)}
                onCut={(event) => handleCopy(event, true)}
                onKeyDown={(event) => {
                  if (event.key === 'Delete' || event.key === 'Backspace') {
                    event.preventDefault();
                    event.stopPropagation();
                    actions.clearCells(id);
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    actions.selectTable(id);
                  }
                }}
              ><span aria-hidden="true" /></button>
            ))}
            {data.rows.map((row, rowIndex) => (
              <button
                key={row.id}
                type="button"
                className="table-grabber table-row-grabber"
                style={{ top: rowCenters[rowIndex] }}
                data-table-row-grabber={row.id}
                aria-label={`Select row ${rowIndex + 1}`}
                aria-pressed={interaction?.mode === 'row' && interaction.rowIds.includes(row.id)}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  actions.selectRow(id, row.id, event.shiftKey);
                }}
                onCopy={(event) => handleCopy(event, false)}
                onCut={(event) => handleCopy(event, true)}
                onKeyDown={(event) => {
                  if (event.key === 'Delete' || event.key === 'Backspace') {
                    event.preventDefault();
                    event.stopPropagation();
                    actions.clearCells(id);
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    actions.selectTable(id);
                  }
                }}
              ><span aria-hidden="true" /></button>
            ))}
            {data.columns.slice(0, -1).map((column, columnIndex) => (
              <div
                key={column.id}
                className="table-boundary table-column-boundary"
                style={{ left: columnEnds[columnIndex] }}
                role="separator"
                tabIndex={0}
                aria-label={`Resize column ${columnIndex + 1}`}
                aria-orientation="vertical"
                aria-valuemin={TABLE_MIN_COLUMN_WIDTH}
                aria-valuemax={TABLE_MAX_COLUMN_WIDTH}
                aria-valuenow={Math.round(column.width)}
                data-table-column-resizer={column.id}
                onPointerDown={(event) => startBoundaryResize(event, 'column', columnIndex, column.width)}
                onPointerMove={moveBoundary}
                onPointerUp={finishBoundaryResize}
                onPointerCancel={cancelBoundaryResize}
                onKeyDown={(event) => resizeBoundaryWithKeyboard(event, 'column', columnIndex, column.width)}
              ><span aria-hidden="true" /></div>
            ))}
            {data.rows.slice(0, -1).map((row, rowIndex) => (
              <div
                key={row.id}
                className="table-boundary table-row-boundary"
                style={{ top: rowEnds[rowIndex] }}
                role="separator"
                tabIndex={0}
                aria-label={`Resize row ${rowIndex + 1}`}
                aria-orientation="horizontal"
                aria-valuemin={TABLE_MIN_ROW_HEIGHT}
                aria-valuemax={TABLE_MAX_ROW_HEIGHT}
                aria-valuenow={Math.round(row.height)}
                data-table-row-resizer={row.id}
                onPointerDown={(event) => startBoundaryResize(event, 'row', rowIndex, row.height)}
                onPointerMove={moveBoundary}
                onPointerUp={finishBoundaryResize}
                onPointerCancel={cancelBoundaryResize}
                onKeyDown={(event) => resizeBoundaryWithKeyboard(event, 'row', rowIndex, row.height)}
              ><span aria-hidden="true" /></div>
            ))}
            <button
              type="button"
              className="table-edge-add table-add-row"
              aria-label="Add row below"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                actions.insertRow(id, data.rows.length);
              }}
            >+</button>
            <button
              type="button"
              className="table-edge-add table-add-column"
              aria-label="Add column right"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                actions.insertColumn(id, data.columns.length);
              }}
            >+</button>
          </div>
        ) : null}
      </article>
      <TableHandles />
    </>
  );
}
