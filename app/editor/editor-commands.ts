import { MarkerType } from '@xyflow/react';
import { connectionIssue, connectionIssueMessage, type ConnectionCandidate } from './graph-rules';
import {
  CONCEPT_DEFAULT_WIDTH,
  CONCEPT_MIN_HEIGHT,
  relativeConceptLayout,
  type NodePosition,
} from './node-layout';
import {
  conceptTitleFromPlainText,
  emptyRichText,
  richTextFromPlainText,
  richTextToPlainText,
} from './rich-text';
import {
  createTableData,
  nextTableName,
  tableDimensions,
  tableFromNodes,
  tableSearchText,
  TABLE_MAX_CELLS,
  TABLE_MAX_CELL_TEXT,
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
} from './table-grid';
import { canvasNodesFromTableSelection } from './table-to-canvas';
import type { ConnectorKind, EditorEdge, EditorNode, EditorNodeData } from './types';

const MAX_CONCEPT_TITLE = 500;
const MAX_CONCEPT_BODY = 20_000;
const MAX_LAYER_IDS = 100;

export type EditorCommandState = {
  nodes: EditorNode[];
  edges: EditorEdge[];
};

export const EDITOR_COMMAND_ERROR_CODES = [
  'CANCELLED',
  'PROJECT_CHANGED',
  'STALE_REVISION',
  'INVALID_INPUT',
  'NOT_FOUND',
  'PROTECTED_CONTENT',
  'LIMIT_EXCEEDED',
  'CONFLICT',
  'PERSISTENCE_FAILED',
  'INTERNAL_ERROR',
] as const;

export type EditorCommandErrorCode = (typeof EDITOR_COMMAND_ERROR_CODES)[number];

type EditorCommandResultBase = {
  summary: string;
  affectedIds: string[];
  undoAvailable: boolean;
  warnings?: string[];
};

export type EditorCommandResult =
  | (EditorCommandResultBase & { ok: true })
  | (EditorCommandResultBase & { ok: false; code: EditorCommandErrorCode });

export type EditorCommandOutcome = EditorCommandState & {
  result: EditorCommandResult;
};

export type EditorCommand = (state: Readonly<EditorCommandState>) => EditorCommandOutcome;

type IdFactory = () => string;
type LayerKind = EditorNodeData['kind'];

export type WorkspaceSummary = {
  projectId: string;
  projectName: string;
  layerCount: number;
  connectorCount: number;
  layerCounts: Record<LayerKind, number>;
  selectedIds: string[];
  hiddenCount: number;
  lockedCount: number;
};

export type LayerSearchResult = {
  matches: Array<{ id: string; name: string; kind: LayerKind }>;
  totalMatches: number;
  truncated: boolean;
};

function defaultIdFactory() {
  return crypto.randomUUID();
}

function failure(
  state: Readonly<EditorCommandState>,
  code: EditorCommandErrorCode,
  summary: string,
): EditorCommandOutcome {
  return {
    nodes: state.nodes,
    edges: state.edges,
    result: { ok: false, code, summary, affectedIds: [], undoAvailable: false },
  };
}

function success(
  state: EditorCommandState,
  summary: string,
  affectedIds: string[],
  warnings?: string[],
): EditorCommandOutcome {
  return {
    ...state,
    result: {
      ok: true,
      summary,
      affectedIds,
      undoAvailable: true,
      ...(warnings?.length ? { warnings } : {}),
    },
  };
}

function availableId(state: Readonly<EditorCommandState>, createId: IdFactory) {
  const used = new Set([...state.nodes.map((node) => node.id), ...state.edges.map((edge) => edge.id)]);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = createId();
    if (id && !used.has(id)) return id;
  }
  return null;
}

function uniqueIdFactory(state: Readonly<EditorCommandState>, createId: IdFactory): IdFactory {
  const used = new Set([...state.nodes.map((node) => node.id), ...state.edges.map((edge) => edge.id)]);
  return () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const id = createId();
      if (!id || used.has(id)) continue;
      used.add(id);
      return id;
    }
    throw new Error('A unique layer ID could not be created.');
  };
}

function finitePosition(position: NodePosition) {
  return Number.isFinite(position.x) && Number.isFinite(position.y);
}

function deselectEdges(edges: EditorEdge[]) {
  return edges.map((edge) => edge.selected ? { ...edge, selected: false } : edge);
}

