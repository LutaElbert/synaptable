'use client';

import {
  Background,
  Controls,
  Handle,
  MiniMap,
  MarkerType,
  NodeResizer,
  NodeToolbar,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type NodeProps,
  type ResizeParams,
} from '@xyflow/react';
import {
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceBetween,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  Hand,
  HardDrive,
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
  Lock,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Square,
  Table2,
  Trash2,
  Type as TypeIcon,
  Undo2,
  Unlock,
  Upload,
  Waypoints,
  X,
} from 'lucide-react';
import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import '@xyflow/react/dist/style.css';
import {
  downloadProjectBackup,
  MAX_PROJECT_FILE_SIZE,
  parseProjectBackup,
  serializeProjectBackup,
} from './document-file';
import {
  downloadBlob,
  pngToPdfBlob,
  resolveExportContent,
  svgToPngBlob,
  tableToCsv,
  type ExportBackground,
  type ExportFormat,
  type ExportScope,
  type PdfOrientation,
  type PdfPageSize,
} from './export-file';
import { buildSvgExport } from './export-svg';
import { EDITOR_FEATURES } from './features';
import { fileToDataUrl, validateImageFile } from './image-file';
import {
  canConnect,
  collapsedDescendantIds,
  connectionIssue,
  connectionIssueMessage,
  removeNodesAndConnections,
  tidyGraphPositions,
} from './graph-rules';
import { trimHistory, type EditorSnapshot } from './history-budget';
import { initialDocument } from './initial-document';
import {
  CONCEPT_DEFAULT_WIDTH,
  CONCEPT_EDIT_MIN_HEIGHT,
  CONCEPT_EDIT_MIN_WIDTH,
  CONCEPT_MIN_HEIGHT,
  CONCEPT_MIN_WIDTH,
  editorNodeDimensions,
  relativeConceptLayout,
} from './node-layout';
import {
  clearLocalDocument,
  createLocalCheckpoint,
  deleteLocalCheckpoint,
  listLocalCheckpoints,
  loadLocalDocument,
  saveLocalDocument,
  type LocalCheckpoint,
} from './persistence';
import {
  formatStorageBytes,
  inspectStorageHealth,
  isQuotaExceededError,
  requestPersistentStorage,
  storageUsageRatio,
  type StorageHealth,
} from './storage-health';
import {
  conceptTitleFromPlainText,
  emptyRichText,
  normalizeRichTextDocument,
  replaceRichTextPlainText,
  richTextFromPlainText,
  richTextIsEmpty,
  richTextToPlainText,
} from './rich-text';
import { RichTextView } from './RichTextView';
import {
  TableNode,
  TableNodeActionContext,
  type TableNavigationDirection,
} from './TableNode';
import {
  nearestTableCellAfterStructureRemoval,
  normalizeTableInteraction,
  tableColumnRange,
  tableInteractionCells,
  tableInteractionFocus,
  tableInteractionGrid,
  tableInteractionTopLeft,
  tableRowRange,
  type TableInteraction,
} from './table-interaction';
import {
  adjacentTableCell,
  cloneTableData,
  clipboardGridToHtml,
  clipboardGridToText,
  createTableData,
  distributeTableColumns,
  distributeTableRows,
  duplicateTableColumn,
  duplicateTableRow,
  firstTableCell,
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
  tableCellHasContent,
  tableDimensions,
  tableFromNodes,
  tableSearchText,
  updateTableCell,
  updateTableCells,
  replaceTableCellPlainText,
  TABLE_MAX_CELLS,
  TABLE_MAX_COLUMNS,
  TABLE_MAX_COLUMN_WIDTH,
  TABLE_MAX_ROWS,
  TABLE_MAX_ROW_HEIGHT,
  TABLE_MIN_COLUMN_WIDTH,
  TABLE_MIN_ROW_HEIGHT,
  type ClipboardGrid,
  type TableCellAddress,
} from './table-grid';
import type {
  ConversionOptions,
  EditorDocument,
  EditorEdge,
  EditorNode,
  RichTextDocument,
  TableCellTone,
  TableNodeData,
  VectorPathLayer,
} from './types';
import { vectorizeDataUrl } from './vectorize';

type ToolMode = 'select' | 'hand';
type SelectionOperation = 'replace' | 'add' | 'subtract';
type MobilePanel = 'layers' | 'inspector' | null;
type QuickTemplate = keyof typeof CONCEPT_TEMPLATES | 'table';
type Toast = { id: number; message: string; tone: 'info' | 'success' | 'error' };
const MAX_FILES_PER_IMPORT = 12;
const InlineConceptEditor = lazy(() => import('./InlineConceptEditor'));
const RESIZE_OBSERVER_NOTIFICATIONS = new Set([
  'ResizeObserver loop completed with undelivered notifications.',
  'ResizeObserver loop limit exceeded',
]);

function installFrameScheduledResizeObserver() {
  if (typeof window === 'undefined' || typeof window.ResizeObserver === 'undefined') return;
  const resizeWindow = window as typeof window & { __synaptableFrameScheduledResizeObserver?: boolean };
  if (resizeWindow.__synaptableFrameScheduledResizeObserver) return;
  const NativeResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class FrameScheduledResizeObserver extends NativeResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      let frameId: number | null = null;
      let pendingEntries: ResizeObserverEntry[] = [];
      super((entries, observer) => {
        pendingEntries = entries;
        if (frameId !== null) return;
        frameId = window.requestAnimationFrame(() => {
          frameId = null;
          const nextEntries = pendingEntries;
          pendingEntries = [];
          callback(nextEntries, observer);
        });
      });
    }
  };
  resizeWindow.__synaptableFrameScheduledResizeObserver = true;
}

installFrameScheduledResizeObserver();
const CONCEPT_TEMPLATES = {
  idea: {
    name: 'New idea',
    eyebrow: 'Idea',
    tone: 'indigo' as const,
    body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Describe the idea…' }] }] } as RichTextDocument,
  },
  task: {
    name: 'Action items',
    eyebrow: 'Task',
    tone: 'mint' as const,
    body: { type: 'doc', content: [{ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First action' }] }] }] }] } as RichTextDocument,
  },
  decision: {
    name: 'Decision',
    eyebrow: 'Decision',
    tone: 'ink' as const,
    body: { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Option' }] }] }] }] } as RichTextDocument,
  },
  question: {
    name: 'Open question',
    eyebrow: 'Question',
    tone: 'indigo' as const,
    body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'What do we need to learn?' }] }] } as RichTextDocument,
  },
};

type NodeActionContextValue = {
  convertingId: string | null;
  editingConceptId: string | null;
  editingConceptField: 'title' | 'body';
  setEditingConceptField: (field: 'title' | 'body') => void;
  keepImage: (id: string) => void;
  vectorizeImage: (id: string, expandLayers?: boolean) => void;
  cancelVectorization: () => void;
  recordResizeStart: (id: string) => void;
  recordResize: (id: string, dimensions: ResizeParams) => void;
  recordResizeEnd: (id: string, dimensions: ResizeParams) => void;
  beginConceptEdit: (id: string) => void;
  updateConceptTitle: (id: string, title: RichTextDocument) => void;
  updateConceptBody: (id: string, body: RichTextDocument) => void;
  commitConceptEdit: () => void;
  cancelConceptEdit: () => void;
  toggleBranch: (id: string) => void;
  hasChildren: (id: string) => boolean;
  addConceptRelative: (id: string, relation: 'child' | 'sibling') => void;
};

const NodeActionContext = createContext<NodeActionContextValue | null>(null);
const SelectedNodeCountContext = createContext(0);

function useNodeActions() {
  const value = useContext(NodeActionContext);
  if (!value) throw new Error('Node actions are unavailable.');
  return value;
}

function CommonHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
    </>
  );
}

