import { MarkerType } from '@xyflow/react';
import type {
  EditorDocument,
  EditorEdge,
  EditorNode,
  RichTextDocument,
  RichTextMark,
  RichTextNode,
  TableCell,
  TableCellTone,
  TableColumn,
  TableRow,
  VectorPathLayer,
} from './types';
import { graphIntegrityIssues } from './graph-rules';
import {
  TABLE_CELL_TONES,
  TABLE_MAX_CELLS,
  TABLE_MAX_CELL_TEXT,
  TABLE_MAX_COLUMNS,
  TABLE_MAX_COLUMN_WIDTH,
  TABLE_MAX_ROWS,
  TABLE_MAX_ROW_HEIGHT,
  TABLE_MIN_COLUMN_WIDTH,
  TABLE_MIN_ROW_HEIGHT,
  tableDimensions,
} from './table-grid';
import {
  conceptTitleFromPlainText,
  emptyRichText,
  normalizeRichTextDocument,
  richTextToPlainText,
  sanitizeLinkHref,
} from './rich-text';

export const PROJECT_FORMAT = 'synaptable-project';
export const PROJECT_FILE_VERSION = 5;
export const MAX_PROJECT_FILE_SIZE = 40 * 1024 * 1024;

const MAX_TITLE_LENGTH = 120;
const MAX_NODES = 2_500;
const MAX_EDGES = 5_000;
const MAX_PATHS_PER_VECTOR = 25_000;
const MAX_PATH_DATA_LENGTH = 2_000_000;
const MAX_RASTER_DATA_LENGTH = 24 * 1024 * 1024;

type ProjectEnvelope = {
  format: typeof PROJECT_FORMAT;
  version: typeof PROJECT_FILE_VERSION;
  exportedAt: string;
  document: EditorDocument;
};

const RICH_TEXT_NODE_TYPES = new Set<RichTextNode['type']>([
  'doc',
  'paragraph',
  'text',
  'hardBreak',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
]);
const RICH_TEXT_MARK_TYPES = new Set<RichTextMark['type']>([
  'bold',
  'italic',
  'underline',
  'strike',
  'link',
]);
const MAX_RICH_TEXT_NODES = 2_000;
const MAX_RICH_TEXT_DEPTH = 8;
const MAX_RICH_TEXT_LENGTH = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function boundedString(value: unknown, label: string, maxLength = 10_000): string {
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`${label} is invalid or too long.`);
  }
  return value;
}

function boundedUnit(value: unknown, label: string): number {
  const number = finiteNumber(value, label);
  if (number < 0 || number > 1) throw new Error(`${label} must be between 0 and 1.`);
  return number;
}

function optionalDimension(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const number = finiteNumber(value, 'Layer dimension');
  if (number <= 0 || number > 100_000) throw new Error('Layer dimensions are invalid.');
  return number;
}

function parseRichTextMark(value: unknown): RichTextMark {
  if (!isRecord(value) || typeof value.type !== 'string' || !RICH_TEXT_MARK_TYPES.has(value.type as RichTextMark['type'])) {
    throw new Error('Concept formatting contains an unsupported text style.');
  }
  const type = value.type as RichTextMark['type'];
  if (type !== 'link') return { type };
  const href = isRecord(value.attrs) && typeof value.attrs.href === 'string'
    ? sanitizeLinkHref(value.attrs.href)
    : null;
  if (!href) throw new Error('Concept formatting contains an unsafe link.');
  return { type, attrs: { href } };
}