function createConceptNode({
  id,
  position,
  title,
  body = '',
  eyebrow = 'Concept',
}: {
  id: string;
  position: NodePosition;
  title: string;
  body?: string;
  eyebrow?: string;
}): EditorNode {
  return {
    id,
    type: 'concept',
    position,
    style: { width: CONCEPT_DEFAULT_WIDTH, height: CONCEPT_MIN_HEIGHT },
    draggable: true,
    deletable: true,
    selected: true,
    data: {
      kind: 'concept',
      name: title,
      label: title,
      title: conceptTitleFromPlainText(title),
      body: body ? richTextFromPlainText(body) : emptyRichText(),
      eyebrow,
      tone: 'ink',
      collapsed: false,
      horizontalAlign: 'left',
      verticalAlign: 'top',
      opacity: 1,
      locked: false,
    },
  };
}

export function getWorkspaceSummary(
  state: Readonly<EditorCommandState>,
  { projectId, projectName }: { projectId: string; projectName: string },
): WorkspaceSummary {
  const layerCounts: Record<LayerKind, number> = {
    concept: 0,
    raster: 0,
    vector: 0,
    table: 0,
  };
  let hiddenCount = 0;
  let lockedCount = 0;
  const selectedIds: string[] = [];
  for (const node of state.nodes) {
    layerCounts[node.data.kind] += 1;
    if (node.hidden) hiddenCount += 1;
    if (node.data.locked) lockedCount += 1;
    if (node.selected && !node.hidden) selectedIds.push(node.id);
  }
  return {
    projectId,
    projectName,
    layerCount: state.nodes.length,
    connectorCount: state.edges.length,
    layerCounts,
    selectedIds,
    hiddenCount,
    lockedCount,
  };
}

export function findLayers(
  state: Readonly<EditorCommandState>,
  {
    query,
    kinds,
    limit = 20,
  }: {
    query: string;
    kinds?: LayerKind[];
    limit?: number;
  },
): LayerSearchResult {
  const normalizedQuery = query.trim().slice(0, 200).toLocaleLowerCase();
  const allowedKinds = kinds?.length ? new Set(kinds) : null;
  const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(50, limit)) : 20;
  const matching = state.nodes.filter((node) => {
    if (node.hidden || (allowedKinds && !allowedKinds.has(node.data.kind))) return false;
    if (!normalizedQuery) return true;
    const searchable = [
      node.data.name,
      node.data.kind === 'concept' ? node.data.label : '',
      node.data.kind === 'concept' ? node.data.eyebrow : '',
      node.data.kind === 'concept' ? richTextToPlainText(node.data.body) : '',
      node.data.kind === 'table' ? tableSearchText(node.data) : '',
    ].join(' ').toLocaleLowerCase();
    return searchable.includes(normalizedQuery);
  });
  return {
    matches: matching.slice(0, safeLimit).map((node) => ({
      id: node.id,
      name: node.data.name,
      kind: node.data.kind,
    })),
    totalMatches: matching.length,
    truncated: matching.length > safeLimit,
  };
}

export function createConceptCommand({
  center,
  title = 'New concept',
  body = '',
  eyebrow = 'Concept',
  createId = defaultIdFactory,
}: {
  center: NodePosition;
  title?: string;
  body?: string;
  eyebrow?: string;
  createId?: IdFactory;
}): EditorCommand {
  return (state) => {
    const normalizedTitle = title.trim() || 'Untitled concept';
    if (!finitePosition(center)) return failure(state, 'INVALID_INPUT', 'Choose a valid canvas position.');
    if (normalizedTitle.length > MAX_CONCEPT_TITLE) {
      return failure(state, 'LIMIT_EXCEEDED', `Concept titles can contain at most ${MAX_CONCEPT_TITLE} characters.`);
    }
    if (body.length > MAX_CONCEPT_BODY) {
      return failure(state, 'LIMIT_EXCEEDED', `Concept bodies can contain at most ${MAX_CONCEPT_BODY.toLocaleString()} characters.`);
    }
    if (eyebrow.length > MAX_CONCEPT_TITLE) {
      return failure(state, 'LIMIT_EXCEEDED', `Concept labels can contain at most ${MAX_CONCEPT_TITLE} characters.`);
    }
    const id = availableId(state, createId);
    if (!id) return failure(state, 'CONFLICT', 'A unique concept ID could not be created.');
    const node = createConceptNode({
      id,
      position: { x: center.x - 94, y: center.y - 39 },
      title: normalizedTitle,
      body,
      eyebrow,
    });
    return success({
      nodes: [...state.nodes.map((item) => ({ ...item, selected: false })), node],
      edges: deselectEdges(state.edges),
    }, `${normalizedTitle} added.`, [id]);
  };
}