function ConceptNode({ id, data, selected }: NodeProps<EditorNode>) {
  const actions = useNodeActions();
  const selectedNodeCount = useContext(SelectedNodeCountContext);
  if (data.kind !== 'concept') return null;
  const editing = actions.editingConceptId === id;
  const singleSelection = selected && selectedNodeCount === 1;
  return (
    <>
      <NodeToolbar isVisible={singleSelection && !editing && !data.locked} position={Position.Top} offset={14}>
        <div className="node-actionbar nodrag nowheel" aria-label="Concept actions">
          <button type="button" onClick={() => actions.beginConceptEdit(id)}><TypeIcon size={14} /> Edit text</button>
          <button type="button" onClick={() => actions.addConceptRelative(id, 'child')}><Plus size={14} /> Add child</button>
          <button type="button" onClick={() => actions.addConceptRelative(id, 'sibling')}><Plus size={14} /> Add sibling</button>
        </div>
      </NodeToolbar>
      <NodeResizer
        isVisible={singleSelection && !data.locked && !editing}
        minWidth={CONCEPT_MIN_WIDTH}
        minHeight={CONCEPT_MIN_HEIGHT}
        onResizeStart={() => actions.recordResizeStart(id)}
        onResize={(_, dimensions) => actions.recordResize(id, dimensions)}
        onResizeEnd={(_, dimensions) => actions.recordResizeEnd(id, dimensions)}
      />
      <article
        className={`concept-node tone-${data.tone} content-align-${data.horizontalAlign} content-valign-${data.verticalAlign} ${editing ? 'is-editing nodrag nowheel' : ''}`}
        style={{ opacity: data.opacity }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (!data.locked) actions.beginConceptEdit(id);
        }}
      >
        <span>{data.eyebrow}</span>
        {editing ? (
          <Suspense fallback={<span className="editor-loading">Loading editor…</span>}>
            <InlineConceptEditor
              title={data.title}
              body={data.body}
              activeField={actions.editingConceptField}
              onActiveFieldChange={actions.setEditingConceptField}
              onTitleChange={(title) => actions.updateConceptTitle(id, title)}
              onBodyChange={(body) => actions.updateConceptBody(id, body)}
              onCommit={actions.commitConceptEdit}
              onCancel={actions.cancelConceptEdit}
            />
          </Suspense>
        ) : (
          <>
            {data.label
              ? <RichTextView document={data.title} className="concept-title-rich-text" />
              : <strong className="concept-title-placeholder">Untitled concept</strong>}
            {!richTextIsEmpty(data.body) ? <RichTextView document={data.body} /> : null}
          </>
        )}
        {actions.hasChildren(id) ? (
          <button
            type="button"
            className="branch-toggle nodrag nowheel"
            aria-label={`${data.collapsed ? 'Expand' : 'Collapse'} branch from ${data.label}`}
            aria-expanded={!data.collapsed}
            onClick={(event) => {
              event.stopPropagation();
              actions.toggleBranch(id);
            }}
          >
            {data.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : null}
      </article>
      <CommonHandles />
    </>
  );
}

function RasterNode({ id, data, selected }: NodeProps<EditorNode>) {
  const actions = useNodeActions();
  const selectedNodeCount = useContext(SelectedNodeCountContext);
  if (data.kind !== 'raster') return null;
  const isConverting = actions.convertingId === id;
  const singleSelection = selected && selectedNodeCount === 1;
  return (
    <>
      <NodeToolbar isVisible={singleSelection && !data.locked} position={Position.Top} offset={14}>
        <div className="node-actionbar nodrag nowheel" aria-label="Image actions">
          <button type="button" onClick={() => actions.keepImage(id)}>
            <Check size={14} /> Keep image
          </button>
          <button type="button" onClick={() => actions.addConceptRelative(id, 'child')}>
            <Plus size={14} /> Add child
          </button>
          <button type="button" onClick={() => actions.addConceptRelative(id, 'sibling')}>
            <Plus size={14} /> Add sibling
          </button>
          {EDITOR_FEATURES.imageVectorization ? (
            <>
              <button
                type="button"
                onClick={() => isConverting ? actions.cancelVectorization() : actions.vectorizeImage(id)}
              >
                {isConverting ? <X size={14} /> : <Shapes size={14} />}
                {isConverting ? 'Cancel' : 'Vectorize'}
              </button>
              <button
                type="button"
                onClick={() => actions.vectorizeImage(id, true)}
                disabled={isConverting}
              >
                <Layers3 size={14} /> Extract layers
              </button>
            </>
          ) : null}
        </div>
      </NodeToolbar>
      <NodeResizer
        isVisible={singleSelection && !data.locked}
        minWidth={120}
        minHeight={80}
        keepAspectRatio
        onResizeStart={() => actions.recordResizeStart(id)}
        onResize={(_, dimensions) => actions.recordResize(id, dimensions)}
        onResizeEnd={(_, dimensions) => actions.recordResizeEnd(id, dimensions)}
      />
      <figure className="raster-node" style={{ opacity: data.opacity }}>
        {/* The user-provided image is the content of this editable layer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.src}
          alt=""
          width={data.naturalWidth}
          height={data.naturalHeight}
          draggable={false}
        />
        {isConverting ? (
          <figcaption className="conversion-overlay" role="status">
            <LoaderCircle className="spin" size={20} />
            Tracing locally…
          </figcaption>
        ) : null}
      </figure>
      <CommonHandles />
    </>
  );
}

function VectorNode({ id, data, selected }: NodeProps<EditorNode>) {
  const actions = useNodeActions();
  const selectedNodeCount = useContext(SelectedNodeCountContext);
  if (data.kind !== 'vector') return null;
  const [minX, minY, width, height] = data.viewBox;
  const singleSelection = selected && selectedNodeCount === 1;
  return (
    <>
      <NodeResizer
        isVisible={singleSelection && !data.locked}
        minWidth={120}
        minHeight={80}
        keepAspectRatio
        onResizeStart={() => actions.recordResizeStart(id)}
        onResize={(_, dimensions) => actions.recordResize(id, dimensions)}
        onResizeEnd={(_, dimensions) => actions.recordResizeEnd(id, dimensions)}
      />
      <div className="vector-node" style={{ opacity: data.opacity }}>
        <svg
          viewBox={`${minX} ${minY} ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${data.name}, ${data.paths.length} editable vector layers`}
        >
          {data.paths.map((path) =>
            path.visible ? (
              <path
                key={path.id}
                d={path.d}
                fill={path.fill}
                stroke={path.stroke}
                strokeWidth={path.strokeWidth}
                opacity={path.opacity}
              />
            ) : null,
          )}
        </svg>
        <span className="vector-badge">{data.paths.length} layers</span>
      </div>
      <CommonHandles />
    </>
  );
}

const nodeTypes = {
  concept: ConceptNode,
  raster: RasterNode,
  vector: VectorNode,
  table: TableNode,
};

function cloneSnapshot(nodes: EditorNode[], edges: EditorEdge[]): EditorSnapshot {
  return structuredClone({ nodes, edges });
}

type PersistableEditorState = {
  title: string;
  nodes: EditorNode[];
  edges: EditorEdge[];
};

const TRANSIENT_ELEMENT_KEYS = new Set(['selected', 'dragging', 'measured', 'resizing']);

function persistableElementEqual(left: EditorNode | EditorEdge, right: EditorNode | EditorEdge) {
  const leftRecord = left as unknown as Record<string, unknown>;
  const rightRecord = right as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
  for (const key of keys) {
    if (TRANSIENT_ELEMENT_KEYS.has(key)) continue;
    if (!Object.is(leftRecord[key], rightRecord[key])) return false;
  }
  return true;
}

function persistableEditorStateEqual(left: PersistableEditorState, right: PersistableEditorState) {
  if (left.title !== right.title || left.nodes.length !== right.nodes.length || left.edges.length !== right.edges.length) {
    return false;
  }
  return left.nodes.every((node, index) => persistableElementEqual(node, right.nodes[index]))
    && left.edges.every((edge, index) => persistableElementEqual(edge, right.edges[index]));
}

function restoreNodeGeometry(node: EditorNode, origin: EditorNode): EditorNode {
  const width = Number(origin.style?.width) || Number(origin.measured?.width);
  const height = Number(origin.style?.height) || Number(origin.measured?.height);
  return {
    ...node,
    position: structuredClone(origin.position),
    style: width && height
      ? { ...structuredClone(origin.style ?? {}), width, height }
      : origin.style ? structuredClone(origin.style) : undefined,
    measured: origin.measured ? structuredClone(origin.measured) : undefined,
  };
}

function safeFileBase(fileName: string) {
  return (
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'synaptable-export'
  );
}

function connectorPresentation(kind: 'default' | 'dashed' | 'emphasis') {
  return {
    stroke: kind === 'emphasis' ? '#635bff' : '#a9adb7',
    strokeWidth: kind === 'emphasis' ? 2.5 : 1.5,
    strokeDasharray: kind === 'dashed' ? '6 5' : undefined,
  };
}

function EditorInner() {
  const [nodes, setNodes] = useState<EditorNode[]>(initialDocument.nodes);
  const [edges, setEdges] = useState<EditorEdge[]>(initialDocument.edges);
  const [title, setTitle] = useState(initialDocument.title);
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [temporaryPanActive, setTemporaryPanActive] = useState(false);
  const [viewportZoom, setViewportZoom] = useState(1);
  const [dragActive, setDragActive] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [saveFailure, setSaveFailure] = useState<'quota' | 'unknown' | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [expandedVectors, setExpandedVectors] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<{ nodeId: string; pathId: string } | null>(null);
  const [conversionOptions, setConversionOptions] = useState<ConversionOptions>({
    preset: 'balanced',
    colors: 16,
    despeckle: 1,
  });
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>('canvas');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportPadding, setExportPadding] = useState(48);
  const [exportBackground, setExportBackground] = useState<ExportBackground>('transparent');
  const [exportScale, setExportScale] = useState(2);
  const [pdfPageSize, setPdfPageSize] = useState<PdfPageSize>('fit');
  const [pdfOrientation, setPdfOrientation] = useState<PdfOrientation>('auto');
  const [pdfMargin, setPdfMargin] = useState(24);
  const [pdfQuality, setPdfQuality] = useState(2);
  const [exportBusy, setExportBusy] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [editingConceptId, setEditingConceptId] = useState<string | null>(null);
  const [editingConceptField, setEditingConceptField] = useState<'title' | 'body'>('title');
  const [tableInteraction, setTableInteraction] = useState<TableInteraction | null>(null);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [conceptTemplate, setConceptTemplate] = useState<QuickTemplate>('idea');
  const [checkpoints, setCheckpoints] = useState<LocalCheckpoint[]>([]);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [storageHealthBusy, setStorageHealthBusy] = useState(false);
  const [autosaveRevision, setAutosaveRevision] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const exportDialogRef = useRef<HTMLDialogElement>(null);
  const exportTriggerRef = useRef<HTMLButtonElement>(null);
  const backupDialogRef = useRef<HTMLDialogElement>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const titleRef = useRef(title);
  const pastRef = useRef<EditorSnapshot[]>([]);
  const futureRef = useRef<EditorSnapshot[]>([]);
  const dragOriginRef = useRef<EditorSnapshot | null>(null);
  const resizeOriginRef = useRef<EditorSnapshot | null>(null);
  const fieldOriginRef = useRef<EditorSnapshot | null>(null);
  const conceptEditOriginRef = useRef<EditorSnapshot | null>(null);
  const tableEditOriginRef = useRef<EditorSnapshot | null>(null);
  const layerSelectionAnchorRef = useRef<string | null>(null);
  const selectionOriginRef = useRef<Set<string>>(new Set());
  const selectionOperationRef = useRef<SelectionOperation>('replace');
  const dragDepthRef = useRef(0);
  const conversionControllerRef = useRef<AbortController | null>(null);
  const saveQueueRef = useRef(Promise.resolve());
  const saveTicketRef = useRef(0);
  const saveFailureRef = useRef<'quota' | 'unknown' | null>(null);
  const autosaveInputRef = useRef<PersistableEditorState>({ title, nodes, edges });
  const {
    screenToFlowPosition,
    fitView,
    getViewport,
    setCenter,
    zoomIn,
    zoomOut,
  } = useReactFlow<EditorNode, EditorEdge>();

  useEffect(() => {
    // React Flow can trigger these browser-generated notifications while its
    // NodeResizer and internal measurements settle. The resize still completes;
    // prevent dev overlays and error trackers from treating it as an app crash.
    const handleResizeObserverNotification = (event: ErrorEvent) => {
      if (!RESIZE_OBSERVER_NOTIFICATIONS.has(event.message)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('error', handleResizeObserverNotification, true);
    return () => window.removeEventListener('error', handleResizeObserverNotification, true);
  }, []);

  useLayoutEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useLayoutEffect(() => {
    edgesRef.current = edges;
  }, [edges]);
  useLayoutEffect(() => {
    titleRef.current = title;
  }, [title]);
  useLayoutEffect(() => {
    const next = { title, nodes, edges };
    const previous = autosaveInputRef.current;
    autosaveInputRef.current = next;
    if (!persistableEditorStateEqual(previous, next)) {
      // Mark the document dirty before the changed canvas is painted. This
      // prevents an older queued write from presenting a stale "saved" state.
      saveTicketRef.current += 1;
      setSaveState('saving');
      setAutosaveRevision((current) => current + 1);
    }
  }, [edges, nodes, title]);

  const announce = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      4200,
    );
  }, []);

  const refreshHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: pastRef.current.length > 0,
      canRedo: futureRef.current.length > 0,
    });
  }, []);

  const recordHistory = useCallback((snapshot?: EditorSnapshot) => {
    pastRef.current.push(snapshot ?? cloneSnapshot(nodesRef.current, edgesRef.current));
    trimHistory(pastRef.current);
    futureRef.current = [];
    refreshHistoryState();
  }, [refreshHistoryState]);

  const undo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current.push(cloneSnapshot(nodesRef.current, edgesRef.current));
    trimHistory(futureRef.current);
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setSelectedPath(null);
    refreshHistoryState();
  }, [refreshHistoryState]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(cloneSnapshot(nodesRef.current, edgesRef.current));
    trimHistory(pastRef.current);
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedPath(null);
    refreshHistoryState();
  }, [refreshHistoryState]);

  const getCurrentDocument = useCallback((): EditorDocument => ({
    schemaVersion: 6,
    title: titleRef.current,
    nodes: nodesRef.current.map((node) => ({ ...node, selected: false })),
    edges: edgesRef.current.map((edge) => ({ ...edge, selected: false })),
    updatedAt: Date.now(),
  }), []);

  const queueDocumentSave = useCallback((document: EditorDocument, pendingTicket?: number) => {
    const ticket = pendingTicket ?? ++saveTicketRef.current;
    if (ticket !== saveTicketRef.current) return Promise.resolve();
    setSaveState('saving');
    const nextSave = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveLocalDocument(document));
    saveQueueRef.current = nextSave;
    void nextSave
      .then(() => {
        if (ticket === saveTicketRef.current) {
          saveFailureRef.current = null;
          setSaveFailure(null);
          setSaveState('saved');
        }
      })
      .catch((error) => {
        if (ticket === saveTicketRef.current) {
          const failure = isQuotaExceededError(error) ? 'quota' : 'unknown';
          if (failure === 'quota' && saveFailureRef.current !== 'quota') {
            announce('Browser storage is full. Open backup and restore to download a safe copy.', 'error');
          }
          saveFailureRef.current = failure;
          setSaveFailure(failure);
          setSaveState('error');
        }
      });
    return nextSave;
  }, [announce]);

  useEffect(() => {
    let active = true;
    Promise.all([loadLocalDocument(), listLocalCheckpoints()])
      .then(([document, storedCheckpoints]) => {
        if (!active) return;
        setCheckpoints(storedCheckpoints);
        if (!document) return;
        setNodes(document.nodes.map((node) => ({ ...node, selected: false })));
        setEdges(document.edges.map((edge) => ({ ...edge, selected: false })));
        setTitle(document.title);
      })
      .catch(() => {
        setSaveState('error');
        announce('The saved local project could not be opened. Use a backup or start a new project.', 'error');
      })
      .finally(() => active && setHydrated(true));
    return () => {
      active = false;
    };
  }, [announce]);

  useEffect(() => {
    if (!hydrated) return;
    // The layout effect already invalidated older writes for changed content.
    // Allocate a ticket here only for the initial hydrated document.
    const ticket = saveTicketRef.current || ++saveTicketRef.current;
    const saveTimeout = window.setTimeout(() => {
      void queueDocumentSave(getCurrentDocument(), ticket);
    }, 450);
    return () => {
      window.clearTimeout(saveTimeout);
    };
  }, [autosaveRevision, getCurrentDocument, hydrated, queueDocumentSave]);

  useEffect(() => {
    if (!hydrated) return;
    const saveWhenHidden = () => {
      if (document.visibilityState === 'hidden') void queueDocumentSave(getCurrentDocument());
    };
    document.addEventListener('visibilitychange', saveWhenHidden);
    return () => document.removeEventListener('visibilitychange', saveWhenHidden);
  }, [getCurrentDocument, hydrated, queueDocumentSave]);

  useEffect(() => {
    if (exportOpen && !exportDialogRef.current?.open) exportDialogRef.current?.showModal();
    if (!exportOpen && exportDialogRef.current?.open) {
      exportDialogRef.current.close();
      window.requestAnimationFrame(() => exportTriggerRef.current?.focus());
    }
  }, [exportOpen]);

  useEffect(() => {
    if (backupOpen && !backupDialogRef.current?.open) backupDialogRef.current?.showModal();
    if (!backupOpen && backupDialogRef.current?.open) backupDialogRef.current.close();
  }, [backupOpen]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<EditorNode>[]) => {
      if (changes.some((change) => change.type === 'remove')) recordHistory();
      setNodes((current) => applyNodeChanges(changes, current));
      if (changes.some((change) => change.type === 'remove')) setSelectedPath(null);
    },
    [recordHistory],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<EditorEdge>[]) => {
      if (changes.some((change) => change.type === 'remove')) recordHistory();
      setEdges((current) => applyEdgeChanges(changes, current));
    },
    [recordHistory],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      const issue = connectionIssue(nodesRef.current, edgesRef.current, connection);
      if (issue) {
        announce(connectionIssueMessage(issue), 'error');
        return;
      }
      recordHistory();
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: crypto.randomUUID(),
            type: 'smoothstep',
            style: { stroke: '#a9adb7', strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed },
            label: '',
            data: { label: '', kind: 'default' },
          },
          current,
        ),
      );
    },
    [announce, recordHistory],
  );

  const handleReconnect = useCallback((edge: EditorEdge, connection: Connection) => {
    const issue = connectionIssue(nodesRef.current, edgesRef.current, connection, edge.id);
    if (issue) {
      announce(connectionIssueMessage(issue), 'error');
      return;
    }
    recordHistory();
    setEdges((current) => reconnectEdge(edge, connection, current, { shouldReplaceId: false }));
  }, [announce, recordHistory]);

  const isValidConnection = useCallback(
    (connection: Connection | EditorEdge) => canConnect(nodesRef.current, edgesRef.current, connection),
    [],
  );

  const selectNode = useCallback((id: string, additive = false) => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: additive ? node.id === id ? !node.selected : node.selected : node.id === id,
      })),
    );
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    setSelectedPath(null);
  }, []);

  const revealAndSelectNode = useCallback((id: string) => {
    const ancestors = new Set<string>();
    const queue = [id];
    while (queue.length) {
      const target = queue.shift()!;
      for (const edge of edgesRef.current) {
        if (edge.target !== target || ancestors.has(edge.source)) continue;
        ancestors.add(edge.source);
        queue.push(edge.source);
      }
    }
    setNodes((current) => current.map((node) => ({
      ...node,
      selected: node.id === id,
      data: node.data.kind === 'concept' && ancestors.has(node.id)
        ? { ...node.data, collapsed: false }
        : node.data,
    })));
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    setSelectedPath(null);
    window.setTimeout(() => fitView({ nodes: [{ id }], duration: 280, padding: 0.5, maxZoom: 1.4 }), 0);
  }, [fitView]);

  const ingestFiles = useCallback(
    async (files: File[], clientPoint?: { x: number; y: number }) => {
      if (files.length === 0) {
        announce('Use a PNG, JPEG, or WebP image.', 'error');
        return;
      }
      if (files.length > MAX_FILES_PER_IMPORT) {
        announce(`Add up to ${MAX_FILES_PER_IMPORT} images at a time.`, 'error');
        return;
      }

      try {
        const imageFiles = await Promise.all(
          files.map(async (file) => ({ file, dimensions: await validateImageFile(file) })),
        );
        const fallbackPoint = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        const dropPoint = clientPoint
          ? screenToFlowPosition(clientPoint)
          : fallbackPoint;
        const imported: EditorNode[] = [];

        for (const [index, item] of imageFiles.entries()) {
          const { file, dimensions } = item;
          const src = await fileToDataUrl(file);
          const scale = Math.min(1, 430 / dimensions.width, 310 / dimensions.height);
          const width = Math.max(120, Math.round(dimensions.width * scale));
          const height = Math.max(80, Math.round(dimensions.height * scale));
          imported.push({
            id: crypto.randomUUID(),
            type: 'raster',
            position: {
              x: dropPoint.x - width / 2 + index * 28,
              y: dropPoint.y - height / 2 + index * 28,
            },
            style: { width, height },
            draggable: true,
            deletable: true,
            data: {
              kind: 'raster',
              name: file.name,
              fileName: file.name,
              src,
              naturalWidth: dimensions.width,
              naturalHeight: dimensions.height,
              opacity: 1,
              locked: false,
            },
            selected: index === imageFiles.length - 1,
          });
        }

        recordHistory();
        setNodes((current) => [
          ...current.map((node) => ({ ...node, selected: false })),
          ...imported,
        ]);
        announce(
          `${imported.length === 1 ? imported[0].data.name : `${imported.length} images`} added to the canvas.`,
          'success',
        );
      } catch (error) {
        announce(error instanceof Error ? error.message : 'The image could not be added.', 'error');
      }
    },
    [announce, recordHistory, screenToFlowPosition],
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.some((file) => file.type.startsWith('image/'))) {
        event.preventDefault();
        void ingestFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [ingestFiles]);

  const selectAllVisibleLayers = useCallback(() => {
    const collapsed = collapsedDescendantIds(nodesRef.current, edgesRef.current);
    const selectableIds = new Set(
      nodesRef.current
        .filter((node) => !node.hidden && !node.data.locked && !collapsed.has(node.id))
        .map((node) => node.id),
    );
    setNodes((current) => current.map((node) => ({
      ...node,
      selected: selectableIds.has(node.id),
    })));
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    setSelectedPath(null);
    layerSelectionAnchorRef.current = selectableIds.values().next().value ?? null;
    announce(
      selectableIds.size
        ? `${selectableIds.size} ${selectableIds.size === 1 ? 'layer' : 'layers'} selected.`
        : 'There are no visible unlocked layers to select.',
    );
  }, [announce]);

  const clearCanvasSelection = useCallback(() => {
    setNodes((current) => current.map((node) => node.selected ? { ...node, selected: false } : node));
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    setSelectedPath(null);
    layerSelectionAnchorRef.current = null;
  }, []);

  const handleSelectionStart = useCallback((event: ReactMouseEvent) => {
    selectionOriginRef.current = new Set(
      nodesRef.current.filter((node) => node.selected).map((node) => node.id),
    );
    selectionOperationRef.current = event.altKey
      ? 'subtract'
      : event.shiftKey
        ? 'add'
        : 'replace';
    setSelectedPath(null);
  }, []);

  const handleSelectionEnd = useCallback(() => {
    const origin = selectionOriginRef.current;
    const operation = selectionOperationRef.current;
    setNodes((current) => {
      const marqueeIds = new Set(current.filter((node) => node.selected).map((node) => node.id));
      return current.map((node) => ({
        ...node,
        selected: operation === 'replace'
          ? marqueeIds.has(node.id) && !node.data.locked
          : operation === 'add'
            ? origin.has(node.id) || (marqueeIds.has(node.id) && !node.data.locked)
            : origin.has(node.id) && !(marqueeIds.has(node.id) && !node.data.locked),
      }));
    });
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    layerSelectionAnchorRef.current = null;
    selectionOriginRef.current = new Set();
    selectionOperationRef.current = 'replace';
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = Boolean(target?.closest('input, textarea, [contenteditable="true"]'));
      const isInteractive = Boolean(target?.closest('input, textarea, select, button, a[href], [contenteditable="true"]'));
      if (target?.closest('dialog[open]')) return;

      if (!isInteractive && event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        setTemporaryPanActive(true);
        return;
      }

      if (event.defaultPrevented) return;

      if (!isEditing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (!isEditing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selectAllVisibleLayers();
      } else if (!isEditing && event.key === 'Escape') {
        clearCanvasSelection();
      } else if (!isEditing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'v') {
        setToolMode('select');
      } else if (!isEditing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'h') {
        setToolMode('hand');
      } else if (!isEditing && !event.metaKey && !event.ctrlKey && !event.altKey && (event.key === '+' || event.key === '=')) {
        event.preventDefault();
        void zoomIn({ duration: 140 });
      } else if (!isEditing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key === '-') {
        event.preventDefault();
        void zoomOut({ duration: 140 });
      } else if (!isEditing && !event.metaKey && !event.ctrlKey && !event.altKey && (event.key === '0' || event.key === 'Home')) {
        event.preventDefault();
        void fitView({ duration: 220, padding: 0.22 });
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setTemporaryPanActive(false);
    };
    const onWindowBlur = () => setTemporaryPanActive(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [clearCanvasSelection, fitView, redo, selectAllVisibleLayers, undo, zoomIn, zoomOut]);

  useEffect(
    () => () => conversionControllerRef.current?.abort(),
    [],
  );

  const keepImage = useCallback((id: string) => {
    void id;
    setNodes((current) => current.map((node) => ({ ...node, selected: false })));
    setSelectedPath(null);
    announce('Image kept as an editable reference layer.', 'success');
  }, [announce]);

  const vectorizeImage = useCallback(
    async (id: string, expandLayers = false) => {
      if (!EDITOR_FEATURES.imageVectorization) {
        announce('Image vectorization is currently unavailable.');
        return;
      }
      const raster = nodesRef.current.find((node) => node.id === id);
      if (!raster || raster.data.kind !== 'raster' || convertingId) return;
      const controller = new AbortController();
      conversionControllerRef.current = controller;
      setConvertingId(id);
      announce('Vectorization started locally. Your image is not being uploaded.');
      try {
        const result = await vectorizeDataUrl(
          raster.data.src,
          conversionOptions,
          controller.signal,
        );
        const rasterWidth = Number(raster.style?.width) || 320;
        const rasterHeight = Number(raster.style?.height) || 240;
        const vectorNode: EditorNode = {
          id: crypto.randomUUID(),
          type: 'vector',
          position: {
            x: raster.position.x + rasterWidth + 80,
            y: raster.position.y,
          },
          style: { width: rasterWidth, height: rasterHeight },
          draggable: true,
          deletable: true,
          data: {
            kind: 'vector',
            name: `${raster.data.name} vector`,
            sourceName: raster.data.name,
            viewBox: result.viewBox,
            paths: result.paths,
            opacity: 1,
            locked: false,
          },
          selected: true,
        };
        recordHistory();
        setNodes((current) => [
          ...current.map((node) => ({
            ...node,
            selected: false,
            data:
              node.id === id
                ? { ...node.data, opacity: expandLayers ? 0.32 : node.data.opacity }
                : node.data,
          })),
          vectorNode,
        ]);
        if (expandLayers) {
          setExpandedVectors((current) => new Set(current).add(vectorNode.id));
          setSelectedPath({ nodeId: vectorNode.id, pathId: result.paths[0].id });
        }
        window.setTimeout(() => fitView({ nodes: [{ id }, { id: vectorNode.id }], duration: 360, padding: 0.22 }), 60);
        announce(`Created ${result.paths.length} editable vector layers.`, 'success');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          announce('Vectorization cancelled.');
        } else {
          announce(error instanceof Error ? error.message : 'Vectorization failed.', 'error');
        }
      } finally {
        conversionControllerRef.current = null;
        setConvertingId(null);
      }
    },
    [announce, conversionOptions, convertingId, fitView, recordHistory],
  );

  const cancelVectorization = useCallback(() => {
    conversionControllerRef.current?.abort();
  }, []);

  const addConceptAt = useCallback((screenPoint: { x: number; y: number }, editAfterCreate = false) => {
    const center = screenToFlowPosition(screenPoint);
    const id = crypto.randomUUID();
    recordHistory();
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      {
        id,
        type: 'concept',
        position: { x: center.x - 94, y: center.y - 39 },
        style: { width: CONCEPT_DEFAULT_WIDTH, height: CONCEPT_MIN_HEIGHT },
        draggable: true,
        deletable: true,
        data: {
          kind: 'concept',
          name: 'New concept',
          label: 'New concept',
          title: conceptTitleFromPlainText('New concept'),
          body: emptyRichText(),
          eyebrow: 'Concept',
          tone: 'ink',
          collapsed: false,
          horizontalAlign: 'left',
          verticalAlign: 'top',
          opacity: 1,
          locked: false,
        },
        selected: true,
      },
    ]);
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    setSelectedPath(null);
    layerSelectionAnchorRef.current = id;
    if (editAfterCreate) {
      window.requestAnimationFrame(() => setEditingConceptId(id));
    }
  }, [recordHistory, screenToFlowPosition]);

  const addConceptNode = useCallback(() => {
    addConceptAt({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  }, [addConceptAt]);

  const addTableNode = useCallback(() => {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const id = crypto.randomUUID();
    const data = createTableData();
    const dimensions = tableDimensions(data);
    recordHistory();
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      {
        id,
        type: 'table',
        position: { x: center.x - dimensions.width / 2, y: center.y - dimensions.height / 2 },
        style: dimensions,
        draggable: true,
        deletable: true,
        selected: true,
        data,
      },
    ]);
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    setSelectedPath(null);
    setTableInteraction({ mode: 'table', nodeId: id });
    layerSelectionAnchorRef.current = id;
    announce('Table added. Press Enter to edit the selected cell.', 'success');
  }, [announce, recordHistory, screenToFlowPosition]);

  const addConceptFromTemplate = useCallback(() => {
    if (conceptTemplate === 'table') {
      addTableNode();
      return;
    }
    const template = CONCEPT_TEMPLATES[conceptTemplate];
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const id = crypto.randomUUID();
    recordHistory();
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), {
      id,
      type: 'concept',
      position: { x: center.x - 110, y: center.y - 56 },
      style: { width: CONCEPT_DEFAULT_WIDTH, height: CONCEPT_MIN_HEIGHT },
      draggable: true,
      deletable: true,
      selected: true,
      data: {
        kind: 'concept',
        name: template.name,
        label: template.name,
        title: conceptTitleFromPlainText(template.name),
        body: structuredClone(template.body),
        eyebrow: template.eyebrow,
        tone: template.tone,
        collapsed: false,
        horizontalAlign: 'left',
        verticalAlign: 'top',
        opacity: 1,
        locked: false,
      },
    }]);
    announce(`${template.eyebrow} template added.`, 'success');
  }, [addTableNode, announce, conceptTemplate, recordHistory, screenToFlowPosition]);

  const selectedNodes = nodes.filter((node) => node.selected);
  const selectedNode = selectedNodes[0] ?? null;
  const selectedNodeId = selectedNode?.id ?? null;
  const selectedNodeCount = selectedNodes.length;
  const selectedUnlockedCount = selectedNodes.filter((node) => !node.data.locked).length;
  const selectedEdge = edges.find((edge) => edge.selected) ?? null;
  const selectedVectorPath = useMemo(() => {
    if (!selectedPath) return null;
    const node = nodes.find((item) => item.id === selectedPath.nodeId);
    if (!node || node.data.kind !== 'vector') return null;
    const path = node.data.paths.find((item) => item.id === selectedPath.pathId);
    return path ? { node, path } : null;
  }, [nodes, selectedPath]);

  const updateNode = useCallback(
    (id: string, updater: (node: EditorNode) => EditorNode, shouldRecord = true) => {
      if (shouldRecord) recordHistory();
      setNodes((current) => current.map((node) => (node.id === id ? updater(node) : node)));
    },
    [recordHistory],
  );

  const updateEdge = useCallback(
    (id: string, updater: (edge: EditorEdge) => EditorEdge, shouldRecord = true) => {
      if (shouldRecord) recordHistory();
      setEdges((current) => current.map((edge) => edge.id === id ? updater(edge) : edge));
    },
    [recordHistory],
  );

  const updateSelectedNodes = useCallback((updater: (node: EditorNode) => EditorNode) => {
    const selectedIds = new Set(nodesRef.current.filter((node) => node.selected && !node.data.locked).map((node) => node.id));
    if (!selectedIds.size) return;
    recordHistory();
    setNodes((current) => current.map((node) => selectedIds.has(node.id) ? updater(node) : node));
  }, [recordHistory]);

  const duplicateSelectedNodes = useCallback(() => {
    const selected = nodesRef.current.filter((node) => node.selected && !node.data.locked);
    if (!selected.length) return;
    const idMap = new Map(selected.map((node) => [node.id, crypto.randomUUID()]));
    const copies = selected.map((node): EditorNode => ({
      ...structuredClone(node),
      id: idMap.get(node.id)!,
      position: { x: node.position.x + 28, y: node.position.y + 28 },
      selected: true,
      draggable: true,
      deletable: true,
      data: node.data.kind === 'table'
        ? cloneTableData(node.data)
        : {
            ...structuredClone(node.data),
            name: `${node.data.name} copy`,
            locked: false,
          },
    }));
    const copiedEdges = edgesRef.current
      .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
      .map((edge): EditorEdge => ({
        ...structuredClone(edge),
        id: crypto.randomUUID(),
        source: idMap.get(edge.source)!,
        target: idMap.get(edge.target)!,
        selected: false,
      }));
    recordHistory();
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      ...copies,
    ]);
    setEdges((current) => [
      ...current.map((edge) => edge.selected ? { ...edge, selected: false } : edge),
      ...copiedEdges,
    ]);
    layerSelectionAnchorRef.current = copies[0]?.id ?? null;
    announce(`${copies.length} ${copies.length === 1 ? 'layer' : 'layers'} duplicated.`, 'success');
  }, [announce, recordHistory]);

  const convertSelectedNodesToTable = useCallback(() => {
    const selected = nodesRef.current.filter((node) => node.selected && !node.data.locked);
    if (!selected.length) return;
    try {
      const id = crypto.randomUUID();
      const readingOrder = [...selected].sort((leftNode, rightNode) => (
        leftNode.position.y - rightNode.position.y || leftNode.position.x - rightNode.position.x
      ));
      const data = tableFromNodes(readingOrder);
      const dimensions = tableDimensions(data);
      const left = Math.min(...selected.map((node) => node.position.x));
      const top = Math.min(...selected.map((node) => node.position.y));
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
      recordHistory();
      setNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        tableNode,
      ]);
      setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
      setTableInteraction({ mode: 'table', nodeId: id });
      layerSelectionAnchorRef.current = id;
      announce(`Organized ${selected.length} ${selected.length === 1 ? 'layer' : 'layers'} into table rows. Originals were kept.`, 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The selected layers could not be organized.', 'error');
    }
  }, [announce, recordHistory]);

  const setSelectedNodesLocked = useCallback((locked: boolean) => {
    const selectedIds = new Set(nodesRef.current.filter((node) => node.selected && node.data.locked !== locked).map((node) => node.id));
    if (!selectedIds.size) return;
    recordHistory();
    setNodes((current) => current.map((node) => selectedIds.has(node.id) ? {
      ...node,
      draggable: !locked,
      deletable: !locked,
      data: { ...node.data, locked },
    } : node));
  }, [recordHistory]);

  const alignSelectedNodes = useCallback((mode: 'left' | 'top' | 'horizontal' | 'vertical') => {
    const selected = nodesRef.current.filter((node) => node.selected && !node.data.locked);
    if (selected.length < 2) return;
    if ((mode === 'horizontal' || mode === 'vertical') && selected.length < 3) return;
    recordHistory();
    if (mode === 'left' || mode === 'top') {
      const target = mode === 'left'
        ? Math.min(...selected.map((node) => node.position.x))
        : Math.min(...selected.map((node) => node.position.y));
      const ids = new Set(selected.map((node) => node.id));
      setNodes((current) => current.map((node) => ids.has(node.id)
        ? { ...node, position: { ...node.position, [mode === 'left' ? 'x' : 'y']: target } }
        : node));
      return;
    }
    const axis = mode === 'horizontal' ? 'x' : 'y';
    const sorted = [...selected].sort((a, b) => a.position[axis] - b.position[axis]);
    const start = sorted[0].position[axis];
    const end = sorted.at(-1)!.position[axis];
    const positions = new Map(sorted.map((node, index) => [node.id, start + ((end - start) * index) / (sorted.length - 1)]));
    setNodes((current) => current.map((node) => positions.has(node.id)
      ? { ...node, position: { ...node.position, [axis]: positions.get(node.id)! } }
      : node));
  }, [recordHistory]);

  const deleteSelectedNodes = useCallback(() => {
    const ids = new Set(nodesRef.current.filter((node) => node.selected && !node.data.locked).map((node) => node.id));
    if (!ids.size) return;
    recordHistory();
    const next = removeNodesAndConnections(nodesRef.current, edgesRef.current, ids);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [recordHistory]);

  const tidyDiagram = useCallback(() => {
    const positions = tidyGraphPositions(nodesRef.current, edgesRef.current);
    if (positions.size < 2) return;
    recordHistory();
    setNodes((current) => current.map((node) => node.data.locked || !positions.has(node.id)
      ? node
      : { ...node, position: positions.get(node.id)! }));
    window.setTimeout(() => fitView({ duration: 320, padding: 0.22 }), 0);
    announce('Diagram layout tidied.', 'success');
  }, [announce, fitView, recordHistory]);

  const beginConceptEdit = useCallback((id: string) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || node.data.kind !== 'concept' || node.data.locked) return;
    if (editingConceptId === id) return;
    if (conceptEditOriginRef.current) {
      recordHistory(conceptEditOriginRef.current);
    }
    conceptEditOriginRef.current = cloneSnapshot(nodesRef.current, edgesRef.current);
    setEditingConceptField('title');
    setNodes((current) => current.map((item) => item.id === id ? {
      ...item,
      style: {
        ...item.style,
        width: Math.max(CONCEPT_EDIT_MIN_WIDTH, Number(item.style?.width) || Number(item.measured?.width) || CONCEPT_DEFAULT_WIDTH),
        height: Math.max(CONCEPT_EDIT_MIN_HEIGHT, Number(item.style?.height) || Number(item.measured?.height) || CONCEPT_MIN_HEIGHT),
      },
    } : item));
    setEditingConceptId(id);
    selectNode(id);
  }, [editingConceptId, recordHistory, selectNode]);

  const addConceptRelative = useCallback((id: string, relation: 'child' | 'sibling') => {
    const source = nodesRef.current.find((node) => node.id === id);
    if (!source || source.data.locked) return;
    const newId = crypto.randomUUID();
    const layout = relativeConceptLayout(nodesRef.current, edgesRef.current, id, relation, newId);
    const position = layout.positions.get(newId);
    if (!position) return;
    const nextNode: EditorNode = {
      id: newId,
      type: 'concept',
      position,
      style: { width: CONCEPT_DEFAULT_WIDTH, height: CONCEPT_MIN_HEIGHT },
      draggable: true,
      deletable: true,
      selected: true,
      data: {
        kind: 'concept',
        name: 'New concept',
        label: 'New concept',
        title: conceptTitleFromPlainText('New concept'),
        body: emptyRichText(),
        eyebrow: relation === 'child' ? 'Child idea' : 'Related idea',
        tone: 'ink',
        collapsed: false,
        horizontalAlign: 'left',
        verticalAlign: 'top',
        opacity: 1,
        locked: false,
      },
    };
    recordHistory();
    setNodes((current) => [
      ...current.map((node) => ({
        ...node,
        position: layout.positions.get(node.id) ?? node.position,
        selected: false,
      })),
      nextNode,
    ]);
    if (layout.parentId) {
      const parentId = layout.parentId;
      setEdges((current) => [...current, {
        id: crypto.randomUUID(),
        source: parentId,
        target: newId,
        ...(layout.direction === 'vertical'
          ? { sourceHandle: 'bottom', targetHandle: 'top' }
          : {}),
        type: 'smoothstep',
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#a9adb7', strokeWidth: 1.5 },
        data: { label: '', kind: 'default' },
      }]);
    }
    window.setTimeout(() => {
      fitView({ nodes: [{ id: newId }], duration: 220, padding: 0.65, maxZoom: 1.4 });
      beginConceptEdit(newId);
    }, 60);
  }, [beginConceptEdit, fitView, recordHistory]);

  const updateConceptTitle = useCallback((id: string, title: RichTextDocument) => {
    const label = richTextToPlainText(title).slice(0, 500);
    setNodes((current) => current.map((node) => node.id === id && node.data.kind === 'concept'
      ? {
          ...node,
          data: {
            ...node.data,
            name: node.data.name === node.data.label ? label : node.data.name,
            label,
            title,
          },
        }
      : node));
  }, []);

  const updateConceptBody = useCallback((id: string, body: RichTextDocument) => {
    setNodes((current) => current.map((node) => node.id === id && node.data.kind === 'concept'
      ? { ...node, data: { ...node.data, body } }
      : node));
  }, []);

  const commitConceptEdit = useCallback(() => {
    const id = editingConceptId;
    const origin = conceptEditOriginRef.current;
    if (id) {
      const originNode = origin?.nodes.find((node) => node.id === id);
      const currentNode = nodesRef.current.find((node) => node.id === id);
      const normalizedNode = currentNode?.data.kind === 'concept'
        ? {
            ...currentNode,
            data: {
              ...currentNode.data,
              body: normalizeRichTextDocument(currentNode.data.body),
            },
          }
        : currentNode;
      if (origin && originNode && normalizedNode && JSON.stringify(originNode.data) !== JSON.stringify(normalizedNode.data)) {
        recordHistory(origin);
      }
      setNodes((current) => current.map((node) => {
        if (node.id !== id || node.data.kind !== 'concept') return node;
        const normalized = {
          ...node,
          data: { ...node.data, body: normalizeRichTextDocument(node.data.body) },
        };
        return originNode ? restoreNodeGeometry(normalized, originNode) : normalized;
      }));
    }
    conceptEditOriginRef.current = null;
    setEditingConceptId(null);
  }, [editingConceptId, recordHistory]);

  const cancelConceptEdit = useCallback(() => {
    const id = editingConceptId;
    const origin = conceptEditOriginRef.current;
    if (origin) {
      setNodes(origin.nodes);
      setEdges(origin.edges);
      conceptEditOriginRef.current = null;
    }
    setEditingConceptId(null);
    if (id) {
      window.setTimeout(() => {
        const node = [...document.querySelectorAll<HTMLElement>('.react-flow__node')]
          .find((element) => element.dataset.id === id);
        node?.focus();
      }, 0);
    }
  }, [editingConceptId]);

  const beginFieldEdit = useCallback(() => {
    if (!fieldOriginRef.current) {
      fieldOriginRef.current = cloneSnapshot(nodesRef.current, edgesRef.current);
    }
  }, []);

  const endFieldEdit = useCallback(() => {
    if (!fieldOriginRef.current) return;
    recordHistory(fieldOriginRef.current);
    fieldOriginRef.current = null;
  }, [recordHistory]);

  const cancelFieldEdit = useCallback(() => {
    const id = renamingLayerId;
    if (fieldOriginRef.current) {
      setNodes(fieldOriginRef.current.nodes);
      setEdges(fieldOriginRef.current.edges);
      fieldOriginRef.current = null;
    }
    setRenamingLayerId(null);
    if (id) {
      window.setTimeout(() => {
        const layer = [...document.querySelectorAll<HTMLElement>('[data-layer-id]')]
          .find((element) => element.dataset.layerId === id);
        layer?.focus();
      }, 0);
    }
  }, [renamingLayerId]);

  useEffect(() => {
    const beginFromKeyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, button, [contenteditable="true"]')) return;
      if (!target?.closest('.react-flow__node')) return;
      const selected = nodesRef.current.find((node) => node.selected);
      if (!selected || selected.data.locked) return;
      const supportsBranchCreation = selected.data.kind === 'concept' || selected.data.kind === 'raster';
      if (supportsBranchCreation && event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        addConceptRelative(selected.id, 'child');
        return;
      }
      if (supportsBranchCreation && event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        addConceptRelative(selected.id, 'sibling');
        return;
      }
      if (selected.data.kind !== 'concept' || event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      beginConceptEdit(selected.id);
    };
    window.addEventListener('keydown', beginFromKeyboard, true);
    return () => window.removeEventListener('keydown', beginFromKeyboard, true);
  }, [addConceptRelative, beginConceptEdit]);

  const updateSelectedPath = useCallback(
    (updater: (path: VectorPathLayer) => VectorPathLayer, shouldRecord = true) => {
      if (!selectedPath) return;
      if (shouldRecord) recordHistory();
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== selectedPath.nodeId || node.data.kind !== 'vector') return node;
          return {
            ...node,
            data: {
              ...node.data,
              paths: node.data.paths.map((path) =>
                path.id === selectedPath.pathId ? updater(path) : path,
              ),
            },
          };
        }),
      );
    },
    [recordHistory, selectedPath],
  );

  const updatePathById = useCallback((nodeId: string, pathId: string, updater: (path: VectorPathLayer) => VectorPathLayer) => {
    updateNode(nodeId, (node) => {
      if (node.data.kind !== 'vector') return node;
      return {
        ...node,
        data: {
          ...node.data,
          paths: node.data.paths.map((path) => path.id === pathId ? updater(path) : path),
        },
      };
    });
  }, [updateNode]);

  const moveSelectedPath = useCallback((direction: -1 | 1) => {
    if (!selectedPath) return;
    recordHistory();
    setNodes((current) => current.map((node) => {
      if (node.id !== selectedPath.nodeId || node.data.kind !== 'vector') return node;
      const index = node.data.paths.findIndex((path) => path.id === selectedPath.pathId);
      const nextIndex = Math.max(0, Math.min(node.data.paths.length - 1, index + direction));
      if (index < 0 || index === nextIndex || node.data.paths[index].locked) return node;
      const paths = [...node.data.paths];
      const [path] = paths.splice(index, 1);
      paths.splice(nextIndex, 0, path);
      return { ...node, data: { ...node.data, paths } };
    }));
  }, [recordHistory, selectedPath]);

  const duplicateSelectedPath = useCallback(() => {
    if (!selectedPath) return;
    const selectedNode = nodesRef.current.find((node) => node.id === selectedPath.nodeId);
    const selected = selectedNode?.data.kind === 'vector'
      ? selectedNode.data.paths.find((path) => path.id === selectedPath.pathId)
      : null;
    if (!selected || selected.locked) return;
    const newPathId = crypto.randomUUID();
    recordHistory();
    setNodes((current) => current.map((node) => {
      if (node.id !== selectedPath.nodeId || node.data.kind !== 'vector') return node;
      const index = node.data.paths.findIndex((path) => path.id === selectedPath.pathId);
      const original = node.data.paths[index];
      if (!original || original.locked) return node;
      const copy = { ...structuredClone(original), id: newPathId, name: `${original.name} copy`, locked: false };
      const paths = [...node.data.paths];
      paths.splice(index + 1, 0, copy);
      return { ...node, data: { ...node.data, paths } };
    }));
    setSelectedPath({ nodeId: selectedPath.nodeId, pathId: newPathId });
  }, [recordHistory, selectedPath]);

  const deleteSelectedPath = useCallback(() => {
    if (!selectedPath) return;
    const node = nodesRef.current.find((item) => item.id === selectedPath.nodeId);
    if (!node || node.data.kind !== 'vector') return;
    const index = node.data.paths.findIndex((path) => path.id === selectedPath.pathId);
    if (index < 0 || node.data.paths[index].locked) return;
    recordHistory();
    const remaining = node.data.paths.filter((path) => path.id !== selectedPath.pathId);
    setNodes((current) => current.map((item) => item.id === node.id && item.data.kind === 'vector'
      ? { ...item, data: { ...item.data, paths: remaining } }
      : item));
    const next = remaining[Math.min(index, remaining.length - 1)];
    setSelectedPath(next ? { nodeId: node.id, pathId: next.id } : null);
  }, [recordHistory, selectedPath]);

  const toggleNodeVisibility = useCallback((id: string) => {
    updateNode(id, (node) => ({ ...node, hidden: !node.hidden }));
  }, [updateNode]);

  const toggleNodeLock = useCallback((id: string) => {
    updateNode(id, (node) => ({
      ...node,
      draggable: node.data.locked,
      deletable: node.data.locked,
      data: { ...node.data, locked: !node.data.locked },
    }));
  }, [updateNode]);

  const duplicateSelected = () => {
    const selected = nodesRef.current.find((node) => node.id === selectedNodeId);
    if (!selected) return;
    const copy: EditorNode = {
      ...structuredClone(selected),
      id: crypto.randomUUID(),
      position: { x: selected.position.x + 28, y: selected.position.y + 28 },
      selected: true,
      draggable: true,
      deletable: true,
      data: selected.data.kind === 'table'
        ? cloneTableData(selected.data)
        : {
            ...structuredClone(selected.data),
            name: `${selected.data.name} copy`,
            locked: false,
          },
    };
    recordHistory();
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      copy,
    ]);
  };

  const deleteSelected = () => {
    const selected = nodesRef.current.find((node) => node.id === selectedNodeId);
    if (!selected || selected.data.locked) return;
    recordHistory();
    setNodes((current) => current.filter((node) => node.id !== selected.id));
    setEdges((current) =>
      current.filter((edge) => edge.source !== selected.id && edge.target !== selected.id),
    );
    setSelectedPath(null);
  };

  const moveLayer = useCallback((id: string, direction: -1 | 1) => {
    recordHistory();
    setNodes((current) => {
      const index = current.findIndex((node) => node.id === id);
      const nextIndex = Math.max(0, Math.min(current.length - 1, index + direction));
      if (index < 0 || index === nextIndex) return current;
      const copy = [...current];
      const [node] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, node);
      return copy;
    });
  }, [recordHistory]);

  const resetDocument = useCallback(async () => {
    if (!window.confirm('Start a new local document? This clears the current canvas on this device.')) return;
    try {
      conversionControllerRef.current?.abort();
      await clearLocalDocument();
      pastRef.current = [];
      futureRef.current = [];
      setNodes(structuredClone(initialDocument.nodes));
      setEdges(structuredClone(initialDocument.edges));
      setTitle(initialDocument.title);
      setSelectedPath(null);
      refreshHistoryState();
      announce('New local document created.', 'success');
    } catch {
      announce('The local project could not be cleared. Download a backup before trying again.', 'error');
    }
  }, [announce, refreshHistoryState]);

  const openExport = useCallback(() => {
    const selected = nodesRef.current.filter((node) => node.selected && !node.hidden);
    const activeTable = tableInteraction
      ? nodesRef.current.find((node) => node.id === tableInteraction.nodeId && node.data.kind === 'table')
      : null;
    const activeCells = activeTable?.data.kind === 'table'
      ? tableInteractionCells(activeTable.data, tableInteraction)
      : [];
    if (activeTable && activeCells.length) {
      setExportScope('table-cells');
      setExportFormat('csv');
    } else if (selected.length) {
      setExportScope('selection');
      setExportFormat('png');
    } else {
      setExportScope('canvas');
      setExportFormat('png');
    }
    setExportBackground('white');
    setExportOpen(true);
  }, [tableInteraction]);
  const refreshStorageHealth = useCallback(async () => {
    setStorageHealthBusy(true);
    try {
      setStorageHealth(await inspectStorageHealth());
    } catch {
      setStorageHealth({ supported: false, usage: null, quota: null, persisted: null });
    } finally {
      setStorageHealthBusy(false);
    }
  }, []);
  const openBackup = useCallback(() => {
    setBackupOpen(true);
    void refreshStorageHealth();
  }, [refreshStorageHealth]);
  const protectLocalStorage = useCallback(async () => {
    setStorageHealthBusy(true);
    try {
      const persisted = await requestPersistentStorage();
      announce(
        persisted === true
          ? 'The browser granted persistent local storage.'
          : persisted === false
            ? 'The browser did not grant persistent storage. Keep downloading backups.'
            : 'Persistent storage is not available in this browser.',
        persisted === true ? 'success' : 'info',
      );
    } catch {
      announce('The browser could not update local storage protection.', 'error');
    } finally {
      await refreshStorageHealth();
    }
  }, [announce, refreshStorageHealth]);
  const performBackup = useCallback(() => {
    try {
      downloadProjectBackup(
        serializeProjectBackup(getCurrentDocument()),
        safeFileBase(titleRef.current),
      );
      announce('Project backup downloaded.', 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Project backup failed.', 'error');
    }
  }, [announce, getCurrentDocument]);

  const createCheckpoint = useCallback(async () => {
    try {
      await createLocalCheckpoint(getCurrentDocument());
      setCheckpoints(await listLocalCheckpoints());
      announce('Local checkpoint created.', 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The checkpoint could not be created.', 'error');
    } finally {
      void refreshStorageHealth();
    }
  }, [announce, getCurrentDocument, refreshStorageHealth]);

  const restoreCheckpoint = useCallback(async (checkpoint: LocalCheckpoint) => {
    if (!window.confirm(`Restore “${checkpoint.title}” from ${new Date(checkpoint.createdAt).toLocaleString()}?`)) return;
    recordHistory();
    const restored = structuredClone(checkpoint.document);
    setNodes(restored.nodes);
    setEdges(restored.edges);
    setTitle(restored.title);
    setSelectedPath(null);
    await queueDocumentSave(restored);
    setBackupOpen(false);
    window.setTimeout(() => fitView({ duration: 300, padding: 0.22 }), 0);
    announce('Checkpoint restored.', 'success');
  }, [announce, fitView, queueDocumentSave, recordHistory]);

  const removeCheckpoint = useCallback(async (id: string) => {
    try {
      await deleteLocalCheckpoint(id);
      setCheckpoints((current) => current.filter((checkpoint) => checkpoint.id !== id));
      announce('Checkpoint deleted.');
      void refreshStorageHealth();
    } catch {
      announce('The checkpoint could not be deleted.', 'error');
    }
  }, [announce, refreshStorageHealth]);

  const restoreProject = useCallback(async (file: File) => {
    try {
      if (file.size > MAX_PROJECT_FILE_SIZE) throw new Error('The project backup is larger than 40 MB.');
      const restored = parseProjectBackup(await file.text());
      if (!window.confirm(`Replace the current canvas with “${restored.title}”?`)) return;
      conversionControllerRef.current?.abort();
      pastRef.current = [];
      futureRef.current = [];
      setNodes(restored.nodes);
      setEdges(restored.edges);
      setTitle(restored.title);
      setSelectedPath(null);
      setExpandedVectors(new Set());
      refreshHistoryState();
      await queueDocumentSave(restored);
      setBackupOpen(false);
      window.setTimeout(() => fitView({ duration: 300, padding: 0.22 }), 60);
      announce('Project backup restored.', 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The project backup could not be restored.', 'error');
    }
  }, [announce, fitView, queueDocumentSave, refreshHistoryState]);

  const performExport = useCallback(async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const collapsed = collapsedDescendantIds(nodesRef.current, edgesRef.current);
      const exportNodes = nodesRef.current.map((node) => collapsed.has(node.id) ? { ...node, hidden: true } : node);
      const exportEdges = edgesRef.current.filter((edge) => !collapsed.has(edge.source) && !collapsed.has(edge.target));
      const activeTable = tableInteraction
        ? exportNodes.find((node) => node.id === tableInteraction.nodeId && node.data.kind === 'table')
        : null;
      const tableSelection = activeTable?.data.kind === 'table'
        ? { nodeId: activeTable.id, addresses: tableInteractionCells(activeTable.data, tableInteraction) }
        : null;
      const content = resolveExportContent(exportNodes, exportEdges, exportScope, tableSelection);
      const fileBase = safeFileBase(titleRef.current);

      if (exportFormat === 'csv') {
        if (!content.table) throw new Error('CSV export requires one table or a selected cell range.');
        downloadBlob(new Blob([tableToCsv(content.table)], { type: 'text/csv;charset=utf-8' }), fileBase, 'csv');
      } else {
        const background = exportFormat === 'pdf' ? 'white' : exportBackground;
        const visual = buildSvgExport(content.nodes, content.edges, { padding: exportPadding, background });
        if (exportFormat === 'svg') {
          downloadBlob(new Blob([visual.svg], { type: 'image/svg+xml;charset=utf-8' }), fileBase, 'svg');
        } else {
          const png = await svgToPngBlob(
            visual.svg,
            visual.width,
            visual.height,
            exportFormat === 'pdf' ? pdfQuality : exportScale,
          );
          if (exportFormat === 'png') {
            downloadBlob(png.blob, fileBase, 'png');
            if (png.dimensions.reduced) announce('PNG size was reduced to fit browser safety limits.');
          } else {
            const pdf = await pngToPdfBlob(png.blob, visual.width, visual.height, {
              pageSize: pdfPageSize,
              orientation: pdfOrientation,
              margin: pdfMargin,
            });
            downloadBlob(pdf, fileBase, 'pdf');
          }
        }
      }
      setExportOpen(false);
      announce(`${exportFormat.toUpperCase()} exported.`, 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Export failed.', 'error');
    } finally {
      setExportBusy(false);
    }
  }, [announce, exportBackground, exportBusy, exportFormat, exportPadding, exportScale, exportScope, pdfMargin, pdfOrientation, pdfPageSize, pdfQuality, tableInteraction]);

  const hasChildren = useCallback((id: string) => edgesRef.current.some((edge) => edge.source === id), []);

  const toggleBranch = useCallback((id: string) => {
    updateNode(id, (node) => node.data.kind === 'concept'
      ? { ...node, data: { ...node.data, collapsed: !node.data.collapsed } }
      : node);
  }, [updateNode]);

  const focusTableCell = useCallback((nodeId: string, address: TableCellAddress | null) => {
    if (!address) return;
    window.requestAnimationFrame(() => {
      const tableSelector = `.react-flow__node[data-id="${CSS.escape(nodeId)}"]`;
      if (document.querySelector(`${tableSelector} .table-cell-editor`)) return;
      const selector = `[data-table-node-id="${CSS.escape(nodeId)}"][data-table-row-id="${CSS.escape(address.rowId)}"][data-table-column-id="${CSS.escape(address.columnId)}"]`;
      document.querySelector<HTMLElement>(selector)?.focus();
    });
  }, []);

  const focusTableNode = useCallback((nodeId: string) => {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`)?.focus();
    });
  }, []);

  const selectWholeTable = useCallback((id: string) => {
    tableEditOriginRef.current = null;
    setTableInteraction({ mode: 'table', nodeId: id });
    const selected = nodesRef.current.filter((node) => node.selected);
    if (selected.length !== 1 || selected[0].id !== id) selectNode(id);
    focusTableNode(id);
  }, [focusTableNode, selectNode]);

  const selectTableCell = useCallback((id: string, address: TableCellAddress, extend = false) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || node.data.kind !== 'table' || node.data.locked || !tableCellAt(node.data, address)) return;
    setTableInteraction((current) => {
      const anchor = extend && current?.nodeId === id && current.mode === 'cell'
        ? current.anchor
        : address;
      return { mode: 'cell', nodeId: id, anchor, focus: address };
    });
    const selected = nodesRef.current.filter((item) => item.selected);
    if (selected.length !== 1 || selected[0].id !== id) selectNode(id);
    focusTableCell(id, address);
  }, [focusTableCell, selectNode]);

  const selectTableRow = useCallback((id: string, rowId: string, extend = false) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || node.data.kind !== 'table' || node.data.locked || !node.data.rows.some((row) => row.id === rowId)) return;
    const data = node.data;
    setTableInteraction((current) => {
      const anchor = extend && current?.nodeId === id && current.mode === 'row'
        ? current.rowIds[0]
        : rowId;
      return { mode: 'row', nodeId: id, rowIds: tableRowRange(data, anchor, rowId) };
    });
  }, []);

  const selectTableColumn = useCallback((id: string, columnId: string, extend = false) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || node.data.kind !== 'table' || node.data.locked || !node.data.columns.some((column) => column.id === columnId)) return;
    const data = node.data;
    setTableInteraction((current) => {
      const anchor = extend && current?.nodeId === id && current.mode === 'column'
        ? current.columnIds[0]
        : columnId;
      return { mode: 'column', nodeId: id, columnIds: tableColumnRange(data, anchor, columnId) };
    });
  }, []);

  const beginTableCellEdit = useCallback((
    id: string,
    address: TableCellAddress,
    replacement?: string,
  ) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || node.data.kind !== 'table' || node.data.locked || !tableCellAt(node.data, address)) return;
    if (!tableEditOriginRef.current) {
      tableEditOriginRef.current = cloneSnapshot(nodesRef.current, edgesRef.current);
    }
    if (replacement !== undefined) {
      const nextNodes = nodesRef.current.map((item) => item.id === id && item.data.kind === 'table'
        ? { ...item, data: updateTableCell(item.data, address, (cell) => replaceTableCellPlainText(cell, replacement)) }
        : item);
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
    }
    setTableInteraction({
      mode: 'editing',
      nodeId: id,
      cell: address,
      initialContent: replacement === undefined ? undefined : richTextFromPlainText(replacement.slice(0, 2_000)),
    });
    const selected = nodesRef.current.filter((item) => item.selected);
    if (selected.length !== 1 || selected[0].id !== id) selectNode(id);
  }, [selectNode]);

  const updateTableCellContent = useCallback((id: string, address: TableCellAddress, content: RichTextDocument) => {
    setNodes((current) => current.map((node) => node.id === id && node.data.kind === 'table'
      ? {
          ...node,
          data: updateTableCell(node.data, address, (cell) => ({
            ...cell,
            content: richTextToPlainText(content).length <= 2_000
              ? content
              : richTextFromPlainText(richTextToPlainText(content).slice(0, 2_000)),
          })),
        }
      : node));
  }, []);

  const commitTableCellEdit = useCallback(() => {
    const origin = tableEditOriginRef.current;
    const active = tableInteraction?.mode === 'editing' ? tableInteraction : null;
    let currentNodes = nodesRef.current;
    if (active) {
      const grownNodes = currentNodes.map((node) => {
        if (node.id !== active.nodeId || node.data.kind !== 'table') return node;
        const cell = tableCellAt(node.data, active.cell);
        if (!cell) return node;
        const data = growTableRowToContent(node.data, cell.rowIndex);
        return data === node.data
          ? node
          : { ...node, data, style: { ...node.style, ...tableDimensions(data) } };
      });
      if (grownNodes.some((node, index) => node !== currentNodes[index])) {
        currentNodes = grownNodes;
        nodesRef.current = currentNodes;
        setNodes(currentNodes);
      }
    }
    if (origin && active) {
      const before = origin.nodes.find((node) => node.id === active.nodeId);
      const after = currentNodes.find((node) => node.id === active.nodeId);
      if (before && after && JSON.stringify(before.data) !== JSON.stringify(after.data)) recordHistory(origin);
    }
    tableEditOriginRef.current = null;
    if (!active) return;
    const next: TableInteraction = { mode: 'cell', nodeId: active.nodeId, anchor: active.cell, focus: active.cell };
    setTableInteraction(next);
    focusTableCell(active.nodeId, active.cell);
  }, [focusTableCell, recordHistory, tableInteraction]);

  const removeSelectedTableStructure = useCallback((
    id: string,
    kind: 'row' | 'column',
    indexes: number[],
  ) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || node.data.kind !== 'table' || node.data.locked || !indexes.length) return;
    const before = node.data;
    const descending = [...new Set(indexes)].sort((left, right) => right - left);
    if (kind === 'row' && before.rows.length - descending.length < 1) return;
    if (kind === 'column' && before.columns.length - descending.length < 1) return;
    const after = descending.reduce(
      (data, index) => kind === 'row' ? removeTableRow(data, index) : removeTableColumn(data, index),
      before,
    );
    const previousFocus = tableInteraction?.nodeId === id
      ? tableInteractionFocus(before, tableInteraction)
      : firstTableCell(before);
    const nextFocus = nearestTableCellAfterStructureRemoval(before, after, previousFocus);
    recordHistory();
    const nextNodes = nodesRef.current.map((item) => item.id === id
      ? { ...item, data: after, style: { ...item.style, ...tableDimensions(after) } }
      : item);
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
    setTableInteraction({ mode: 'cell', nodeId: id, anchor: nextFocus, focus: nextFocus });
    focusTableCell(id, nextFocus);
    announce(`Deleted ${descending.length} table ${kind}${descending.length === 1 ? '' : 's'}.`);
  }, [announce, focusTableCell, recordHistory, tableInteraction]);

  const cancelTableCellEdit = useCallback(() => {
    const origin = tableEditOriginRef.current;
    const active = tableInteraction?.mode === 'editing' ? tableInteraction : null;
    if (origin) {
      nodesRef.current = origin.nodes;
      edgesRef.current = origin.edges;
      setNodes(origin.nodes);
      setEdges(origin.edges);
    }
    tableEditOriginRef.current = null;
    if (!active) return;
    const next: TableInteraction = { mode: 'cell', nodeId: active.nodeId, anchor: active.cell, focus: active.cell };
    setTableInteraction(next);
    focusTableCell(active.nodeId, active.cell);
  }, [focusTableCell, tableInteraction]);

  const clearSelectedTableCells = useCallback((id: string) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || node.data.kind !== 'table' || node.data.locked || tableInteraction?.nodeId !== id) return;
    const data = node.data;
    const addresses = tableInteractionCells(data, tableInteraction);
    if (!addresses.length || !addresses.some((address) => {
      const cell = tableCellAt(data, address)?.cell;
      return cell ? tableCellHasContent(cell) : false;
    })) return;
    recordHistory();
    setNodes((current) => current.map((item) => item.id === id && item.data.kind === 'table'
      ? { ...item, data: updateTableCells(item.data, addresses, (cell) => replaceTableCellPlainText(cell, '')) }
      : item));
    announce(`Cleared ${addresses.length} ${addresses.length === 1 ? 'cell' : 'cells'}.`);
  }, [announce, recordHistory, tableInteraction]);

  const copySelectedTableCells = useCallback((id: string, clipboardData: DataTransfer, cut: boolean) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || node.data.kind !== 'table' || node.data.locked || tableInteraction?.nodeId !== id) return;
    const data = node.data;
    const grid = tableInteractionGrid(data, tableInteraction);
    const addresses = tableInteractionCells(data, tableInteraction);
    if (!grid.length || !addresses.length) return;
    clipboardData.setData('text/plain', clipboardGridToText(grid));
    clipboardData.setData('text/html', clipboardGridToHtml(grid));
    if (cut && addresses.some((address) => {
      const cell = tableCellAt(data, address)?.cell;
      return cell ? tableCellHasContent(cell) : false;
    })) {
      recordHistory();
      setNodes((current) => current.map((item) => item.id === id && item.data.kind === 'table'
        ? { ...item, data: updateTableCells(item.data, addresses, (cell) => replaceTableCellPlainText(cell, '')) }
        : item));
    }
    const columns = Math.max(1, ...grid.map((row) => row.length));
    announce(`${cut ? 'Cut' : 'Copied'} ${grid.length} × ${columns} cells.`, 'success');
  }, [announce, recordHistory, tableInteraction]);

  const navigateTableCell = useCallback((
    id: string,
    address: TableCellAddress,
    direction: TableNavigationDirection,
    extend = false,
  ) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || node.data.kind !== 'table') return;
    let data = node.data;
    const current = tableCellAt(data, address);
    if (!current) return;
    let target: TableCellAddress | null;
    if (direction === 'next' || direction === 'previous') {
      target = sequentialTableCell(data, address, direction === 'next' ? 1 : -1);
    } else if (direction === 'row-start' || direction === 'row-end') {
      target = {
        rowId: current.row.id,
        columnId: data.columns[direction === 'row-start' ? 0 : data.columns.length - 1].id,
      };
    } else if (direction === 'table-start' || direction === 'table-end') {
      target = direction === 'table-start'
        ? firstTableCell(data)
        : { rowId: data.rows.at(-1)!.id, columnId: data.columns.at(-1)!.id };
    } else {
      target = adjacentTableCell(
        data,
        address,
        direction === 'up' ? -1 : direction === 'down' ? 1 : 0,
        direction === 'left' ? -1 : direction === 'right' ? 1 : 0,
      );
    }
    if (!target && direction === 'next') {
      try {
        recordHistory();
        data = insertTableRow(data, data.rows.length);
        const dimensions = tableDimensions(data);
        const nextRow = data.rows.at(-1)!;
        target = { rowId: nextRow.id, columnId: data.columns[0].id };
        setNodes((currentNodes) => currentNodes.map((item) => item.id === id
          ? { ...item, data, style: { ...item.style, ...dimensions } }
          : item));
        announce('Added a new table row.');
      } catch (error) {
        announce(error instanceof Error ? error.message : 'The row could not be added.', 'error');
        return;
      }
    }
    if (!target) target = address;
    const anchor = extend && tableInteraction?.nodeId === id && tableInteraction.mode === 'cell'
      ? tableInteraction.anchor
      : target;
    const next: TableInteraction = { mode: 'cell', nodeId: id, anchor, focus: target };
    setTableInteraction(next);
    focusTableCell(id, target);
  }, [announce, focusTableCell, recordHistory, tableInteraction]);

  const pasteIntoTable = useCallback((id: string, address: TableCellAddress, grid: ClipboardGrid) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || node.data.kind !== 'table' || node.data.locked) return;
    try {
      const start = tableInteraction?.nodeId === id
        ? tableInteractionTopLeft(node.data, tableInteraction) ?? address
        : address;
      const startCell = tableCellAt(node.data, start);
      if (!startCell) return;
      const data = pasteTableGrid(node.data, start, grid);
      const dimensions = tableDimensions(data);
      recordHistory(tableEditOriginRef.current ?? undefined);
      tableEditOriginRef.current = null;
      setNodes((current) => current.map((item) => item.id === id
        ? { ...item, data, style: { ...item.style, ...dimensions } }
        : item));
      const pastedColumns = Math.max(1, ...grid.map((row) => row.length));
      const focus = {
        rowId: data.rows[Math.min(data.rows.length - 1, startCell.rowIndex + grid.length - 1)].id,
        columnId: data.columns[Math.min(data.columns.length - 1, startCell.columnIndex + pastedColumns - 1)].id,
      };
      setTableInteraction({ mode: 'cell', nodeId: id, anchor: start, focus });
      announce(`Pasted ${grid.length} × ${pastedColumns} cells.`, 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The cells could not be pasted.', 'error');
    }
  }, [announce, recordHistory, tableInteraction]);

  const insertTableRowDirect = useCallback((id: string, index: number) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || node.data.kind !== 'table' || node.data.locked) return;
    try {
      const data = insertTableRow(node.data, index);
      const inserted = data.rows[Math.max(0, Math.min(index, data.rows.length - 1))];
      recordHistory();
      setNodes((current) => current.map((item) => item.id === id
        ? { ...item, data, style: { ...item.style, ...tableDimensions(data) } }
        : item));
      setTableInteraction({ mode: 'row', nodeId: id, rowIds: [inserted.id] });
      announce('Added a table row.');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The row could not be added.', 'error');
    }
  }, [announce, recordHistory]);

  const insertTableColumnDirect = useCallback((id: string, index: number) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || node.data.kind !== 'table' || node.data.locked) return;
    try {
      const data = insertTableColumn(node.data, index);
      const inserted = data.columns[Math.max(0, Math.min(index, data.columns.length - 1))];
      recordHistory();
      setNodes((current) => current.map((item) => item.id === id
        ? { ...item, data, style: { ...item.style, ...tableDimensions(data) } }
        : item));
      setTableInteraction({ mode: 'column', nodeId: id, columnIds: [inserted.id] });
      announce('Added a table column.');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The column could not be added.', 'error');
    }
  }, [announce, recordHistory]);

  const nodeActionValue = useMemo<NodeActionContextValue>(
    () => ({
      convertingId,
      editingConceptId,
      editingConceptField,
      setEditingConceptField,
      keepImage,
      vectorizeImage,
      cancelVectorization,
      beginConceptEdit,
      updateConceptTitle,
      updateConceptBody,
      commitConceptEdit,
      cancelConceptEdit,
      toggleBranch,
      hasChildren,
      addConceptRelative,
      recordResizeStart: () => {
        if (!resizeOriginRef.current) {
          resizeOriginRef.current = cloneSnapshot(nodesRef.current, edgesRef.current);
        }
      },
      recordResize: (id, dimensions) => {
        if (!resizeOriginRef.current) return;
        const resizedNodes = nodesRef.current.map((node) => node.id === id
          ? {
              ...node,
              position: { x: dimensions.x, y: dimensions.y },
              style: { ...node.style, width: dimensions.width, height: dimensions.height },
            }
          : node);
        nodesRef.current = resizedNodes;
        setNodes(resizedNodes);
      },
      recordResizeEnd: (id) => {
        const origin = resizeOriginRef.current;
        const originNode = origin?.nodes.find((node) => node.id === id);
        const currentNode = nodesRef.current.find((node) => node.id === id);
        const originSize = originNode ? editorNodeDimensions(originNode) : null;
        const currentSize = currentNode ? editorNodeDimensions(currentNode) : null;
        const changed = Boolean(originNode && originSize && currentNode && currentSize && (
          Math.abs(originSize.width - currentSize.width) >= 0.01
          || Math.abs(originSize.height - currentSize.height) >= 0.01
          || Math.abs(originNode.position.x - currentNode.position.x) >= 0.01
          || Math.abs(originNode.position.y - currentNode.position.y) >= 0.01
        ));
        if (origin && changed) recordHistory(origin);
        resizeOriginRef.current = null;
      },
    }),
    [
      beginConceptEdit,
      addConceptRelative,
      cancelConceptEdit,
      cancelVectorization,
      commitConceptEdit,
      convertingId,
      editingConceptField,
      editingConceptId,
      hasChildren,
      keepImage,
      recordHistory,
      toggleBranch,
      updateConceptBody,
      updateConceptTitle,
      vectorizeImage,
    ],
  );

  const tableNodeActionValue = useMemo(
    () => ({
      interaction: tableInteraction,
      selectedNodeCount,
      selectTable: selectWholeTable,
      selectCell: selectTableCell,
      selectRow: selectTableRow,
      selectColumn: selectTableColumn,
      beginCellEdit: beginTableCellEdit,
      updateCellContent: updateTableCellContent,
      commitCellEdit: commitTableCellEdit,
      cancelCellEdit: cancelTableCellEdit,
      clearCells: clearSelectedTableCells,
      copyCells: copySelectedTableCells,
      navigateCell: navigateTableCell,
      pasteGrid: pasteIntoTable,
      insertRow: insertTableRowDirect,
      insertColumn: insertTableColumnDirect,
      recordResizeStart: () => {
        if (!resizeOriginRef.current) {
          resizeOriginRef.current = cloneSnapshot(nodesRef.current, edgesRef.current);
        }
      },
      recordResize: (id: string, dimensions: ResizeParams) => {
        if (!resizeOriginRef.current) return;
        const resizedNodes = nodesRef.current.map((node) => {
          if (node.id !== id || node.data.kind !== 'table') return node;
          const data = scaleTable(node.data, dimensions.width, dimensions.height);
          const size = tableDimensions(data);
          return {
            ...node,
            position: { x: dimensions.x, y: dimensions.y },
            data,
            style: { ...node.style, ...size },
          };
        });
        nodesRef.current = resizedNodes;
        setNodes(resizedNodes);
      },
      resizeColumn: (id: string, columnIndex: number, width: number) => {
        if (!resizeOriginRef.current) return;
        const resizedNodes = nodesRef.current.map((node) => {
          if (node.id !== id || node.data.kind !== 'table') return node;
          const data = resizeTableColumn(node.data, columnIndex, width);
          return { ...node, data, style: { ...node.style, ...tableDimensions(data) } };
        });
        nodesRef.current = resizedNodes;
        setNodes(resizedNodes);
      },
      resizeRow: (id: string, rowIndex: number, height: number) => {
        if (!resizeOriginRef.current) return;
        const resizedNodes = nodesRef.current.map((node) => {
          if (node.id !== id || node.data.kind !== 'table') return node;
          const data = resizeTableRow(node.data, rowIndex, height);
          return { ...node, data, style: { ...node.style, ...tableDimensions(data) } };
        });
        nodesRef.current = resizedNodes;
        setNodes(resizedNodes);
      },
      cancelResize: () => {
        const origin = resizeOriginRef.current;
        if (!origin) return;
        nodesRef.current = origin.nodes;
        edgesRef.current = origin.edges;
        setNodes(origin.nodes);
        setEdges(origin.edges);
        resizeOriginRef.current = null;
      },
      recordResizeEnd: (id: string) => {
        const origin = resizeOriginRef.current;
        const originNode = origin?.nodes.find((node) => node.id === id);
        const currentNode = nodesRef.current.find((node) => node.id === id);
        const changed = Boolean(originNode && currentNode && (
          JSON.stringify(originNode.data) !== JSON.stringify(currentNode.data)
          || originNode.position.x !== currentNode.position.x
          || originNode.position.y !== currentNode.position.y
        ));
        if (origin && changed) recordHistory(origin);
        resizeOriginRef.current = null;
      },
    }),
    [
      beginTableCellEdit,
      cancelTableCellEdit,
      clearSelectedTableCells,
      commitTableCellEdit,
      copySelectedTableCells,
      insertTableColumnDirect,
      insertTableRowDirect,
      navigateTableCell,
      pasteIntoTable,
      recordHistory,
      selectedNodeCount,
      selectTableColumn,
      selectTableCell,
      selectTableRow,
      selectWholeTable,
      tableInteraction,
      updateTableCellContent,
    ],
  );

  useEffect(() => {
    const beginTableFromKeyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.key !== 'Enter') return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, button, [contenteditable="true"], [data-table-node-id]')) return;
      if (!target?.closest('.react-flow__node')) return;
      const selected = nodesRef.current.find((node) => node.selected && node.data.kind === 'table');
      if (!selected || selected.data.kind !== 'table' || selected.data.locked) return;
      event.preventDefault();
      event.stopPropagation();
      const address = tableInteraction?.nodeId === selected.id
        ? tableInteractionFocus(selected.data, tableInteraction) ?? firstTableCell(selected.data)
        : firstTableCell(selected.data);
      setTableInteraction({ mode: 'cell', nodeId: selected.id, anchor: address, focus: address });
      focusTableCell(selected.id, address);
    };
    window.addEventListener('keydown', beginTableFromKeyboard, true);
    return () => window.removeEventListener('keydown', beginTableFromKeyboard, true);
  }, [focusTableCell, tableInteraction]);

  useEffect(() => {
    const stepOutOfTable = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape' || !tableInteraction || tableInteraction.mode === 'editing') return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      if (tableInteraction.mode !== 'table') {
        setTableInteraction({ mode: 'table', nodeId: tableInteraction.nodeId });
        focusTableNode(tableInteraction.nodeId);
        return;
      }
      setTableInteraction(null);
      setNodes((current) => current.map((node) => node.selected ? { ...node, selected: false } : node));
      setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
      (document.activeElement as HTMLElement | null)?.blur();
    };
    window.addEventListener('keydown', stepOutOfTable, true);
    return () => window.removeEventListener('keydown', stepOutOfTable, true);
  }, [focusTableNode, tableInteraction]);

  useEffect(() => {
    if (!tableInteraction) return;
    const selected = nodes.filter((item) => item.selected);
    const node = nodes.find((item) => item.id === tableInteraction.nodeId);
    if (!node || node.data.kind !== 'table' || selected.length !== 1 || selected[0].id !== node.id) {
      tableEditOriginRef.current = null;
      const frame = window.requestAnimationFrame(() => setTableInteraction(null));
      return () => window.cancelAnimationFrame(frame);
    }
    const data = node.data;
    const next = normalizeTableInteraction(data, tableInteraction);
    if (next === tableInteraction) return;
    const frame = window.requestAnimationFrame(() => {
      setTableInteraction(next);
      focusTableCell(node.id, tableInteractionFocus(data, next));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusTableCell, nodes, tableInteraction]);

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const layerNodes = [...nodes].reverse().filter((node) => {
    if (!normalizedSearch) return true;
    const searchable = [
      node.data.name,
      node.data.kind === 'concept' ? node.data.label : '',
      node.data.kind === 'concept' ? node.data.eyebrow : '',
      node.data.kind === 'concept' ? richTextToPlainText(node.data.body) : '',
      node.data.kind === 'table' ? tableSearchText(node.data) : '',
    ].join(' ').toLocaleLowerCase();
    return searchable.includes(normalizedSearch);
  });
  const handleLayerSelection = useCallback((event: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    const anchorId = layerSelectionAnchorRef.current;
    if (event.shiftKey && anchorId) {
      const anchorIndex = layerNodes.findIndex((node) => node.id === anchorId);
      const targetIndex = layerNodes.findIndex((node) => node.id === id);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        const rangeIds = new Set(layerNodes.slice(start, end + 1).map((node) => node.id));
        setNodes((current) => current.map((node) => ({ ...node, selected: rangeIds.has(node.id) })));
        setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
        setSelectedPath(null);
        return;
      }
    }

    if (event.metaKey || event.ctrlKey) {
      if (!anchorId) layerSelectionAnchorRef.current = id;
      selectNode(id, true);
      return;
    }

    layerSelectionAnchorRef.current = id;
    revealAndSelectNode(id);
  }, [layerNodes, revealAndSelectNode, selectNode]);
  const collapsedNodeIds = useMemo(() => collapsedDescendantIds(nodes, edges), [edges, nodes]);
  const canvasNodes = useMemo(
    () => nodes.map((node) => {
      if (node.data.kind !== 'concept') {
        return {
          ...node,
          hidden: Boolean(node.hidden || collapsedNodeIds.has(node.id)),
        };
      }
      const minimumHeight = Number(node.style?.height) || CONCEPT_MIN_HEIGHT;
      const style = {
        ...node.style,
        height: node.resizing ? minimumHeight : undefined,
        minHeight: minimumHeight,
        '--concept-min-block-size': `${minimumHeight}px`,
      } as CSSProperties;
      return {
        ...node,
        style,
        hidden: Boolean(node.hidden || collapsedNodeIds.has(node.id)),
      };
    }),
    [collapsedNodeIds, nodes],
  );
  const canvasEdges = useMemo(
    () => {
      const nodeNames = new Map(nodes.map((node) => [node.id, node.data.name]));
      return edges
        .filter((edge) => !collapsedNodeIds.has(edge.source) && !collapsedNodeIds.has(edge.target))
        .map((edge) => ({
          ...edge,
          ariaLabel: `Connector from ${nodeNames.get(edge.source) ?? edge.source} to ${nodeNames.get(edge.target) ?? edge.target}${edge.data?.label ? `: ${edge.data.label}` : ''}`,
        }));
    },
    [collapsedNodeIds, edges, nodes],
  );

  return (
    <SelectedNodeCountContext.Provider value={selectedNodeCount}>
      <NodeActionContext.Provider value={nodeActionValue}>
        <TableNodeActionContext.Provider value={tableNodeActionValue}>
        <main
        className="editor-shell"
        aria-label="SynapTable diagram editor"
        aria-busy={!hydrated}
        data-ready={hydrated ? 'true' : 'false'}
        data-save-state={saveState}
      >
        <a href="#canvas-workspace" className="skip-link">Skip to canvas</a>
        <header className="topbar">
          <div className="brand" aria-label="SynapTable">
            <span className="brand-mark" aria-hidden="true">S</span>
            <span>SynapTable</span>
          </div>
          <label className="document-title">
            <span className={`status-dot status-${saveState}`} aria-hidden="true" />
            <span className="visually-hidden">Document title</span>
            <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
            <span className="save-label" aria-live="polite">
              {saveState === 'saving'
                ? 'Saving…'
                : saveState === 'error'
                  ? saveFailure === 'quota' ? 'Storage full — backup needed' : 'Save failed'
                  : 'Saved on device'}
            </span>
          </label>
          <div className="topbar-actions">
            <button
              type="button"
              className="icon-button mobile-layers-button"
              aria-label="Open layers panel"
              aria-expanded={mobilePanel === 'layers'}
              onClick={() => setMobilePanel((current) => current === 'layers' ? null : 'layers')}
            >
              <Layers3 size={16} />
            </button>
            <button
              type="button"
              className="icon-button mobile-inspector-button"
              aria-label="Open properties panel"
              aria-expanded={mobilePanel === 'inspector'}
              onClick={() => setMobilePanel((current) => current === 'inspector' ? null : 'inspector')}
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              type="button"
              className={`icon-button backup-button ${saveFailure === 'quota' ? 'has-storage-warning' : ''}`}
              aria-label={saveFailure === 'quota'
                ? 'Project backup and restore — browser storage is full'
                : 'Project backup and restore'}
              onClick={openBackup}
            >
              <HardDrive size={16} />
            </button>
            <button type="button" className="ghost-button new-button" onClick={() => void resetDocument()}>
              <RotateCcw size={14} /> New
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Undo"
              onClick={undo}
              disabled={!hydrated || !historyState.canUndo}
              suppressHydrationWarning
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Redo"
              onClick={redo}
              disabled={!hydrated || !historyState.canRedo}
              suppressHydrationWarning
            >
              <Redo2 size={16} />
            </button>
            <button ref={exportTriggerRef} type="button" className="primary-button" aria-label="Export canvas" onClick={openExport}>
              <Download size={14} /> <span className="button-label">Export</span>
            </button>
          </div>
        </header>

        <aside className={`panel layers-panel ${mobilePanel === 'layers' ? 'panel-open' : ''}`} aria-labelledby="layers-title">
          <div className="panel-heading">
            <div><span className="eyebrow">Document</span><h1 id="layers-title">Layers</h1></div>
            <div className="panel-heading-actions">
              <button type="button" className="icon-button" aria-label="Add concept layer" onClick={addConceptNode}><Plus size={16} /></button>
              {EDITOR_FEATURES.tableLayer ? <button type="button" className="icon-button" aria-label="Add table layer" onClick={addTableNode}><Table2 size={15} /></button> : null}
              <button type="button" className="icon-button panel-close-button" aria-label="Close layers panel" onClick={() => setMobilePanel(null)}><X size={16} /></button>
            </div>
          </div>
          <div className="layer-search">
            <Search size={13} aria-hidden="true" />
            <label htmlFor="layer-search-input" className="visually-hidden">Search layers, notes, and table cells</label>
            <input
              id="layer-search-input"
              type="search"
              placeholder="Search layers and notes"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && layerNodes[0]) revealAndSelectNode(layerNodes[0].id);
              }}
            />
            {normalizedSearch ? <span aria-live="polite">{layerNodes.length}</span> : null}
          </div>
          <div className="template-picker">
            <label htmlFor="concept-template">Quick template</label>
            <select id="concept-template" value={conceptTemplate} onChange={(event) => setConceptTemplate(event.target.value as QuickTemplate)}>
              <option value="idea">Idea</option>
              <option value="task">Task checklist</option>
              <option value="decision">Decision</option>
              <option value="question">Open question</option>
              {EDITOR_FEATURES.tableLayer ? <option value="table">Table 3 × 3</option> : null}
            </select>
            <button type="button" onClick={addConceptFromTemplate}><Plus size={12} /> Add</button>
          </div>
          <p id="layer-list-instructions" className="visually-hidden">
            Double-click an unlocked layer or press F2 while it is focused to rename it.
          </p>
          <ul className="layer-list" aria-label="Canvas layers" aria-describedby="layer-list-instructions">
            {layerNodes.map((node) => {
              const expanded = expandedVectors.has(node.id);
              return (
                <li key={node.id}>
                  <div className={`layer-row ${node.selected ? 'active' : ''}`}>
                    {node.data.kind === 'vector' ? (
                      <button
                        type="button"
                        className="layer-disclosure"
                        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.data.name}`}
                        aria-expanded={expanded}
                        onClick={() => setExpandedVectors((current) => {
                          const next = new Set(current);
                          if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
                          return next;
                        })}
                      >{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>
                    ) : <span className="layer-indent" />}
                    {renamingLayerId === node.id ? (
                      <div className="layer-main layer-renaming">
                        <span className="layer-icon" aria-hidden="true">
                          {node.data.kind === 'raster' ? <ImageIcon size={12} /> : node.data.kind === 'vector' ? <Shapes size={12} /> : node.data.kind === 'table' ? <Table2 size={12} /> : <Square size={11} />}
                        </span>
                        <input
                          aria-label="Layer name"
                          value={node.data.name}
                          maxLength={240}
                          autoFocus
                          onChange={(event) => updateNode(node.id, (current) => ({
                            ...current,
                            data: { ...current.data, name: event.target.value },
                          }), false)}
                          onBlur={() => {
                            endFieldEdit();
                            setRenamingLayerId(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur();
                              window.setTimeout(() => {
                                const layer = [...document.querySelectorAll<HTMLElement>('[data-layer-id]')]
                                  .find((element) => element.dataset.layerId === node.id);
                                layer?.focus();
                              }, 0);
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              cancelFieldEdit();
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="layer-main"
                        data-layer-id={node.id}
                        aria-pressed={node.selected === true}
                        onClick={(event) => handleLayerSelection(event, node.id)}
                        onKeyDown={(event) => {
                          if (event.key !== 'F2' || node.data.locked) return;
                          event.preventDefault();
                          beginFieldEdit();
                          setRenamingLayerId(node.id);
                        }}
                        onDoubleClick={() => {
                          if (node.data.locked) return;
                          beginFieldEdit();
                          setRenamingLayerId(node.id);
                        }}
                      >
                        <span className="layer-icon" aria-hidden="true">
                          {node.data.kind === 'raster' ? <ImageIcon size={12} /> : node.data.kind === 'vector' ? <Shapes size={12} /> : node.data.kind === 'table' ? <Table2 size={12} /> : <Square size={11} />}
                        </span>
                        <span className="layer-name">{node.data.name}</span>
                      </button>
                    )}
                    <button type="button" className="layer-control" aria-label={`${node.hidden ? 'Show' : 'Hide'} ${node.data.name}`} onClick={() => toggleNodeVisibility(node.id)}>
                      {node.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button type="button" className="layer-control" aria-label={`${node.data.locked ? 'Unlock' : 'Lock'} ${node.data.name}`} onClick={() => toggleNodeLock(node.id)}>
                      {node.data.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                  </div>
                  {node.data.kind === 'vector' && expanded ? (
                    <ul className="path-list" aria-label={`${node.data.name} paths`}>
                      {node.data.paths.map((path) => (
                        <li key={path.id}>
                          <div className={`path-layer-row ${selectedPath?.pathId === path.id ? 'active' : ''}`}>
                            <button
                              type="button"
                              className="path-row"
                              aria-pressed={selectedPath?.pathId === path.id}
                              onClick={() => {
                                selectNode(node.id);
                                setSelectedPath({ nodeId: node.id, pathId: path.id });
                              }}
                            >
                              <span className="path-swatch" style={{ background: path.fill === 'none' ? 'transparent' : path.fill }} />
                              <span>{path.name}</span>
                            </button>
                            <button type="button" className="path-control" aria-label={`${path.visible ? 'Hide' : 'Show'} ${path.name}`} onClick={() => updatePathById(node.id, path.id, (current) => ({ ...current, visible: !current.visible }))}>
                              {path.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                            </button>
                            <button type="button" className="path-control" aria-label={`${path.locked ? 'Unlock' : 'Lock'} ${path.name}`} onClick={() => updatePathById(node.id, path.id, (current) => ({ ...current, locked: !current.locked }))}>
                              {path.locked ? <Lock size={10} /> : <Unlock size={10} />}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="local-note">
            <span className="local-note-icon" aria-hidden="true"><Check size={11} /></span>
            <div><strong>Local workspace</strong><span>Images and edits stay on this device</span></div>
          </div>
        </aside>

        <section
          id="canvas-workspace"
          className={`canvas-region tool-${toolMode} ${dragActive ? 'drag-active' : ''} ${temporaryPanActive ? 'temporary-pan' : ''} ${selectedNodeCount > 1 ? 'multi-selection-active' : ''}`}
          aria-label="Canvas workspace"
          tabIndex={-1}
          onDragEnter={(event) => {
            event.preventDefault();
            dragDepthRef.current += 1;
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepthRef.current -= 1;
            if (dragDepthRef.current <= 0) setDragActive(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(event) => {
            event.preventDefault();
            dragDepthRef.current = 0;
            setDragActive(false);
            void ingestFiles(Array.from(event.dataTransfer.files), { x: event.clientX, y: event.clientY });
          }}
          onDoubleClick={(event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (toolMode !== 'select' || !target?.classList.contains('react-flow__pane')) return;
            event.preventDefault();
            addConceptAt({ x: event.clientX, y: event.clientY }, true);
          }}
        >
          <ReactFlow<EditorNode, EditorEdge>
            nodes={canvasNodes}
            edges={canvasEdges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onReconnect={handleReconnect}
            isValidConnection={isValidConnection}
            onNodeDragStart={() => {
              dragOriginRef.current = cloneSnapshot(nodesRef.current, edgesRef.current);
            }}
            onNodeDragStop={() => {
              if (dragOriginRef.current) {
                recordHistory(dragOriginRef.current);
                dragOriginRef.current = null;
              }
            }}
            onSelectionStart={handleSelectionStart}
            onSelectionEnd={handleSelectionEnd}
            onPaneClick={() => {
              setSelectedPath(null);
              setTableInteraction(null);
            }}
            onMove={(_, viewport) => setViewportZoom(viewport.zoom)}
            fitView
            fitViewOptions={{ padding: 0.22 }}
            minZoom={0.15}
            maxZoom={4}
            panOnDrag={toolMode === 'hand' ? true : [1]}
            panActivationKeyCode="Space"
            panOnScroll
            zoomOnScroll={false}
            zoomActivationKeyCode={['Meta', 'Control']}
            zoomOnPinch
            zoomOnDoubleClick={false}
            selectionOnDrag={toolMode === 'select'}
            selectionMode={SelectionMode.Partial}
            selectionKeyCode={['Meta', 'Control']}
            multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
            paneClickDistance={5}
            nodeClickDistance={3}
            autoPanOnSelection
            autoPanOnNodeDrag
            autoPanOnConnect
            nodesDraggable={toolMode === 'select' && !temporaryPanActive}
            nodesFocusable
            edgesFocusable
            selectNodesOnDrag={toolMode === 'select' && !temporaryPanActive}
            deleteKeyCode={tableInteraction && tableInteraction.mode !== 'table' ? null : ['Backspace', 'Delete']}
            ariaLabelConfig={{
              'controls.ariaLabel': 'Canvas controls',
              'minimap.ariaLabel': 'Diagram overview',
            }}
          >
            <Background color="#d8dbe2" gap={18} size={1} />
            <NodeToolbar
              nodeId={selectedNodes.map((node) => node.id)}
              isVisible={selectedNodeCount > 1}
              position={Position.Top}
              offset={18}
            >
              <div
                className="multi-node-actionbar nodrag nowheel"
                role="group"
                aria-label={`${selectedNodeCount} selected layer actions`}
              >
                <span className="multi-node-count"><Layers3 size={14} /> {selectedNodeCount} selected</span>
                <button
                  type="button"
                  aria-label="Duplicate selected layers"
                  title="Duplicate selected layers"
                  disabled={selectedUnlockedCount === 0}
                  onClick={duplicateSelectedNodes}
                ><Copy size={14} /></button>
                {EDITOR_FEATURES.tableLayer ? <button
                  type="button"
                  aria-label="Organize selected layers into a table"
                  title="Organize into table"
                  disabled={selectedUnlockedCount === 0}
                  onClick={convertSelectedNodesToTable}
                ><Table2 size={14} /></button> : null}
                <button
                  type="button"
                  aria-label="Align selected layers left"
                  title="Align left"
                  disabled={selectedUnlockedCount < 2}
                  onClick={() => alignSelectedNodes('left')}
                ><AlignHorizontalJustifyStart size={14} /></button>
                <button
                  type="button"
                  aria-label="Align selected layers top"
                  title="Align top"
                  disabled={selectedUnlockedCount < 2}
                  onClick={() => alignSelectedNodes('top')}
                ><AlignVerticalJustifyStart size={14} /></button>
                <button
                  type="button"
                  aria-label="Distribute selected layers horizontally"
                  title="Distribute horizontally"
                  disabled={selectedUnlockedCount < 3}
                  onClick={() => alignSelectedNodes('horizontal')}
                ><AlignHorizontalSpaceBetween size={14} /></button>
                <button
                  type="button"
                  aria-label="Distribute selected layers vertically"
                  title="Distribute vertically"
                  disabled={selectedUnlockedCount < 3}
                  onClick={() => alignSelectedNodes('vertical')}
                ><AlignVerticalSpaceBetween size={14} /></button>
                <button
                  type="button"
                  aria-label={selectedUnlockedCount === 0 ? 'Unlock selected layers' : 'Lock selected layers'}
                  title={selectedUnlockedCount === 0 ? 'Unlock selected layers' : 'Lock selected layers'}
                  onClick={() => setSelectedNodesLocked(selectedUnlockedCount > 0)}
                >{selectedUnlockedCount === 0 ? <Unlock size={14} /> : <Lock size={14} />}</button>
                <button
                  type="button"
                  className="danger"
                  aria-label="Delete unlocked selected layers"
                  title="Delete unlocked selected layers"
                  disabled={selectedUnlockedCount === 0}
                  onClick={deleteSelectedNodes}
                ><Trash2 size={14} /></button>
              </div>
            </NodeToolbar>
            <Controls position="bottom-right" showInteractive={false} />
            <MiniMap
              position="bottom-left"
              pannable
              zoomable
              nodeColor={(node) => node.type === 'raster' ? '#d8dbe2' : node.type === 'vector' ? '#635bff' : node.type === 'table' ? '#6c67db' : '#8a8e98'}
            />
            <Panel position="top-center" className="canvas-toolbar" aria-label="Canvas tools">
              <button type="button" className={`tool ${toolMode === 'select' && !temporaryPanActive ? 'active' : ''}`} aria-label="Select tool, V" aria-pressed={toolMode === 'select' && !temporaryPanActive} title="Select layers (V) · Drag empty canvas to select" onClick={() => setToolMode('select')}><MousePointer2 size={16} /></button>
              <button type="button" className={`tool ${toolMode === 'hand' || temporaryPanActive ? 'active' : ''}`} aria-label="Hand tool, H" aria-pressed={toolMode === 'hand' || temporaryPanActive} title="Pan canvas (H) · Hold Space from Select" onClick={() => setToolMode('hand')}><Hand size={16} /></button>
              <span className="toolbar-divider" />
              <button type="button" className="tool" aria-label="Add concept" onClick={addConceptNode}><TypeIcon size={16} /></button>
              {EDITOR_FEATURES.tableLayer ? <button type="button" className="tool" aria-label="Add table" onClick={addTableNode}><Table2 size={16} /></button> : null}
              <button type="button" className="tool" aria-label="Connect nodes by dragging their handles" onClick={() => announce('Drag from a node handle to another node to create a connector.')}><Waypoints size={16} /></button>
              <button type="button" className="tool" aria-label="Tidy diagram layout" onClick={tidyDiagram}><Sparkles size={16} /></button>
              <button type="button" className="tool" aria-label="Import image" onClick={() => fileInputRef.current?.click()}><Upload size={16} /></button>
            </Panel>
            <Panel position="bottom-right" className="zoom-readout">
              <button
                type="button"
                aria-label={`Reset zoom to 100%, currently ${Math.round(viewportZoom * 100)}%`}
                title="Reset zoom to 100%"
                onClick={() => {
                  const viewport = getViewport();
                  const canvasBounds = document.querySelector<HTMLElement>('.canvas-region .react-flow')?.getBoundingClientRect();
                  const center = screenToFlowPosition({
                    x: canvasBounds ? canvasBounds.left + canvasBounds.width / 2 : window.innerWidth / 2,
                    y: canvasBounds ? canvasBounds.top + canvasBounds.height / 2 : window.innerHeight / 2,
                  });
                  void setCenter(center.x, center.y, { zoom: 1, duration: 180 });
                  if (viewport.zoom === 1) setViewportZoom(1);
                }}
              >{Math.round(viewportZoom * 100)}%</button>
            </Panel>
            <Panel position="bottom-center" className="drop-prompt">
              <span className="upload-symbol" aria-hidden="true"><Upload size={16} /></span>
              <div><strong>Drop an image anywhere</strong><span>or paste with ⌘V</span></div>
              <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()}>Browse files</button>
            </Panel>
          </ReactFlow>
          {dragActive ? (
            <div className="drop-overlay" role="status">
              <Upload size={26} />
              <strong>Drop image to add</strong>
              <span>PNG, JPEG, or WebP · up to 15 MB</span>
            </div>
          ) : null}
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            aria-label="Choose images to add to the canvas"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(event) => {
              void ingestFiles(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
        </section>

        <aside className={`panel inspector-panel ${mobilePanel === 'inspector' ? 'panel-open' : ''}`} aria-labelledby="inspector-title">
          <div className="panel-heading">
            <div><span className="eyebrow">Selection</span><h2 id="inspector-title">Properties</h2></div>
            <div className="panel-heading-actions">
              {selectedNodes.length > 1
                ? <span className="selection-kind">{selectedNodes.length} layers</span>
                : selectedEdge
                  ? <span className="selection-kind">connector</span>
                  : selectedNode
                    ? <span className="selection-kind">{selectedNode.data.kind}</span>
                    : null}
              <button type="button" className="icon-button panel-close-button" aria-label="Close properties panel" onClick={() => setMobilePanel(null)}><X size={16} /></button>
            </div>
          </div>
          {selectedVectorPath ? (
            <PathInspector
              path={selectedVectorPath.path}
              onUpdate={updateSelectedPath}
              onClose={() => setSelectedPath(null)}
              onEditStart={beginFieldEdit}
              onEditEnd={endFieldEdit}
              onMove={moveSelectedPath}
              onDuplicate={duplicateSelectedPath}
              onDelete={deleteSelectedPath}
            />
          ) : selectedEdge ? (
            <EdgeInspector
              edge={selectedEdge}
              onUpdate={(updater, shouldRecord) => updateEdge(selectedEdge.id, (edge) => {
                const next = updater(edge);
                const kind = next.data?.kind ?? 'default';
                const label = next.data?.label ?? '';
                return { ...next, label, style: connectorPresentation(kind) };
              }, shouldRecord)}
              onEditStart={beginFieldEdit}
              onEditEnd={endFieldEdit}
              onDelete={() => {
                recordHistory();
                setEdges((current) => current.filter((edge) => edge.id !== selectedEdge.id));
              }}
            />
          ) : selectedNodes.length > 1 ? (
            <MultiSelectionInspector
              count={selectedNodes.length}
              onTone={(tone) => updateSelectedNodes((node) => node.data.kind === 'concept'
                ? { ...node, data: { ...node.data, tone } }
                : node)}
              onOpacity={(opacity) => updateSelectedNodes((node) => ({ ...node, data: { ...node.data, opacity } }))}
              onAlign={alignSelectedNodes}
              onConvert={EDITOR_FEATURES.tableLayer ? convertSelectedNodesToTable : undefined}
              onDuplicate={duplicateSelectedNodes}
              onLock={() => setSelectedNodesLocked(true)}
              onUnlock={() => setSelectedNodesLocked(false)}
              onDelete={deleteSelectedNodes}
            />
          ) : selectedNode ? (
            <NodeInspector
              node={selectedNode}
              tableInteraction={tableInteraction}
              conversionOptions={conversionOptions}
              onConversionOptionsChange={setConversionOptions}
              onUpdate={updateNode}
              onRemoveTableStructure={removeSelectedTableStructure}
              onVectorize={() => void vectorizeImage(selectedNode.id)}
              onCancelVectorize={cancelVectorization}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onMove={(direction) => moveLayer(selectedNode.id, direction)}
              onEditStart={beginFieldEdit}
              onEditEnd={endFieldEdit}
              onEditConcept={() => beginConceptEdit(selectedNode.id)}
              converting={convertingId === selectedNode.id}
            />
          ) : (
            <div className="empty-inspector">
              <MousePointer2 size={20} />
              <strong>Select a layer</strong>
              <span>Choose an object on the canvas or in the layer list to edit it.</span>
            </div>
          )}
        </aside>

        {mobilePanel ? <button type="button" className="panel-scrim" aria-label="Close side panel" onClick={() => setMobilePanel(null)} /> : null}

        <div className="toast-region" aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.tone}`}>
              {toast.tone === 'success' ? <Check size={15} /> : toast.tone === 'error' ? <X size={15} /> : <Sparkles size={15} />}
              <span>{toast.message}</span>
            </div>
          ))}
        </div>

        <dialog
          ref={exportDialogRef}
          className="export-dialog"
          aria-labelledby="export-title"
          onCancel={(event) => {
            if (exportBusy) event.preventDefault();
          }}
          onClose={() => {
            if (!exportBusy) {
              setExportOpen(false);
              window.requestAnimationFrame(() => exportTriggerRef.current?.focus());
            }
          }}
        >
          <form method="dialog" aria-busy={exportBusy}>
            <div className="dialog-icon"><Download size={19} /></div>
            <div className="dialog-copy">
              <span className="eyebrow">Export</span>
              <h2 id="export-title">Export canvas</h2>
              <p>Download a visual of your canvas or portable table data. Everything is processed on this device.</p>
            </div>
            <div className="export-controls">
              <fieldset>
                <legend>Area</legend>
                <div className="export-segmented">
                  <label><input type="radio" name="export-scope" value="canvas" checked={exportScope === 'canvas'} onChange={() => { setExportScope('canvas'); if (exportFormat === 'csv') setExportFormat('png'); }} /> Canvas</label>
                  <label><input type="radio" name="export-scope" value="selection" checked={exportScope === 'selection'} disabled={hydrated && selectedNodeCount === 0} onChange={() => { setExportScope('selection'); if (exportFormat === 'csv' && !(selectedNodes.length === 1 && selectedNodes[0].data.kind === 'table')) setExportFormat('png'); }} /> Selection</label>
                  <label>
                    <input
                      type="radio"
                      name="export-scope"
                      value="table-cells"
                      checked={exportScope === 'table-cells'}
                      disabled={hydrated && (!tableInteraction || tableInteraction.mode === 'table')}
                      onChange={() => setExportScope('table-cells')}
                    /> Cells
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend>Format</legend>
                <div className="export-segmented export-formats">
                  {(['png', 'svg', 'pdf', 'csv'] as const).map((format) => {
                    const csvAvailable = exportScope === 'table-cells'
                      || (exportScope === 'selection' && selectedNodes.length === 1 && selectedNodes[0].data.kind === 'table');
                    return (
                      <label key={format}>
                        <input
                          type="radio"
                          name="export-format"
                          value={format}
                          checked={exportFormat === format}
                          disabled={hydrated && format === 'csv' && !csvAvailable}
                          onChange={() => setExportFormat(format)}
                        /> {format.toUpperCase()}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {exportFormat !== 'csv' ? (
                <div className="export-settings-grid">
                  <label>Padding
                    <select aria-label="Export padding" value={exportPadding} onChange={(event) => setExportPadding(Number(event.target.value))}>
                      <option value={0}>None</option><option value={24}>Small</option><option value={48}>Medium</option><option value={96}>Large</option>
                    </select>
                  </label>
                  {exportFormat !== 'pdf' ? <label>Background
                    <select aria-label="Export background" value={exportBackground} onChange={(event) => setExportBackground(event.target.value as ExportBackground)}>
                      <option value="transparent">Transparent</option><option value="white">White</option>
                    </select>
                  </label> : null}
                  {exportFormat === 'png' ? <label>Resolution
                    <select aria-label="PNG resolution" value={exportScale} onChange={(event) => setExportScale(Number(event.target.value))}>
                      <option value={1}>1×</option><option value={2}>2×</option><option value={3}>3×</option><option value={4}>4×</option>
                    </select>
                  </label> : null}
                  {exportFormat === 'pdf' ? <>
                    <label>Page
                      <select aria-label="PDF page size" value={pdfPageSize} onChange={(event) => setPdfPageSize(event.target.value as PdfPageSize)}>
                        <option value="fit">Fit content</option><option value="a4">A4</option><option value="letter">Letter</option>
                      </select>
                    </label>
                    <label>Orientation
                      <select aria-label="PDF orientation" value={pdfOrientation} onChange={(event) => setPdfOrientation(event.target.value as PdfOrientation)}>
                        <option value="auto">Auto</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option>
                      </select>
                    </label>
                    <label>Margin
                      <select aria-label="PDF margin" value={pdfMargin} onChange={(event) => setPdfMargin(Number(event.target.value))}>
                        <option value={0}>None</option><option value={24}>Small</option><option value={48}>Large</option>
                      </select>
                    </label>
                    <label>Quality
                      <select aria-label="PDF quality" value={pdfQuality} onChange={(event) => setPdfQuality(Number(event.target.value))}>
                        <option value={1}>Standard</option><option value={2}>High</option><option value={3}>Print</option>
                      </select>
                    </label>
                  </> : null}
                </div>
              ) : <p className="export-note">CSV includes cell text in row order with spreadsheet-compatible UTF-8 encoding.</p>}
            </div>
            <dl className="export-summary">
              <div><dt>Scope</dt><dd>{exportScope === 'canvas' ? 'Full canvas' : exportScope === 'selection' ? 'Selected layers' : 'Selected cells'}</dd></div>
              <div><dt>Layers</dt><dd>{hydrated ? (exportScope === 'selection' ? selectedNodeCount : exportScope === 'canvas' ? nodes.filter((node) => !node.hidden).length : 1) : '—'}</dd></div>
              <div><dt>Processing</dt><dd>On device</dd></div>
            </dl>
            <div className="dialog-actions">
              <button type="button" className="secondary-button" disabled={exportBusy} onClick={() => setExportOpen(false)}>Cancel</button>
              <button type="button" className="primary-button" disabled={exportBusy} onClick={() => void performExport()}>
                {exportBusy ? <LoaderCircle size={14} className="spin" /> : <Download size={14} />} {exportBusy ? 'Preparing…' : `Download ${exportFormat.toUpperCase()}`}
              </button>
            </div>
          </form>
        </dialog>

        <dialog
          ref={backupDialogRef}
          className="export-dialog backup-dialog"
          aria-labelledby="backup-title"
          onClose={() => setBackupOpen(false)}
        >
          <form method="dialog">
            <div className="dialog-icon"><HardDrive size={19} /></div>
            <div className="dialog-copy">
              <span className="eyebrow">Local project</span>
              <h2 id="backup-title">Backup and restore</h2>
              <p>Your canvas is stored only in this browser. Download a portable backup before clearing browser data or changing devices.</p>
            </div>
            <div className="backup-actions">
              <button type="button" className="primary-button" onClick={performBackup}>
                <Download size={14} /> Download backup
              </button>
              <button type="button" className="secondary-button" onClick={() => projectInputRef.current?.click()}>
                <Upload size={14} /> Restore backup
              </button>
            </div>
            <p className="backup-warning">Restoring a valid backup replaces the current canvas after confirmation.</p>
            <section className="storage-summary" aria-labelledby="storage-summary-title">
              <div>
                <span className="eyebrow">Browser storage</span>
                <h3 id="storage-summary-title">Local data protection</h3>
              </div>
              {storageHealthBusy && !storageHealth ? (
                <p>Checking approximate storage use…</p>
              ) : storageHealth?.supported ? (
                <>
                  <dl>
                    <div><dt>Approximate use</dt><dd>{formatStorageBytes(storageHealth.usage)}</dd></div>
                    <div><dt>Available quota</dt><dd>{formatStorageBytes(storageHealth.quota)}</dd></div>
                    <div>
                      <dt>Retention</dt>
                      <dd>{storageHealth.persisted === true ? 'Protected' : storageHealth.persisted === false ? 'Best effort' : 'Unknown'}</dd>
                    </div>
                  </dl>
                  {storageUsageRatio(storageHealth) !== null ? (
                    <p>{Math.round(storageUsageRatio(storageHealth)! * 100)}% of this origin&apos;s approximate browser quota is in use.</p>
                  ) : <p>The browser did not provide a usage estimate.</p>}
                  {storageHealth.persisted === false ? (
                    <button type="button" className="secondary-button" disabled={storageHealthBusy} onClick={() => void protectLocalStorage()}>
                      <HardDrive size={13} /> Protect local storage
                    </button>
                  ) : null}
                </>
              ) : (
                <p>Storage estimates and persistent-storage requests are unavailable in this browser. Download backups regularly.</p>
              )}
              <p>Browser storage can still be cleared by you, device policy, or browser settings. A downloaded backup is the safest portable copy.</p>
            </section>
            <section className="checkpoint-section" aria-labelledby="checkpoint-title">
              <div className="checkpoint-heading">
                <div><span className="eyebrow">On this device</span><h3 id="checkpoint-title">Version checkpoints</h3></div>
                <button type="button" className="secondary-button" onClick={() => void createCheckpoint()}><Plus size={13} /> Save checkpoint</button>
              </div>
              {checkpoints.length ? (
                <ul className="checkpoint-list">
                  {checkpoints.map((checkpoint) => (
                    <li key={checkpoint.id}>
                      <button type="button" className="checkpoint-main" onClick={() => void restoreCheckpoint(checkpoint)}>
                        <strong>{checkpoint.title}</strong>
                        <span>{new Date(checkpoint.createdAt).toLocaleString()}</span>
                      </button>
                      <button type="button" className="checkpoint-delete" aria-label={`Delete checkpoint ${checkpoint.title}`} onClick={() => void removeCheckpoint(checkpoint.id)}><Trash2 size={13} /></button>
                    </li>
                  ))}
                </ul>
              ) : <p className="checkpoint-empty">No checkpoints yet. Save one before a major edit.</p>}
            </section>
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={() => setBackupOpen(false)}>Close</button>
            </div>
            <input
              ref={projectInputRef}
              className="visually-hidden"
              type="file"
              aria-label="Choose a SynapTable project backup"
              accept=".synaptable,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void restoreProject(file);
                event.target.value = '';
              }}
            />
          </form>
        </dialog>
        </main>
        </TableNodeActionContext.Provider>
      </NodeActionContext.Provider>
    </SelectedNodeCountContext.Provider>
  );
}

type NodeInspectorProps = {
  node: EditorNode;
  tableInteraction: TableInteraction | null;
  conversionOptions: ConversionOptions;
  onConversionOptionsChange: (options: ConversionOptions) => void;
  onUpdate: (id: string, updater: (node: EditorNode) => EditorNode, shouldRecord?: boolean) => void;
  onRemoveTableStructure: (id: string, kind: 'row' | 'column', indexes: number[]) => void;
  onVectorize: () => void;
  onCancelVectorize: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onEditConcept: () => void;
  converting: boolean;
};

function EdgeInspector({
  edge,
  onUpdate,
  onEditStart,
  onEditEnd,
  onDelete,
}: {
  edge: EditorEdge;
  onUpdate: (updater: (edge: EditorEdge) => EditorEdge, shouldRecord?: boolean) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onDelete: () => void;
}) {
  const data = edge.data ?? { label: '', kind: 'default' as const };
  return (
    <>
      <div className="inspector-section">
        <label className="stacked-field">
          <span>Connector label</span>
          <input
            value={data.label}
            maxLength={240}
            placeholder="Describe the relationship"
            onFocus={onEditStart}
            onChange={(event) => onUpdate((current) => ({
              ...current,
              label: event.target.value,
              data: { ...(current.data ?? { kind: 'default' }), label: event.target.value },
            }), false)}
            onBlur={onEditEnd}
          />
        </label>
        <label className="stacked-field">
          <span>Connector style</span>
          <select
            value={data.kind}
            onFocus={onEditStart}
            onChange={(event) => {
              const kind = event.target.value as 'default' | 'dashed' | 'emphasis';
              onUpdate((current) => ({
                ...current,
                data: { ...(current.data ?? { label: '' }), kind },
              }), false);
            }}
            onBlur={onEditEnd}
          >
            <option value="default">Default</option>
            <option value="dashed">Dashed</option>
            <option value="emphasis">Emphasis</option>
          </select>
        </label>
      </div>
      <div className="inspector-actions single-action">
        <button type="button" className="danger" onClick={onDelete}><Trash2 size={14} /> Delete connector</button>
      </div>
    </>
  );
}

function MultiSelectionInspector({
  count,
  onTone,
  onOpacity,
  onAlign,
  onConvert,
  onDuplicate,
  onLock,
  onUnlock,
  onDelete,
}: {
  count: number;
  onTone: (tone: 'ink' | 'indigo' | 'mint') => void;
  onOpacity: (opacity: number) => void;
  onAlign: (mode: 'left' | 'top' | 'horizontal' | 'vertical') => void;
  onConvert?: () => void;
  onDuplicate: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="multi-selection-summary">
        <Layers3 size={19} />
        <div><strong>{count} layers selected</strong><span>Changes apply to unlocked layers.</span></div>
      </div>
      <div className="inspector-section">
        <span className="section-label">Concept style</span>
        <div className="segmented-actions">
          <button type="button" onClick={() => onTone('ink')}>Ink</button>
          <button type="button" onClick={() => onTone('indigo')}>Indigo</button>
          <button type="button" onClick={() => onTone('mint')}>Mint</button>
        </div>
        <span className="section-label section-label-spaced">Opacity</span>
        <div className="segmented-actions">
          <button type="button" onClick={() => onOpacity(1)}>100%</button>
          <button type="button" onClick={() => onOpacity(.75)}>75%</button>
          <button type="button" onClick={() => onOpacity(.5)}>50%</button>
        </div>
      </div>
      <div className="inspector-section">
        <span className="section-label">Arrange</span>
        <div className="arrange-actions">
          <button type="button" onClick={() => onAlign('left')}>Align left</button>
          <button type="button" onClick={() => onAlign('top')}>Align top</button>
          <button type="button" onClick={() => onAlign('horizontal')} disabled={count < 3}>Distribute ↔</button>
          <button type="button" onClick={() => onAlign('vertical')} disabled={count < 3}>Distribute ↕</button>
        </div>
      </div>
      <div className="multi-selection-actions">
        {onConvert ? <button type="button" onClick={onConvert}><Table2 size={13} /> Make table</button> : null}
        <button type="button" onClick={onDuplicate}><Copy size={13} /> Duplicate</button>
        <button type="button" onClick={onLock}><Lock size={13} /> Lock</button>
        <button type="button" onClick={onUnlock}><Unlock size={13} /> Unlock</button>
      </div>
      <div className="inspector-actions single-action multi-selection-delete">
        <button type="button" className="danger" onClick={onDelete}><Trash2 size={14} /> Delete unlocked layers</button>
      </div>
    </>
  );
}

function NodeInspector({
  node,
  tableInteraction,
  conversionOptions,
  onConversionOptionsChange,
  onUpdate,
  onRemoveTableStructure,
  onVectorize,
  onCancelVectorize,
  onDuplicate,
  onDelete,
  onMove,
  onEditStart,
  onEditEnd,
  onEditConcept,
  converting,
}: NodeInspectorProps) {
  const tableData = node.data.kind === 'table' ? node.data : null;
  const updateData = (data: Partial<EditorNode['data']>, shouldRecord = true) =>
    onUpdate(
      node.id,
      (current) => ({
        ...current,
        data: { ...current.data, ...data } as EditorNode['data'],
      }),
      shouldRecord,
    );
  const selectedTableAddress = node.data.kind === 'table' && tableInteraction?.nodeId === node.id
    ? tableInteractionFocus(node.data, tableInteraction)
    : null;
  const selectedTableCell = node.data.kind === 'table'
    ? tableCellAt(node.data, selectedTableAddress)
    : null;
  const selectedTableAddresses = node.data.kind === 'table' && tableInteraction?.nodeId === node.id
    ? tableInteractionCells(node.data, tableInteraction)
    : [];
  const tableSelectionLabel = tableInteraction?.nodeId !== node.id
    ? null
    : tableInteraction.mode === 'row'
      ? `${tableInteraction.rowIds.length} ${tableInteraction.rowIds.length === 1 ? 'row' : 'rows'}`
      : tableInteraction.mode === 'column'
        ? `${tableInteraction.columnIds.length} ${tableInteraction.columnIds.length === 1 ? 'column' : 'columns'}`
        : tableInteraction.mode === 'cell' && selectedTableAddresses.length > 1
          ? `${selectedTableAddresses.length} cells`
          : selectedTableCell
            ? `row ${selectedTableCell.rowIndex + 1}, column ${selectedTableCell.columnIndex + 1}`
            : null;
  const selectedTableRowIndexes = !tableData
    ? []
    : tableInteraction?.nodeId === node.id && tableInteraction.mode === 'row'
      ? tableInteraction.rowIds
          .map((id) => tableData.rows.findIndex((row) => row.id === id))
          .filter((index) => index >= 0)
          .sort((left, right) => left - right)
      : selectedTableCell
        ? [selectedTableCell.rowIndex]
        : [];
  const selectedTableColumnIndexes = !tableData
    ? []
    : tableInteraction?.nodeId === node.id && tableInteraction.mode === 'column'
      ? tableInteraction.columnIds
          .map((id) => tableData.columns.findIndex((column) => column.id === id))
          .filter((index) => index >= 0)
          .sort((left, right) => left - right)
      : selectedTableCell
        ? [selectedTableCell.columnIndex]
        : [];
  const updateTableData = (
    updater: (data: TableNodeData) => TableNodeData,
    shouldRecord = true,
  ) => onUpdate(node.id, (current) => {
    if (current.data.kind !== 'table') return current;
    const data = updater(current.data);
    return { ...current, data, style: { ...current.style, ...tableDimensions(data) } };
  }, shouldRecord);

  return (
    <>
      <div className="inspector-section">
        <label className="stacked-field">
          <span>Name</span>
          <input
            value={node.data.name}
            maxLength={240}
            disabled={node.data.locked}
            onFocus={onEditStart}
            onChange={(event) => updateData({ name: event.target.value }, false)}
            onBlur={onEditEnd}
          />
        </label>
        {node.data.kind === 'concept' ? (
          <label className="stacked-field">
            <span>Label</span>
            <input
              value={node.data.label}
              maxLength={500}
              disabled={node.data.locked}
              onFocus={onEditStart}
              onChange={(event) => updateData({
                label: event.target.value,
                name: event.target.value,
                title: replaceRichTextPlainText(
                  node.data.kind === 'concept' ? node.data.title : emptyRichText(),
                  event.target.value,
                ),
              }, false)}
              onBlur={onEditEnd}
            />
          </label>
        ) : null}
        {node.data.kind === 'concept' ? (
          <>
            <label className="stacked-field">
              <span>Eyebrow</span>
              <input
                value={node.data.eyebrow}
                maxLength={160}
                disabled={node.data.locked}
                onFocus={onEditStart}
                onChange={(event) => updateData({ eyebrow: event.target.value }, false)}
                onBlur={onEditEnd}
              />
            </label>
            <label className="stacked-field">
              <span>Style</span>
              <select
                value={node.data.tone}
                disabled={node.data.locked}
                onFocus={onEditStart}
                onChange={(event) => updateData({ tone: event.target.value as 'ink' | 'indigo' | 'mint' }, false)}
                onBlur={onEditEnd}
              >
                <option value="ink">Ink</option>
                <option value="indigo">Indigo</option>
                <option value="mint">Mint</option>
              </select>
            </label>
            <fieldset className="content-alignment-field" disabled={node.data.locked}>
              <legend>Content alignment</legend>
              <div className="content-alignment-row">
                <span>Across</span>
                {(['left', 'center', 'right'] as const).map((alignment) => (
                  <button
                    key={alignment}
                    type="button"
                    aria-label={`Align content ${alignment}`}
                    aria-pressed={node.data.horizontalAlign === alignment}
                    onClick={() => updateData({ horizontalAlign: alignment })}
                  >
                    {alignment[0].toUpperCase() + alignment.slice(1)}
                  </button>
                ))}
              </div>
              <div className="content-alignment-row">
                <span>Down</span>
                {(['top', 'middle', 'bottom'] as const).map((alignment) => (
                  <button
                    key={alignment}
                    type="button"
                    aria-label={`Align content ${alignment}`}
                    aria-pressed={node.data.verticalAlign === alignment}
                    onClick={() => updateData({ verticalAlign: alignment })}
                  >
                    {alignment[0].toUpperCase() + alignment.slice(1)}
                  </button>
                ))}
              </div>
            </fieldset>
            <button type="button" className="secondary-button edit-content-button" disabled={node.data.locked} onClick={onEditConcept}>
              <TypeIcon size={13} /> Edit rich text
            </button>
          </>
        ) : null}
      </div>
      {node.data.kind === 'table' ? (
        <>
          <div className="inspector-section table-options-section">
            <span className="section-label">Table structure</span>
            <div className="table-summary">
              <Table2 size={15} />
              <span>{node.data.rows.length} rows × {node.data.columns.length} columns</span>
            </div>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={node.data.headerRow}
                disabled={node.data.locked}
                onChange={() => updateTableData((data) => ({ ...data, headerRow: !data.headerRow }))}
              />
              <span>Header row</span>
            </label>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={node.data.headerColumn}
                disabled={node.data.locked}
                onChange={() => updateTableData((data) => ({ ...data, headerColumn: !data.headerColumn }))}
              />
              <span>Header column</span>
            </label>
            <div className="table-structure-grid" role="group" aria-label="Table row controls">
              <button
                type="button"
                disabled={node.data.locked || node.data.rows.length >= TABLE_MAX_ROWS || (node.data.rows.length + 1) * node.data.columns.length > TABLE_MAX_CELLS}
                onClick={() => updateTableData((data) => insertTableRow(data, selectedTableRowIndexes[0] ?? data.rows.length))}
              ><Plus size={12} /> Above</button>
              <button
                type="button"
                disabled={node.data.locked || node.data.rows.length >= TABLE_MAX_ROWS || (node.data.rows.length + 1) * node.data.columns.length > TABLE_MAX_CELLS}
                onClick={() => updateTableData((data) => insertTableRow(data, selectedTableRowIndexes.at(-1) !== undefined ? selectedTableRowIndexes.at(-1)! + 1 : data.rows.length))}
              ><Plus size={12} /> Below</button>
              <button
                type="button"
                disabled={node.data.locked || !selectedTableRowIndexes.length || node.data.rows.length + selectedTableRowIndexes.length > TABLE_MAX_ROWS || (node.data.rows.length + selectedTableRowIndexes.length) * node.data.columns.length > TABLE_MAX_CELLS}
                onClick={() => updateTableData((data) => selectedTableRowIndexes.reduce(
                  (next, rowIndex, offset) => duplicateTableRow(next, rowIndex + offset),
                  data,
                ))}
              ><Copy size={12} /> Duplicate</button>
              <button
                type="button"
                disabled={node.data.locked || !selectedTableRowIndexes.length || node.data.rows.length - selectedTableRowIndexes.length < 1}
                onClick={() => onRemoveTableStructure(node.id, 'row', selectedTableRowIndexes)}
              ><Trash2 size={12} /> Delete</button>
              <button
                type="button"
                aria-label="Move selected row up"
                disabled={node.data.locked || selectedTableRowIndexes.length !== 1 || selectedTableRowIndexes[0] === 0}
                onClick={() => updateTableData((data) => moveTableRow(data, selectedTableRowIndexes[0], -1))}
              ><ArrowUp size={12} /> Up</button>
              <button
                type="button"
                aria-label="Move selected row down"
                disabled={node.data.locked || selectedTableRowIndexes.length !== 1 || selectedTableRowIndexes[0] === node.data.rows.length - 1}
                onClick={() => updateTableData((data) => moveTableRow(data, selectedTableRowIndexes[0], 1))}
              ><ArrowDown size={12} /> Down</button>
            </div>
            <div className="table-structure-grid" role="group" aria-label="Table column controls">
              <button
                type="button"
                disabled={node.data.locked || node.data.columns.length >= TABLE_MAX_COLUMNS || node.data.rows.length * (node.data.columns.length + 1) > TABLE_MAX_CELLS}
                onClick={() => updateTableData((data) => insertTableColumn(data, selectedTableColumnIndexes[0] ?? data.columns.length))}
              ><Plus size={12} /> Left</button>
              <button
                type="button"
                disabled={node.data.locked || node.data.columns.length >= TABLE_MAX_COLUMNS || node.data.rows.length * (node.data.columns.length + 1) > TABLE_MAX_CELLS}
                onClick={() => updateTableData((data) => insertTableColumn(data, selectedTableColumnIndexes.at(-1) !== undefined ? selectedTableColumnIndexes.at(-1)! + 1 : data.columns.length))}
              ><Plus size={12} /> Right</button>
              <button
                type="button"
                disabled={node.data.locked || !selectedTableColumnIndexes.length || node.data.columns.length + selectedTableColumnIndexes.length > TABLE_MAX_COLUMNS || node.data.rows.length * (node.data.columns.length + selectedTableColumnIndexes.length) > TABLE_MAX_CELLS}
                onClick={() => updateTableData((data) => selectedTableColumnIndexes.reduce(
                  (next, columnIndex, offset) => duplicateTableColumn(next, columnIndex + offset),
                  data,
                ))}
              ><Copy size={12} /> Duplicate</button>
              <button
                type="button"
                disabled={node.data.locked || !selectedTableColumnIndexes.length || node.data.columns.length - selectedTableColumnIndexes.length < 1}
                onClick={() => onRemoveTableStructure(node.id, 'column', selectedTableColumnIndexes)}
              ><Trash2 size={12} /> Delete</button>
              <button
                type="button"
                aria-label="Move selected column left"
                disabled={node.data.locked || selectedTableColumnIndexes.length !== 1 || selectedTableColumnIndexes[0] === 0}
                onClick={() => updateTableData((data) => moveTableColumn(data, selectedTableColumnIndexes[0], -1))}
              >← Left</button>
              <button
                type="button"
                aria-label="Move selected column right"
                disabled={node.data.locked || selectedTableColumnIndexes.length !== 1 || selectedTableColumnIndexes[0] === node.data.columns.length - 1}
                onClick={() => updateTableData((data) => moveTableColumn(data, selectedTableColumnIndexes[0], 1))}
              >Right →</button>
            </div>
            <div className="table-sizing-actions" role="group" aria-label="Table sizing controls">
              <button type="button" disabled={node.data.locked} onClick={() => updateTableData(distributeTableColumns)}>Equal columns</button>
              <button type="button" disabled={node.data.locked} onClick={() => updateTableData(distributeTableRows)}>Equal rows</button>
              <button type="button" disabled={node.data.locked} onClick={() => updateTableData(resetTableSizing)}>Reset sizing</button>
            </div>
          </div>
          {selectedTableCell ? (
            <div className="inspector-section table-cell-section">
              <span className="section-label">Selected {tableSelectionLabel}</span>
              <label className="stacked-field section-label-spaced">
                <span>Background</span>
                <select
                  value={selectedTableCell.cell.tone}
                  disabled={node.data.locked}
                  onChange={(event) => updateTableData((data) => updateTableCells(data, selectedTableAddresses, (cell) => ({ ...cell, tone: event.target.value as TableCellTone })))}
                >
                  <option value="none">None</option>
                  <option value="gray">Gray</option>
                  <option value="indigo">Indigo</option>
                  <option value="mint">Mint</option>
                  <option value="amber">Amber</option>
                  <option value="rose">Rose</option>
                </select>
              </label>
              <fieldset className="content-alignment-field" disabled={node.data.locked}>
                <legend>Text alignment</legend>
                <div className="content-alignment-row table-alignment-row">
                  {(['left', 'center', 'right'] as const).map((alignment) => (
                    <button
                      key={alignment}
                      type="button"
                      aria-pressed={selectedTableCell.cell.horizontalAlign === alignment}
                      onClick={() => updateTableData((data) => updateTableCells(data, selectedTableAddresses, (cell) => ({ ...cell, horizontalAlign: alignment })))}
                    >{alignment}</button>
                  ))}
                </div>
              </fieldset>
              <div className="field-grid">
                <label>Width
                  <input
                    type="number"
                    min={TABLE_MIN_COLUMN_WIDTH}
                    max={TABLE_MAX_COLUMN_WIDTH}
                    value={Math.round(selectedTableCell.column.width)}
                    disabled={node.data.locked}
                    onFocus={onEditStart}
                    onChange={(event) => updateTableData((data) => resizeTableColumn(data, selectedTableCell.columnIndex, Number(event.target.value)), false)}
                    onBlur={onEditEnd}
                  />
                </label>
                <label>Height
                  <input
                    type="number"
                    min={TABLE_MIN_ROW_HEIGHT}
                    max={TABLE_MAX_ROW_HEIGHT}
                    value={Math.round(selectedTableCell.row.height)}
                    disabled={node.data.locked}
                    onFocus={onEditStart}
                    onChange={(event) => updateTableData((data) => resizeTableRow(data, selectedTableCell.rowIndex, Number(event.target.value)), false)}
                    onBlur={onEditEnd}
                  />
                </label>
              </div>
              <div className="table-sizing-actions" role="group" aria-label="Selected row and column sizing">
                <button
                  type="button"
                  disabled={node.data.locked}
                  onClick={() => updateTableData((data) => fitTableColumnToContent(data, selectedTableCell.columnIndex))}
                >Fit column</button>
                <button
                  type="button"
                  disabled={node.data.locked}
                  onClick={() => updateTableData((data) => fitTableRowToContent(data, selectedTableCell.rowIndex))}
                >Fit row</button>
              </div>
              <div className="table-sizing-actions" role="group" aria-label="Selected cell clearing controls">
                <button
                  type="button"
                  disabled={node.data.locked}
                  onClick={() => updateTableData((data) => updateTableCells(data, selectedTableAddresses, (cell) => replaceTableCellPlainText(cell, '')))}
                >Clear contents</button>
                <button
                  type="button"
                  disabled={node.data.locked}
                  onClick={() => updateTableData((data) => updateTableCells(data, selectedTableAddresses, (cell) => ({
                    ...cell,
                    tone: 'none',
                    horizontalAlign: 'left',
                  })))}
                >Clear formatting</button>
              </div>
            </div>
          ) : (
            <div className="inspector-section table-cell-empty">Select a cell to style or resize its row and column.</div>
          )}
        </>
      ) : null}
      <div className="inspector-section">
        <span className="section-label">Position</span>
        <div className="field-grid">
          <label>X <input type="number" value={Math.round(node.position.x)} disabled={node.data.locked} onFocus={onEditStart} onChange={(event) => onUpdate(node.id, (current) => ({ ...current, position: { ...current.position, x: Number(event.target.value) } }), false)} onBlur={onEditEnd} /></label>
          <label>Y <input type="number" value={Math.round(node.position.y)} disabled={node.data.locked} onFocus={onEditStart} onChange={(event) => onUpdate(node.id, (current) => ({ ...current, position: { ...current.position, y: Number(event.target.value) } }), false)} onBlur={onEditEnd} /></label>
        </div>
      </div>
      <div className="inspector-section">
        <span className="section-label">Appearance</span>
        <label className="full-field">
          <span>Opacity</span>
          <input type="range" min="0" max="100" value={Math.round(node.data.opacity * 100)} disabled={node.data.locked} onFocus={onEditStart} onChange={(event) => updateData({ opacity: Number(event.target.value) / 100 }, false)} onBlur={onEditEnd} />
          <output>{Math.round(node.data.opacity * 100)}%</output>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={node.data.locked} onChange={() => onUpdate(node.id, (current) => ({ ...current, draggable: current.data.locked, deletable: current.data.locked, data: { ...current.data, locked: !current.data.locked } }))} />
          <span>Lock layer</span>
        </label>
      </div>
      {EDITOR_FEATURES.imageVectorization && node.data.kind === 'raster' ? (
        <div className="inspector-section">
          <span className="section-label">Local vectorization</span>
          <label className="stacked-field">
            <span>Detail</span>
            <select value={conversionOptions.preset} onChange={(event) => onConversionOptionsChange({ ...conversionOptions, preset: event.target.value as ConversionOptions['preset'] })}>
              <option value="balanced">Balanced</option>
              <option value="detailed">Detailed</option>
              <option value="poster">Poster</option>
            </select>
          </label>
          <label className="full-field">
            <span>Colors</span>
            <input type="range" min="2" max="32" value={conversionOptions.colors} onChange={(event) => onConversionOptionsChange({ ...conversionOptions, colors: Number(event.target.value) })} />
            <output>{conversionOptions.colors}</output>
          </label>
          <label className="full-field">
            <span>Smoothing</span>
            <input type="range" min="0" max="5" value={conversionOptions.despeckle} onChange={(event) => onConversionOptionsChange({ ...conversionOptions, despeckle: Number(event.target.value) })} />
            <output>{conversionOptions.despeckle}</output>
          </label>
          <div className="conversion-actions">
            <button type="button" className={converting ? 'secondary-button' : 'primary-button'} onClick={converting ? onCancelVectorize : onVectorize}>{converting ? <X size={14} /> : <Shapes size={14} />} {converting ? 'Cancel tracing' : 'Vectorize'}</button>
          </div>
          <p className="privacy-hint"><Check size={12} /> Vectorization runs on this device.</p>
        </div>
      ) : null}
      {node.data.kind === 'vector' ? (
        <div className="inspector-section">
          <span className="section-label">Vector summary</span>
          <div className="conversion-card"><Layers3 size={16} /><div><strong>{node.data.paths.length} editable paths</strong><span>Expand this layer to edit individual colors and visibility.</span></div></div>
        </div>
      ) : null}
      <div className="inspector-actions">
        <button type="button" aria-label="Move layer up" onClick={() => onMove(1)}><ArrowUp size={14} /></button>
        <button type="button" aria-label="Move layer down" onClick={() => onMove(-1)}><ArrowDown size={14} /></button>
        <button type="button" aria-label="Duplicate layer" onClick={onDuplicate}><Copy size={14} /></button>
        <button type="button" className="danger" aria-label="Delete layer" onClick={onDelete} disabled={node.data.locked}><Trash2 size={14} /></button>
      </div>
    </>
  );
}

function PathInspector({
  path,
  onUpdate,
  onClose,
  onEditStart,
  onEditEnd,
  onMove,
  onDuplicate,
  onDelete,
}: {
  path: VectorPathLayer;
  onUpdate: (updater: (path: VectorPathLayer) => VectorPathLayer, shouldRecord?: boolean) => void;
  onClose: () => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="path-inspector-heading">
        <div><span className="eyebrow">Vector path</span><strong>{path.name}</strong></div>
        <button type="button" className="icon-button" aria-label="Close path properties" onClick={onClose}><X size={14} /></button>
      </div>
      <div className="inspector-section">
        <label className="stacked-field">
          <span>Name</span>
          <input value={path.name} maxLength={240} disabled={path.locked} onFocus={onEditStart} onChange={(event) => onUpdate((current) => ({ ...current, name: event.target.value }), false)} onBlur={onEditEnd} />
        </label>
        <label className="color-field">
          <span>Fill</span>
          <input type="color" value={path.fill === 'none' ? '#000000' : path.fill} disabled={path.locked} onFocus={onEditStart} onChange={(event) => onUpdate((current) => ({ ...current, fill: event.target.value }), false)} onBlur={onEditEnd} />
          <code>{path.fill}</code>
        </label>
        <label className="full-field">
          <span>Opacity</span>
          <input type="range" min="0" max="100" value={Math.round(path.opacity * 100)} disabled={path.locked} onFocus={onEditStart} onChange={(event) => onUpdate((current) => ({ ...current, opacity: Number(event.target.value) / 100 }), false)} onBlur={onEditEnd} />
          <output>{Math.round(path.opacity * 100)}%</output>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={path.visible} onChange={() => onUpdate((current) => ({ ...current, visible: !current.visible }))} />
          <span>Visible on canvas</span>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={path.locked} onChange={() => onUpdate((current) => ({ ...current, locked: !current.locked }))} />
          <span>Lock path</span>
        </label>
      </div>
      <div className="inspector-actions">
        <button type="button" aria-label="Move path up" onClick={() => onMove(-1)} disabled={path.locked}><ArrowUp size={14} /></button>
        <button type="button" aria-label="Move path down" onClick={() => onMove(1)} disabled={path.locked}><ArrowDown size={14} /></button>
        <button type="button" aria-label="Duplicate path" onClick={onDuplicate} disabled={path.locked}><Copy size={14} /></button>
        <button type="button" className="danger" aria-label="Delete path" onClick={onDelete} disabled={path.locked}><Trash2 size={14} /></button>
      </div>
    </>
  );
}

export default function Editor() {
  return (
    <ReactFlowProvider>
      <EditorInner />
    </ReactFlowProvider>
  );
}