function parseRichTextNode(
  value: unknown,
  state: { nodes: number; characters: number },
  depth = 0,
): RichTextNode {
  if (!isRecord(value) || typeof value.type !== 'string' || !RICH_TEXT_NODE_TYPES.has(value.type as RichTextNode['type'])) {
    throw new Error('Concept content contains an unsupported block.');
  }
  state.nodes += 1;
  if (state.nodes > MAX_RICH_TEXT_NODES || depth > MAX_RICH_TEXT_DEPTH) {
    throw new Error('Concept content is too complex.');
  }
  const type = value.type as RichTextNode['type'];
  const node: RichTextNode = { type };
  if (type === 'text') {
    node.text = boundedString(value.text, 'Concept text', MAX_RICH_TEXT_LENGTH);
    state.characters += node.text.length;
    if (state.characters > MAX_RICH_TEXT_LENGTH) throw new Error('Concept content is too long.');
    if (value.marks !== undefined) {
      if (!Array.isArray(value.marks) || value.marks.length > 5) {
        throw new Error('Concept text has too many styles.');
      }
      node.marks = value.marks.map(parseRichTextMark);
    }
  }
  if (type === 'taskItem') {
    node.attrs = { checked: isRecord(value.attrs) && value.attrs.checked === true };
  } else if (type === 'orderedList') {
    const start = isRecord(value.attrs) && typeof value.attrs.start === 'number'
      ? Math.max(1, Math.min(9_999, Math.trunc(value.attrs.start)))
      : 1;
    node.attrs = { start };
  }
  if (value.content !== undefined) {
    if (!Array.isArray(value.content)) throw new Error('Concept content is malformed.');
    node.content = value.content.map((child) => parseRichTextNode(child, state, depth + 1));
  }
  return node;
}

function parseRichTextDocument(value: unknown): RichTextDocument {
  if (value === undefined) return emptyRichText();
  const document = parseRichTextNode(value, { nodes: 0, characters: 0 });
  if (document.type !== 'doc') throw new Error('Concept content must start with a document block.');
  const allowedChildren: Record<RichTextNode['type'], Set<RichTextNode['type']>> = {
    doc: new Set(['paragraph', 'bulletList', 'orderedList', 'taskList']),
    paragraph: new Set(['text', 'hardBreak']),
    bulletList: new Set(['listItem']),
    orderedList: new Set(['listItem']),
    taskList: new Set(['taskItem']),
    listItem: new Set(['paragraph', 'bulletList', 'orderedList', 'taskList']),
    taskItem: new Set(['paragraph', 'bulletList', 'orderedList', 'taskList']),
    text: new Set(),
    hardBreak: new Set(),
  };
  const assertStructure = (node: RichTextNode) => {
    for (const child of node.content ?? []) {
      if (!allowedChildren[node.type].has(child.type)) {
        throw new Error(`Concept content cannot place ${child.type} inside ${node.type}.`);
      }
      assertStructure(child);
    }
  };
  assertStructure(document);
  if (!document.content?.length) document.content = [{ type: 'paragraph' }];
  return normalizeRichTextDocument(document as RichTextDocument);
}

function parseConceptTitle(value: unknown): RichTextDocument {
  const title = parseRichTextDocument(value);
  if (
    title.content?.length !== 1
    || title.content[0].type !== 'paragraph'
    || (title.content[0].content ?? []).some((child) => child.type !== 'text')
  ) {
    throw new Error('Concept title must be a single line of formatted text.');
  }
  boundedString(richTextToPlainText(title), 'Concept title', 500);
  return title;
}

function parseVectorPath(value: unknown, index: number): VectorPathLayer {
  if (!isRecord(value)) throw new Error(`Vector path ${index + 1} is invalid.`);
  return {
    id: boundedString(value.id, 'Vector path id', 160),
    name: boundedString(value.name, 'Vector path name', 240),
    d: boundedString(value.d, 'Vector path data', MAX_PATH_DATA_LENGTH),
    fill: boundedString(value.fill, 'Vector fill', 160),
    stroke: boundedString(value.stroke, 'Vector stroke', 160),
    strokeWidth: Math.max(0, finiteNumber(value.strokeWidth, 'Vector stroke width')),
    opacity: boundedUnit(value.opacity, 'Vector opacity'),
    visible: value.visible !== false,
    locked: value.locked === true,
  };
}

function parseTableColumn(value: unknown, index: number): TableColumn {
  if (!isRecord(value)) throw new Error(`Table column ${index + 1} is invalid.`);
  const width = finiteNumber(value.width, 'Table column width');
  if (width < TABLE_MIN_COLUMN_WIDTH || width > TABLE_MAX_COLUMN_WIDTH) {
    throw new Error(`Table column ${index + 1} has an invalid width.`);
  }
  return {
    id: boundedString(value.id, 'Table column id', 160),
    width,
  };
}