export function createTableCommand({
  center,
  rows = 3,
  columns = 3,
  values = [],
  headerRow = true,
  name,
  createId = defaultIdFactory,
}: {
  center: NodePosition;
  rows?: number;
  columns?: number;
  values?: string[][];
  headerRow?: boolean;
  name?: string;
  createId?: IdFactory;
}): EditorCommand {
  return (state) => {
    if (!finitePosition(center)) return failure(state, 'INVALID_INPUT', 'Choose a valid canvas position.');
    if (!Number.isInteger(rows) || rows < 1 || rows > TABLE_MAX_ROWS) {
      return failure(state, 'LIMIT_EXCEEDED', `Tables can contain between 1 and ${TABLE_MAX_ROWS} rows.`);
    }
    if (!Number.isInteger(columns) || columns < 1 || columns > TABLE_MAX_COLUMNS) {
      return failure(state, 'LIMIT_EXCEEDED', `Tables can contain between 1 and ${TABLE_MAX_COLUMNS} columns.`);
    }
    if (rows * columns > TABLE_MAX_CELLS) {
      return failure(state, 'LIMIT_EXCEEDED', `A table can contain at most ${TABLE_MAX_CELLS.toLocaleString()} cells.`);
    }
    if (values.length > rows || values.some((row) => row.length > columns)) {
      return failure(state, 'INVALID_INPUT', 'Initial values exceed the requested table dimensions.');
    }
    if (values.some((row) => row.some((cell) => typeof cell !== 'string'))) {
      return failure(state, 'INVALID_INPUT', 'Every initial table value must be text.');
    }
    if (values.some((row) => row.some((cell) => cell.length > TABLE_MAX_CELL_TEXT))) {
      return failure(state, 'LIMIT_EXCEEDED', `Table cells can contain at most ${TABLE_MAX_CELL_TEXT.toLocaleString()} characters.`);
    }
    const normalizedName = name?.trim() || nextTableName(state.nodes);
    if (normalizedName.length > MAX_CONCEPT_TITLE) {
      return failure(state, 'LIMIT_EXCEEDED', `Table names can contain at most ${MAX_CONCEPT_TITLE} characters.`);
    }
    const id = availableId(state, createId);
    if (!id) return failure(state, 'CONFLICT', 'A unique table ID could not be created.');
    const data = createTableData({ name: normalizedName, rows, columns, values, headerRow });
    const dimensions = tableDimensions(data);
    const node: EditorNode = {
      id,
      type: 'table',
      position: { x: center.x - dimensions.width / 2, y: center.y - dimensions.height / 2 },
      style: dimensions,
      draggable: true,
      deletable: true,
      selected: true,
      data,
    };
    return success({
      nodes: [...state.nodes.map((item) => ({ ...item, selected: false })), node],
      edges: deselectEdges(state.edges),
    }, `${normalizedName} added.`, [id]);
  };
}

