import { CONCEPT_DEFAULT_WIDTH, CONCEPT_MIN_HEIGHT, editorNodeDimensions } from './node-layout';
import { conceptTitleFromPlainText, emptyRichText, richTextFromPlainText, richTextIsEmpty, richTextToPlainText, sanitizeLinkHref } from './rich-text';
import { tableCellAt, tableDimensions, type TableCellAddress } from './table-grid';
import { tableInteractionCells, type TableInteraction } from './table-interaction';
import type { EditorNode, RichTextDocument, RichTextMark, RichTextNode, TableNodeData } from './types';

const CONVERSION_GAP = 28;
const CONVERSION_COLUMN_GAP = 80;
const MAX_CONCEPT_TEXT = 20_000;
const MAX_CONCEPT_NODES = 1_900;

type TableSelection = {
  rowIndexes: number[];
  columnIndexes: number[];
};

function indexesForAddresses(data: TableNodeData, addresses: TableCellAddress[]): TableSelection {
  const cells = addresses
    .map((address) => tableCellAt(data, address))
    .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell));
  return {
    rowIndexes: [...new Set(cells.map((cell) => cell.rowIndex))].sort((left, right) => left - right),
    columnIndexes: [...new Set(cells.map((cell) => cell.columnIndex))].sort((left, right) => left - right),
  };
}

export function tableSelectionForCanvas(
  data: TableNodeData,
  interaction: TableInteraction | null,
): TableSelection {
  if (!interaction || interaction.nodeId === '' || interaction.mode === 'table') {
    return {
      rowIndexes: data.rows.map((_, index) => index).filter((index) => !data.headerRow || index !== 0),
      columnIndexes: data.columns.map((_, index) => index),
    };
  }
  return indexesForAddresses(data, tableInteractionCells(data, interaction));
}

function safeRichTextNode(node: RichTextNode): RichTextNode {
  const marks = node.marks
    ?.map((mark): RichTextMark | null => {
      if (mark.type !== 'link') return structuredClone(mark);
      const href = sanitizeLinkHref(mark.attrs?.href ?? '');
      return href ? { type: 'link', attrs: { href } } : null;
    })
    .filter((mark): mark is RichTextMark => Boolean(mark));
  return {
    ...structuredClone(node),
    marks: marks?.length ? marks : undefined,
    content: node.content?.map(safeRichTextNode),
  };
}

function safeRichText(document: RichTextDocument): RichTextDocument {
  return safeRichTextNode(document) as RichTextDocument;
}

function richTextNodeCount(node: RichTextNode): number {
  return 1 + (node.content ?? []).reduce((total, child) => total + richTextNodeCount(child), 0);
}

function titleDocument(document: RichTextDocument, fallback: string): RichTextDocument {
  const plain = richTextToPlainText(document).trim();
  if (!plain) return conceptTitleFromPlainText(fallback);
  if (plain.length > 500) return conceptTitleFromPlainText(plain.slice(0, 500));
  return safeRichText(document);
}