function parseTableCell(value: unknown, rowIndex: number, columnIndex: number): TableCell {
  if (!isRecord(value)) throw new Error(`Table cell ${rowIndex + 1}, ${columnIndex + 1} is invalid.`);
  const tone = value.tone;
  if (typeof tone !== 'string' || !TABLE_CELL_TONES.includes(tone as TableCellTone)) {
    throw new Error(`Table cell ${rowIndex + 1}, ${columnIndex + 1} has an invalid color.`);
  }
  const horizontalAlign = value.horizontalAlign;
  if (horizontalAlign !== 'left' && horizontalAlign !== 'center' && horizontalAlign !== 'right') {
    throw new Error(`Table cell ${rowIndex + 1}, ${columnIndex + 1} has invalid alignment.`);
  }
  return {
    id: boundedString(value.id, 'Table cell id', 160),
    text: boundedString(value.text, 'Table cell text', TABLE_MAX_CELL_TEXT),
    tone: tone as TableCellTone,
    horizontalAlign,
  };
}

function parseTableRow(value: unknown, index: number, columnCount: number): TableRow {
  if (!isRecord(value) || !Array.isArray(value.cells) || value.cells.length !== columnCount) {
    throw new Error(`Table row ${index + 1} does not match the table columns.`);
  }
  const height = finiteNumber(value.height, 'Table row height');
  if (height < TABLE_MIN_ROW_HEIGHT || height > TABLE_MAX_ROW_HEIGHT) {
    throw new Error(`Table row ${index + 1} has an invalid height.`);
  }
  return {
    id: boundedString(value.id, 'Table row id', 160),
    height,
    cells: value.cells.map((cell, columnIndex) => parseTableCell(cell, index, columnIndex)),
  };
}