export function organizeLayersIntoTableCommand({
  layerIds,
  name = 'Organized ideas',
  createId = defaultIdFactory,
}: {
  layerIds: string[];
  name?: string;
  createId?: IdFactory;
}): EditorCommand {
  return (state) => {
    const uniqueIds = [...new Set(layerIds)];
    if (!uniqueIds.length) return failure(state, 'INVALID_INPUT', 'Choose at least one layer to organize.');
    if (uniqueIds.length !== layerIds.length) return failure(state, 'CONFLICT', 'Each layer can be organized only once.');
    if (uniqueIds.length > Math.min(MAX_LAYER_IDS, TABLE_MAX_ROWS - 1)) {
      return failure(state, 'LIMIT_EXCEEDED', `Organize no more than ${Math.min(MAX_LAYER_IDS, TABLE_MAX_ROWS - 1)} layers at a time.`);
    }
    const selected = uniqueIds.map((id) => state.nodes.find((node) => node.id === id));
    if (selected.some((node) => !node)) return failure(state, 'NOT_FOUND', 'One or more selected layers no longer exist.');
    const layers = selected as EditorNode[];
    if (layers.some((node) => node.data.locked)) return failure(state, 'PROTECTED_CONTENT', 'Unlock the selected layers before organizing them.');
    if (layers.some((node) => node.hidden)) return failure(state, 'PROTECTED_CONTENT', 'Reveal hidden layers before organizing them.');
    const normalizedName = name.trim() || 'Organized ideas';
    if (normalizedName.length > MAX_CONCEPT_TITLE) {
      return failure(state, 'LIMIT_EXCEEDED', `Table names can contain at most ${MAX_CONCEPT_TITLE} characters.`);
    }
    const id = availableId(state, createId);
    if (!id) return failure(state, 'CONFLICT', 'A unique table ID could not be created.');
    const readingOrder = [...layers].sort((left, right) => (
      left.position.y - right.position.y || left.position.x - right.position.x
    ));
    const data = tableFromNodes(readingOrder, normalizedName);
    const dimensions = tableDimensions(data);
    const left = Math.min(...layers.map((node) => node.position.x));
    const top = Math.min(...layers.map((node) => node.position.y));
    const tableNode: EditorNode = {
      id,
      type: 'table',
      position: { x: left + 36, y: top + 36 },
      style: dimensions,
      draggable: true,
      deletable: true,
      selected: true,
      data,
    };
    return success({
      nodes: [...state.nodes.map((node) => ({ ...node, selected: false })), tableNode],
      edges: deselectEdges(state.edges),
    }, `Organized ${layers.length} ${layers.length === 1 ? 'layer' : 'layers'} into table rows. Originals were kept.`, [id]);
  };
}

export function createCanvasNodesFromRowsCommand({
  tableId,
  rowIds,
  columnIds,
  createId = defaultIdFactory,
}: {
  tableId: string;
  rowIds?: string[];
  columnIds?: string[];
  createId?: IdFactory;
}): EditorCommand {
  return (state) => {
    const source = state.nodes.find((node) => node.id === tableId);
    if (!source) return failure(state, 'NOT_FOUND', 'Choose an existing table.');
    const data = source.data;
    if (data.kind !== 'table') return failure(state, 'NOT_FOUND', 'Choose an existing table.');
    if (data.locked) return failure(state, 'PROTECTED_CONTENT', 'Unlock the table before creating canvas nodes.');
    if (source.hidden) return failure(state, 'PROTECTED_CONTENT', 'Reveal the table before creating canvas nodes.');
    if (rowIds && new Set(rowIds).size !== rowIds.length) return failure(state, 'CONFLICT', 'Each table row can be selected only once.');
    if (columnIds && new Set(columnIds).size !== columnIds.length) return failure(state, 'CONFLICT', 'Each table column can be selected only once.');
    if (data.headerRow && rowIds?.includes(data.rows[0]?.id ?? '')) {
      return failure(state, 'INVALID_INPUT', 'Header rows cannot be converted into canvas nodes.');
    }
    if (rowIds?.some((id) => !data.rows.some((row) => row.id === id))) {
      return failure(state, 'NOT_FOUND', 'One or more selected table rows no longer exist.');
    }
    if (columnIds?.some((id) => !data.columns.some((column) => column.id === id))) {
      return failure(state, 'NOT_FOUND', 'One or more selected table columns no longer exist.');
    }
    let generated: EditorNode[];
    try {
      generated = canvasNodesFromTableSelection(
        source,
        state.nodes,
        { rowIds, columnIds },
        uniqueIdFactory(state, createId),
      );
    } catch (error) {
      return failure(state, 'CONFLICT', error instanceof Error ? error.message : 'Unique canvas node IDs could not be created.');
    }
    if (!generated.length) {
      return failure(state, 'INVALID_INPUT', 'Select at least one data row and column to create canvas nodes.');
    }
    return success({
      nodes: [...state.nodes.map((node) => ({ ...node, selected: false })), ...generated],
      edges: deselectEdges(state.edges),
    }, `${generated.length} canvas ${generated.length === 1 ? 'node' : 'nodes'} created from ${data.name}.`, generated.map((node) => node.id));
  };
}