function bodyDocument(
  data: TableNodeData,
  rowIndex: number,
  columnIndexes: number[],
  titleColumnIndex: number,
): RichTextDocument {
  const content: RichTextNode[] = [];
  let characters = 0;
  let nodes = 0;
  for (const columnIndex of columnIndexes) {
    if (columnIndex === titleColumnIndex) continue;
    const cell = data.rows[rowIndex]?.cells[columnIndex];
    if (!cell || richTextIsEmpty(cell.content)) continue;
    const headerCell = data.headerRow ? data.rows[0]?.cells[columnIndex] : null;
    const label = richTextToPlainText(headerCell?.content ?? emptyRichText()).trim() || `Column ${columnIndex + 1}`;
    const cellText = richTextToPlainText(cell.content);
    const available = MAX_CONCEPT_TEXT - characters - label.length;
    if (available <= 0 || nodes + 4 > MAX_CONCEPT_NODES) break;
    const labelBlock: RichTextNode = { type: 'paragraph', content: [{ type: 'text', text: label, marks: [{ type: 'bold' }] }] };
    content.push(labelBlock);
    nodes += richTextNodeCount(labelBlock);
    if (cellText.length <= available) {
      const safeBlocks = safeRichText(cell.content).content ?? [];
      const safeNodeCount = safeBlocks.reduce((total, block) => total + richTextNodeCount(block), 0);
      if (nodes + safeNodeCount <= MAX_CONCEPT_NODES) {
        content.push(...safeBlocks);
        nodes += safeNodeCount;
      } else {
        const readableFallback: RichTextNode = { type: 'paragraph', content: [{ type: 'text', text: cellText }] };
        content.push(readableFallback);
        nodes += richTextNodeCount(readableFallback);
      }
      characters += label.length + cellText.length;
    } else {
      content.push(...(richTextFromPlainText(`${cellText.slice(0, Math.max(0, available - 1))}…`).content ?? []));
      break;
    }
  }
  return content.length ? { type: 'doc', content } : emptyRichText();
}

function overlaps(
  position: { x: number; y: number },
  dimensions: { width: number; height: number },
  node: EditorNode,
) {
  const nodeSize = editorNodeDimensions(node);
  return position.x < node.position.x + nodeSize.width + CONVERSION_GAP
    && position.x + dimensions.width + CONVERSION_GAP > node.position.x
    && position.y < node.position.y + nodeSize.height + CONVERSION_GAP
    && position.y + dimensions.height + CONVERSION_GAP > node.position.y;
}

export function canvasNodesFromTable(
  tableNode: EditorNode,
  existingNodes: EditorNode[],
  interaction: TableInteraction | null,
): EditorNode[] {
  if (tableNode.data.kind !== 'table') return [];
  const data = tableNode.data;
  const selection = tableSelectionForCanvas(data, interaction);
  if (!selection.rowIndexes.length || !selection.columnIndexes.length) return [];
  const nonHeaderColumns = selection.columnIndexes.filter((index) => !data.headerColumn || index !== 0);
  const titleColumnIndex = nonHeaderColumns[0] ?? selection.columnIndexes[0];
  const tableSize = tableDimensions(data);
  const generated: EditorNode[] = [];
  let y = tableNode.position.y;

  for (const rowIndex of selection.rowIndexes) {
    const titleCell = data.rows[rowIndex]?.cells[titleColumnIndex];
    const label = richTextToPlainText(titleCell?.content ?? emptyRichText()).trim().slice(0, 500) || 'Untitled row';
    const body = bodyDocument(data, rowIndex, selection.columnIndexes, titleColumnIndex);
    const dimensions = {
      width: CONCEPT_DEFAULT_WIDTH,
      height: Math.max(CONCEPT_MIN_HEIGHT, 88 + Math.min(220, richTextToPlainText(body).length * 0.28)),
    };
    const position = { x: tableNode.position.x + tableSize.width + CONVERSION_COLUMN_GAP, y };
    let collision = [...existingNodes, ...generated].find((node) => node.id !== tableNode.id && overlaps(position, dimensions, node));
    while (collision) {
      position.y = collision.position.y + editorNodeDimensions(collision).height + CONVERSION_GAP;
      collision = [...existingNodes, ...generated].find((node) => node.id !== tableNode.id && overlaps(position, dimensions, node));
    }
    const id = crypto.randomUUID();
    generated.push({
      id,
      type: 'concept',
      position,
      style: dimensions,
      draggable: true,
      deletable: true,
      selected: true,
      data: {
        kind: 'concept',
        name: label,
        label,
        title: titleDocument(titleCell?.content ?? emptyRichText(), label),
        body,
        eyebrow: data.name,
        tone: 'ink',
        collapsed: false,
        horizontalAlign: 'left',
        verticalAlign: 'top',
        opacity: 1,
        locked: false,
      },
    });
    y = position.y + dimensions.height + CONVERSION_GAP;
  }
  return generated;
}