function parseNode(value: unknown, index: number, sourceVersion: 1 | 2 | 3 | 4 | 5): EditorNode {
  if (!isRecord(value) || !isRecord(value.position) || !isRecord(value.data)) {
    throw new Error(`Layer ${index + 1} is invalid.`);
  }

  const id = boundedString(value.id, 'Layer id', 160);
  const position = {
    x: finiteNumber(value.position.x, 'Layer x position'),
    y: finiteNumber(value.position.y, 'Layer y position'),
  };
  const style = isRecord(value.style)
    ? {
        width: optionalDimension(value.style.width),
        height: optionalDimension(value.style.height),
      }
    : undefined;
  const data = value.data;
  const kind = data.kind;
  const name = boundedString(data.name, 'Layer name', 240);
  const opacity = boundedUnit(data.opacity, 'Layer opacity');
  const locked = data.locked === true;
  const common = {
    id,
    position,
    style,
    hidden: value.hidden === true,
    selected: false,
    draggable: !locked,
    deletable: !locked,
  };

  if (kind === 'concept') {
    const tone = data.tone;
    if (tone !== 'ink' && tone !== 'indigo' && tone !== 'mint') {
      throw new Error(`Layer ${index + 1} has an invalid concept tone.`);
    }
    const legacyLabel = boundedString(data.label, 'Concept label', 500);
    const title = sourceVersion >= 3
      ? parseConceptTitle(data.title)
      : conceptTitleFromPlainText(legacyLabel);
    const label = boundedString(richTextToPlainText(title), 'Concept label', 500);
    const horizontalAlign = sourceVersion >= 4
      && (data.horizontalAlign === 'center' || data.horizontalAlign === 'right')
      ? data.horizontalAlign
      : 'left';
    const verticalAlign = sourceVersion >= 4
      && (data.verticalAlign === 'middle' || data.verticalAlign === 'bottom')
      ? data.verticalAlign
      : 'top';
    return {
      ...common,
      type: 'concept',
      data: {
        kind,
        name,
        opacity,
        locked,
        label,
        title,
        body: sourceVersion === 1 ? emptyRichText() : parseRichTextDocument(data.body),
        eyebrow: boundedString(data.eyebrow, 'Concept eyebrow', 160),
        tone,
        collapsed: sourceVersion >= 2 && data.collapsed === true,
        horizontalAlign,
        verticalAlign,
      },
    };
  }

  if (kind === 'raster') {
    const src = boundedString(data.src, 'Raster image data', MAX_RASTER_DATA_LENGTH);
    if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(src)) {
      throw new Error(`Layer ${index + 1} contains an unsupported raster image.`);
    }
    const naturalWidth = finiteNumber(data.naturalWidth, 'Raster width');
    const naturalHeight = finiteNumber(data.naturalHeight, 'Raster height');
    if (naturalWidth <= 0 || naturalHeight <= 0 || naturalWidth * naturalHeight > 24_000_000) {
      throw new Error(`Layer ${index + 1} exceeds the decoded image limit.`);
    }
    return {
      ...common,
      type: 'raster',
      data: {
        kind,
        name,
        opacity,
        locked,
        src,
        fileName: boundedString(data.fileName, 'Raster file name', 500),
        naturalWidth,
        naturalHeight,
      },
    };
  }

  if (kind === 'vector') {
    if (!Array.isArray(data.viewBox) || data.viewBox.length !== 4) {
      throw new Error(`Layer ${index + 1} has an invalid vector view box.`);
    }
    const viewBox = data.viewBox.map((item) => finiteNumber(item, 'Vector view box')) as [
      number,
      number,
      number,
      number,
    ];
    if (viewBox[2] <= 0 || viewBox[3] <= 0) {
      throw new Error(`Layer ${index + 1} has an empty vector view box.`);
    }
    if (!Array.isArray(data.paths) || data.paths.length > MAX_PATHS_PER_VECTOR) {
      throw new Error(`Layer ${index + 1} has too many vector paths.`);
    }
    return {
      ...common,
      type: 'vector',
      data: {
        kind,
        name,
        opacity,
        locked,
        sourceName: boundedString(data.sourceName, 'Vector source name', 500),
        viewBox,
        paths: data.paths.map(parseVectorPath),
      },
    };
  }

  if (kind === 'table') {
    if (sourceVersion < 5) throw new Error('Table layers require document version 5.');
    if (!Array.isArray(data.columns) || data.columns.length < 1 || data.columns.length > TABLE_MAX_COLUMNS) {
      throw new Error(`Layer ${index + 1} has an invalid number of table columns.`);
    }
    if (!Array.isArray(data.rows) || data.rows.length < 1 || data.rows.length > TABLE_MAX_ROWS) {
      throw new Error(`Layer ${index + 1} has an invalid number of table rows.`);
    }
    if (data.columns.length * data.rows.length > TABLE_MAX_CELLS) {
      throw new Error(`Layer ${index + 1} exceeds the table cell limit.`);
    }
    const columns = data.columns.map(parseTableColumn);
    const rows = data.rows.map((row, rowIndex) => parseTableRow(row, rowIndex, columns.length));
    const nestedIds = [
      ...columns.map((column) => column.id),
      ...rows.map((row) => row.id),
      ...rows.flatMap((row) => row.cells.map((cell) => cell.id)),
    ];
    if (new Set(nestedIds).size !== nestedIds.length) {
      throw new Error(`Layer ${index + 1} contains duplicate table ids.`);
    }
    const dimensions = tableDimensions({
      kind: 'table',
      name,
      opacity,
      locked,
      columns,
      rows,
      headerRow: data.headerRow === true,
      headerColumn: data.headerColumn === true,
    });
    return {
      ...common,
      type: 'table',
      style: dimensions,
      data: {
        kind,
        name,
        opacity,
        locked,
        columns,
        rows,
        headerRow: data.headerRow === true,
        headerColumn: data.headerColumn === true,
      },
    };
  }

  throw new Error(`Layer ${index + 1} has an unsupported type.`);
}