export function connectLayersCommand({
  connection,
  kind = 'default',
  label = '',
  createId = defaultIdFactory,
}: {
  connection: ConnectionCandidate;
  kind?: ConnectorKind;
  label?: string;
  createId?: IdFactory;
}): EditorCommand {
  return (state) => {
    const issue = connectionIssue(state.nodes, state.edges, connection);
    if (issue) {
      const code: EditorCommandErrorCode = issue === 'unknown-endpoint'
        ? 'NOT_FOUND'
        : issue === 'locked-endpoint'
          ? 'PROTECTED_CONTENT'
          : issue === 'duplicate-connection'
            ? 'CONFLICT'
            : 'INVALID_INPUT';
      return failure(state, code, connectionIssueMessage(issue));
    }
    if (label.length > MAX_CONCEPT_TITLE) {
      return failure(state, 'LIMIT_EXCEEDED', `Connector labels can contain at most ${MAX_CONCEPT_TITLE} characters.`);
    }
    const id = availableId(state, createId);
    if (!id) return failure(state, 'CONFLICT', 'A unique connector ID could not be created.');
    const edge: EditorEdge = {
      id,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
      type: 'smoothstep',
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#a9adb7', strokeWidth: 1.5 },
      label,
      data: { label, kind },
    };
    return success({ nodes: state.nodes, edges: [...deselectEdges(state.edges), edge] }, 'Layers connected.', [id]);
  };
}

export function createRelativeConceptCommand({
  sourceId,
  relation,
  createId = defaultIdFactory,
}: {
  sourceId: string;
  relation: 'child' | 'sibling';
  createId?: IdFactory;
}): EditorCommand {
  return (state) => {
    const source = state.nodes.find((node) => node.id === sourceId);
    if (!source) return failure(state, 'NOT_FOUND', 'The source layer no longer exists.');
    if (source.data.locked) return failure(state, 'PROTECTED_CONTENT', 'Unlock the source layer before adding a related concept.');
    if (source.hidden) return failure(state, 'PROTECTED_CONTENT', 'Reveal the source layer before adding a related concept.');
    const newId = availableId(state, createId);
    if (!newId) return failure(state, 'CONFLICT', 'A unique concept ID could not be created.');
    const layout = relativeConceptLayout(state.nodes, state.edges, sourceId, relation, newId);
    const position = layout.positions.get(newId);
    if (!position) return failure(state, 'INTERNAL_ERROR', 'A position for the new concept could not be calculated.');
    const parent = layout.parentId ? state.nodes.find((node) => node.id === layout.parentId) : null;
    if (parent?.data.locked) return failure(state, 'PROTECTED_CONTENT', 'Unlock the parent layer before adding a related concept.');
    const nextNode = createConceptNode({
      id: newId,
      position,
      title: 'New concept',
      eyebrow: relation === 'child' ? 'Child idea' : 'Related idea',
    });
    const nodes = [
      ...state.nodes.map((node) => ({
        ...node,
        position: layout.positions.get(node.id) ?? node.position,
        selected: false,
      })),
      nextNode,
    ];
    if (!layout.parentId) {
      return success({ nodes, edges: deselectEdges(state.edges) }, 'Related concept added.', [newId]);
    }
    const edgeId = availableId({ nodes, edges: state.edges }, createId);
    if (!edgeId) return failure(state, 'CONFLICT', 'A unique connector ID could not be created.');
    const connection = {
      source: layout.parentId,
      target: newId,
      ...(layout.direction === 'vertical' ? { sourceHandle: 'bottom', targetHandle: 'top' } : {}),
    };
    const issue = connectionIssue(nodes, state.edges, connection);
    if (issue) {
      const code: EditorCommandErrorCode = issue === 'unknown-endpoint'
        ? 'NOT_FOUND'
        : issue === 'locked-endpoint'
          ? 'PROTECTED_CONTENT'
          : issue === 'duplicate-connection'
            ? 'CONFLICT'
            : 'INVALID_INPUT';
      return failure(state, code, connectionIssueMessage(issue));
    }
    const edge: EditorEdge = {
      id: edgeId,
      ...connection,
      type: 'smoothstep',
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#a9adb7', strokeWidth: 1.5 },
      data: { label: '', kind: 'default' },
    };
    return success({ nodes, edges: [...deselectEdges(state.edges), edge] }, 'Related concept added and connected.', [newId, edgeId]);
  };
}