function parseEdge(value: unknown, index: number): EditorEdge {
  if (!isRecord(value)) throw new Error(`Connector ${index + 1} is invalid.`);
  const rawData = isRecord(value.data) ? value.data : {};
  const kind = rawData.kind === 'dashed' || rawData.kind === 'emphasis' ? rawData.kind : 'default';
  const label = typeof rawData.label === 'string'
    ? boundedString(rawData.label, 'Connector label', 240)
    : typeof value.label === 'string'
      ? boundedString(value.label, 'Connector label', 240)
      : '';
  return {
    id: boundedString(value.id, 'Connector id', 160),
    source: boundedString(value.source, 'Connector source', 160),
    target: boundedString(value.target, 'Connector target', 160),
    sourceHandle:
      typeof value.sourceHandle === 'string' ? value.sourceHandle.slice(0, 160) : undefined,
    targetHandle:
      typeof value.targetHandle === 'string' ? value.targetHandle.slice(0, 160) : undefined,
    type: 'smoothstep',
    animated: false,
    style: {
      stroke: kind === 'emphasis' ? '#635bff' : '#a9adb7',
      strokeWidth: kind === 'emphasis' ? 2.5 : 1.5,
      strokeDasharray: kind === 'dashed' ? '6 5' : undefined,
    },
    markerEnd: { type: MarkerType.ArrowClosed },
    label,
    data: { label, kind },
    selected: false,
  };
}

export function validateEditorDocument(
  value: unknown,
  options: { strictGraph?: boolean } = {},
): EditorDocument {
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2 && value.schemaVersion !== 3 && value.schemaVersion !== 4 && value.schemaVersion !== 5)) {
    throw new Error('This project uses an unsupported document version.');
  }
  const sourceVersion = value.schemaVersion;
  if (!Array.isArray(value.nodes) || value.nodes.length > MAX_NODES) {
    throw new Error('This project contains too many layers.');
  }
  if (!Array.isArray(value.edges) || value.edges.length > MAX_EDGES) {
    throw new Error('This project contains too many connectors.');
  }

  const nodes = value.nodes.map((node, index) => parseNode(node, index, sourceVersion));
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) throw new Error('This project contains duplicate layer ids.');
  const parsedEdges = value.edges.map(parseEdge);
  const graphIssues = graphIntegrityIssues(nodes, parsedEdges);
  if (options.strictGraph && graphIssues.length) {
    const issue = graphIssues[0];
    if (issue.kind === 'duplicate-connector-id') {
      throw new Error('This project contains duplicate connector ids.');
    }
    if (issue.kind === 'missing-endpoint') {
      throw new Error('This project contains a connector with a missing layer.');
    }
    if (issue.kind === 'self-connection') {
      throw new Error('This project contains a connector from a layer to itself.');
    }
    if (issue.kind === 'duplicate-connection') {
      throw new Error('This project contains duplicate directed connectors.');
    }
  }
  const edgeIds = new Set<string>();
  const directedPairs = new Set<string>();
  const edges = parsedEdges.filter((edge) => {
    const pair = `${edge.source}\u0000${edge.target}`;
    const valid = nodeIds.has(edge.source)
      && nodeIds.has(edge.target)
      && edge.source !== edge.target
      && !edgeIds.has(edge.id)
      && !directedPairs.has(pair);
    edgeIds.add(edge.id);
    directedPairs.add(pair);
    return valid;
  });

  return {
    schemaVersion: 5,
    title: boundedString(value.title, 'Project title', MAX_TITLE_LENGTH),
    nodes,
    edges,
    updatedAt:
      typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
        ? value.updatedAt
        : Date.now(),
  };
}

export function serializeProjectBackup(document: EditorDocument): string {
  const envelope: ProjectEnvelope = {
    format: PROJECT_FORMAT,
    version: PROJECT_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    document: validateEditorDocument(document),
  };
  return JSON.stringify(envelope, null, 2);
}

export function parseProjectBackup(source: string): EditorDocument {
  if (source.length > MAX_PROJECT_FILE_SIZE) throw new Error('The project backup is too large.');
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  if (!isRecord(value) || value.format !== PROJECT_FORMAT || (value.version !== 1 && value.version !== 2 && value.version !== 3 && value.version !== 4 && value.version !== 5)) {
    throw new Error('This is not a supported SynapTable project backup.');
  }
  return validateEditorDocument(value.document, { strictGraph: true });
}

export function downloadProjectBackup(source: string, fileName: string) {
  const blob = new Blob([source], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.synaptable') ? fileName : `${fileName}.synaptable`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
