'use client';

import {
  Background,
  Controls,
  Handle,
  MiniMap,
  NodeResizer,
  NodeToolbar,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import {
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
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
  Lock,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  Shapes,
  Sparkles,
  Square,
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
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import '@xyflow/react/dist/style.css';
import { buildSvgDocument, downloadSvg } from './export-svg';
import { initialDocument } from './initial-document';
import { clearLocalDocument, loadLocalDocument, saveLocalDocument } from './persistence';
import { unconfiguredReconstructionProvider } from './reconstruction';
import type {
  ConversionOptions,
  EditorDocument,
  EditorEdge,
  EditorNode,
  VectorPathLayer,
} from './types';
import { vectorizeDataUrl } from './vectorize';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

type EditorSnapshot = Pick<EditorDocument, 'nodes' | 'edges'>;
type ToolMode = 'select' | 'hand';
type Toast = { id: number; message: string; tone: 'info' | 'success' | 'error' };

type NodeActionContextValue = {
  convertingId: string | null;
  keepImage: (id: string) => void;
  vectorizeImage: (id: string, expandLayers?: boolean) => void;
  rebuildDiagram: (id: string) => void;
  recordResizeStart: () => void;
  recordResizeEnd: () => void;
};

const NodeActionContext = createContext<NodeActionContextValue | null>(null);

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

function ConceptNode({ data, selected }: NodeProps<EditorNode>) {
  const actions = useNodeActions();
  if (data.kind !== 'concept') return null;
  return (
    <>
      <NodeResizer
        isVisible={selected && !data.locked}
        minWidth={150}
        minHeight={68}
        onResizeStart={actions.recordResizeStart}
        onResizeEnd={actions.recordResizeEnd}
      />
      <article
        className={`concept-node tone-${data.tone}`}
        style={{ opacity: data.opacity }}
      >
        <span>{data.eyebrow}</span>
        <strong>{data.label}</strong>
      </article>
      <CommonHandles />
    </>
  );
}

function RasterNode({ id, data, selected }: NodeProps<EditorNode>) {
  const actions = useNodeActions();
  if (data.kind !== 'raster') return null;
  const isConverting = actions.convertingId === id;
  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top} offset={14}>
        <div className="node-actionbar nodrag nowheel" aria-label="Image actions">
          <button type="button" onClick={() => actions.keepImage(id)}>
            <Check size={14} /> Keep image
          </button>
          <button
            type="button"
            onClick={() => actions.vectorizeImage(id)}
            disabled={isConverting}
          >
            {isConverting ? <LoaderCircle className="spin" size={14} /> : <Shapes size={14} />}
            Vectorize
          </button>
          <button type="button" onClick={() => actions.rebuildDiagram(id)}>
            <Sparkles size={14} /> Rebuild diagram
          </button>
          <button
            type="button"
            onClick={() => actions.vectorizeImage(id, true)}
            disabled={isConverting}
          >
            <Layers3 size={14} /> Extract layers
          </button>
        </div>
      </NodeToolbar>
      <NodeResizer
        isVisible={selected && !data.locked}
        minWidth={120}
        minHeight={80}
        keepAspectRatio
        onResizeStart={actions.recordResizeStart}
        onResizeEnd={actions.recordResizeEnd}
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

function VectorNode({ data, selected }: NodeProps<EditorNode>) {
  const actions = useNodeActions();
  if (data.kind !== 'vector') return null;
  const [minX, minY, width, height] = data.viewBox;
  return (
    <>
      <NodeResizer
        isVisible={selected && !data.locked}
        minWidth={120}
        minHeight={80}
        keepAspectRatio
        onResizeStart={actions.recordResizeStart}
        onResizeEnd={actions.recordResizeEnd}
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
};

function cloneSnapshot(nodes: EditorNode[], edges: EditorEdge[]): EditorSnapshot {
  return structuredClone({ nodes, edges });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image.'));
    reader.readAsDataURL(file);
  });
}

async function imageDimensions(file: File) {
  const bitmap = await createImageBitmap(file);
  const result = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return result;
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

function EditorInner() {
  const [nodes, setNodes] = useState<EditorNode[]>(initialDocument.nodes);
  const [edges, setEdges] = useState<EditorEdge[]>(initialDocument.edges);
  const [title, setTitle] = useState(initialDocument.title);
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [dragActive, setDragActive] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportDialogRef = useRef<HTMLDialogElement>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const pastRef = useRef<EditorSnapshot[]>([]);
  const futureRef = useRef<EditorSnapshot[]>([]);
  const dragOriginRef = useRef<EditorSnapshot | null>(null);
  const resizeOriginRef = useRef<EditorSnapshot | null>(null);
  const dragDepthRef = useRef(0);
  const conversionControllerRef = useRef<AbortController | null>(null);
  const { screenToFlowPosition, fitView } = useReactFlow<EditorNode, EditorEdge>();

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

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
    if (pastRef.current.length > 60) pastRef.current.shift();
    futureRef.current = [];
    refreshHistoryState();
  }, [refreshHistoryState]);

  const undo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current.push(cloneSnapshot(nodesRef.current, edgesRef.current));
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setSelectedPath(null);
    refreshHistoryState();
  }, [refreshHistoryState]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(cloneSnapshot(nodesRef.current, edgesRef.current));
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedPath(null);
    refreshHistoryState();
  }, [refreshHistoryState]);

  useEffect(() => {
    let active = true;
    loadLocalDocument()
      .then((document) => {
        if (!active || !document) return;
        setNodes(document.nodes.map((node) => ({ ...node, selected: false })));
        setEdges(document.edges.map((edge) => ({ ...edge, selected: false })));
        setTitle(document.title);
      })
      .catch(() => setSaveState('error'))
      .finally(() => active && setHydrated(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const savingTimeout = window.setTimeout(() => setSaveState('saving'), 0);
    const timeout = window.setTimeout(() => {
      saveLocalDocument({
        schemaVersion: 1,
        title,
        nodes: nodes.map((node) => ({ ...node, selected: false })),
        edges: edges.map((edge) => ({ ...edge, selected: false })),
        updatedAt: Date.now(),
      })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 650);
    return () => {
      window.clearTimeout(savingTimeout);
      window.clearTimeout(timeout);
    };
  }, [edges, hydrated, nodes, title]);

  useEffect(() => {
    if (exportOpen && !exportDialogRef.current?.open) exportDialogRef.current?.showModal();
    if (!exportOpen && exportDialogRef.current?.open) exportDialogRef.current.close();
  }, [exportOpen]);

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
      recordHistory();
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            style: { stroke: '#a9adb7', strokeWidth: 1.5 },
          },
          current,
        ),
      );
    },
    [recordHistory],
  );

  const selectNode = useCallback((id: string) => {
    setNodes((current) =>
      current.map((node) => ({ ...node, selected: node.id === id })),
    );
    setSelectedPath(null);
  }, []);

  const ingestFiles = useCallback(
    async (files: File[], clientPoint?: { x: number; y: number }) => {
      const imageFiles = files.filter((file) => ACCEPTED_TYPES.has(file.type));
      if (imageFiles.length === 0) {
        announce('Use a PNG, JPEG, or WebP image.', 'error');
        return;
      }
      const oversized = imageFiles.find((file) => file.size > MAX_FILE_SIZE);
      if (oversized) {
        announce(`${oversized.name} is larger than the 15 MB local limit.`, 'error');
        return;
      }

      try {
        const fallbackPoint = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        const dropPoint = clientPoint
          ? screenToFlowPosition(clientPoint)
          : fallbackPoint;
        const imported: EditorNode[] = [];

        for (const [index, file] of imageFiles.entries()) {
          const [src, dimensions] = await Promise.all([
            fileToDataUrl(file),
            imageDimensions(file),
          ]);
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
      const target = event.target as HTMLElement | null;
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = Boolean(target?.closest('input, textarea, [contenteditable="true"]'));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (!isEditing && event.key.toLowerCase() === 'v') {
        setToolMode('select');
      } else if (!isEditing && event.key.toLowerCase() === 'h') {
        setToolMode('hand');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

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

  const rebuildDiagram = useCallback((id: string) => {
    void id;
    announce(
      `${unconfiguredReconstructionProvider.name}. Local vectorization and layer extraction are available now.`,
      'info',
    );
  }, [announce]);

  const addConceptNode = useCallback(() => {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const id = crypto.randomUUID();
    recordHistory();
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      {
        id,
        type: 'concept',
        position: { x: center.x - 94, y: center.y - 39 },
        data: {
          kind: 'concept',
          name: 'New concept',
          label: 'New concept',
          eyebrow: 'Concept',
          tone: 'ink',
          opacity: 1,
          locked: false,
        },
        selected: true,
      },
    ]);
  }, [recordHistory, screenToFlowPosition]);

  const selectedNode = nodes.find((node) => node.selected) ?? null;
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

  const toggleNodeVisibility = useCallback((id: string) => {
    updateNode(id, (node) => ({ ...node, hidden: !node.hidden }));
  }, [updateNode]);

  const toggleNodeLock = useCallback((id: string) => {
    updateNode(id, (node) => ({
      ...node,
      draggable: node.data.locked,
      data: { ...node.data, locked: !node.data.locked },
    }));
  }, [updateNode]);

  const duplicateSelected = useCallback(() => {
    if (!selectedNode) return;
    const copy: EditorNode = {
      ...structuredClone(selectedNode),
      id: crypto.randomUUID(),
      position: { x: selectedNode.position.x + 28, y: selectedNode.position.y + 28 },
      selected: true,
      data: { ...structuredClone(selectedNode.data), name: `${selectedNode.data.name} copy` },
    };
    recordHistory();
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      copy,
    ]);
  }, [recordHistory, selectedNode]);

  const deleteSelected = useCallback(() => {
    if (!selectedNode) return;
    recordHistory();
    setNodes((current) => current.filter((node) => node.id !== selectedNode.id));
    setEdges((current) =>
      current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id),
    );
    setSelectedPath(null);
  }, [recordHistory, selectedNode]);

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
  }, [announce, refreshHistoryState]);

  const openExport = useCallback(() => setExportOpen(true), []);
  const performExport = useCallback(() => {
    try {
      const svg = buildSvgDocument(nodesRef.current, edgesRef.current);
      downloadSvg(svg, safeFileBase(title));
      setExportOpen(false);
      announce('Editable SVG exported.', 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Export failed.', 'error');
    }
  }, [announce, title]);

  const nodeActionValue = useMemo<NodeActionContextValue>(
    () => ({
      convertingId,
      keepImage,
      vectorizeImage,
      rebuildDiagram,
      recordResizeStart: () => {
        if (!resizeOriginRef.current) {
          resizeOriginRef.current = cloneSnapshot(nodesRef.current, edgesRef.current);
        }
      },
      recordResizeEnd: () => {
        if (resizeOriginRef.current) {
          recordHistory(resizeOriginRef.current);
          resizeOriginRef.current = null;
        }
      },
    }),
    [convertingId, keepImage, rebuildDiagram, recordHistory, vectorizeImage],
  );

  const layerNodes = [...nodes].reverse();

  return (
    <NodeActionContext.Provider value={nodeActionValue}>
      <main className="editor-shell" aria-label="SynapTable diagram editor">
        <a href="#canvas-workspace" className="skip-link">Skip to canvas</a>
        <header className="topbar">
          <div className="brand" aria-label="SynapTable">
            <span className="brand-mark" aria-hidden="true">S</span>
            <span>SynapTable</span>
          </div>
          <label className="document-title">
            <span className={`status-dot status-${saveState}`} aria-hidden="true" />
            <span className="visually-hidden">Document title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
            <span className="save-label">
              {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved on device'}
            </span>
          </label>
          <div className="topbar-actions">
            <button type="button" className="ghost-button new-button" onClick={() => void resetDocument()}>
              <RotateCcw size={14} /> New
            </button>
            <button type="button" className="icon-button" aria-label="Undo" onClick={undo} disabled={!historyState.canUndo}>
              <Undo2 size={16} />
            </button>
            <button type="button" className="icon-button" aria-label="Redo" onClick={redo} disabled={!historyState.canRedo}>
              <Redo2 size={16} />
            </button>
            <button type="button" className="primary-button" onClick={openExport}>
              <Download size={14} /> Export SVG
            </button>
          </div>
        </header>

        <aside className="panel layers-panel" aria-labelledby="layers-title">
          <div className="panel-heading">
            <div><span className="eyebrow">Document</span><h1 id="layers-title">Layers</h1></div>
            <button type="button" className="icon-button" aria-label="Add concept layer" onClick={addConceptNode}><Plus size={16} /></button>
          </div>
          <ul className="layer-list" aria-label="Canvas layers">
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
                    <button type="button" className="layer-main" onClick={() => selectNode(node.id)}>
                      <span className="layer-icon" aria-hidden="true">
                        {node.data.kind === 'raster' ? <ImageIcon size={12} /> : node.data.kind === 'vector' ? <Shapes size={12} /> : <Square size={11} />}
                      </span>
                      <span className="layer-name">{node.data.name}</span>
                    </button>
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
                          <button
                            type="button"
                            className={`path-row ${selectedPath?.pathId === path.id ? 'active' : ''}`}
                            onClick={() => {
                              selectNode(node.id);
                              setSelectedPath({ nodeId: node.id, pathId: path.id });
                            }}
                          >
                            <span className="path-swatch" style={{ background: path.fill === 'none' ? 'transparent' : path.fill }} />
                            <span>{path.name}</span>
                            <span>{path.visible ? '' : 'Hidden'}</span>
                          </button>
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
          className={`canvas-region ${dragActive ? 'drag-active' : ''}`}
          aria-label="Canvas workspace"
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
        >
          <ReactFlow<EditorNode, EditorEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onNodeDragStart={() => {
              dragOriginRef.current = cloneSnapshot(nodesRef.current, edgesRef.current);
            }}
            onNodeDragStop={() => {
              if (dragOriginRef.current) {
                recordHistory(dragOriginRef.current);
                dragOriginRef.current = null;
              }
            }}
            onPaneClick={() => setSelectedPath(null)}
            fitView
            fitViewOptions={{ padding: 0.22 }}
            minZoom={0.15}
            maxZoom={4}
            panOnDrag={toolMode === 'hand'}
            nodesDraggable={toolMode === 'select'}
            nodesFocusable
            edgesFocusable
            selectNodesOnDrag={toolMode === 'select'}
            deleteKeyCode={['Backspace', 'Delete']}
            ariaLabelConfig={{
              'controls.ariaLabel': 'Canvas controls',
              'minimap.ariaLabel': 'Diagram overview',
            }}
          >
            <Background color="#d8dbe2" gap={18} size={1} />
            <Controls position="bottom-right" showInteractive={false} />
            <MiniMap
              position="bottom-left"
              pannable
              zoomable
              nodeColor={(node) => node.type === 'raster' ? '#d8dbe2' : node.type === 'vector' ? '#635bff' : '#8a8e98'}
            />
            <Panel position="top-center" className="canvas-toolbar" aria-label="Canvas tools">
              <button type="button" className={`tool ${toolMode === 'select' ? 'active' : ''}`} aria-label="Select tool, V" aria-pressed={toolMode === 'select'} onClick={() => setToolMode('select')}><MousePointer2 size={16} /></button>
              <button type="button" className={`tool ${toolMode === 'hand' ? 'active' : ''}`} aria-label="Hand tool, H" aria-pressed={toolMode === 'hand'} onClick={() => setToolMode('hand')}><Hand size={16} /></button>
              <span className="toolbar-divider" />
              <button type="button" className="tool" aria-label="Add text concept" onClick={addConceptNode}><TypeIcon size={16} /></button>
              <button type="button" className="tool" aria-label="Add shape" onClick={addConceptNode}><Square size={16} /></button>
              <button type="button" className="tool" aria-label="Connect nodes by dragging their handles" onClick={() => announce('Drag from a node handle to another node to create a connector.')}><Waypoints size={16} /></button>
              <button type="button" className="tool" aria-label="Import image" onClick={() => fileInputRef.current?.click()}><Upload size={16} /></button>
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

        <aside className="panel inspector-panel" aria-labelledby="inspector-title">
          <div className="panel-heading">
            <div><span className="eyebrow">Selection</span><h2 id="inspector-title">Properties</h2></div>
            {selectedNode ? <span className="selection-kind">{selectedNode.data.kind}</span> : null}
          </div>
          {selectedVectorPath ? (
            <PathInspector
              path={selectedVectorPath.path}
              onUpdate={updateSelectedPath}
              onClose={() => setSelectedPath(null)}
            />
          ) : selectedNode ? (
            <NodeInspector
              node={selectedNode}
              conversionOptions={conversionOptions}
              onConversionOptionsChange={setConversionOptions}
              onUpdate={updateNode}
              onVectorize={() => void vectorizeImage(selectedNode.id)}
              onRebuild={() => rebuildDiagram(selectedNode.id)}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onMove={(direction) => moveLayer(selectedNode.id, direction)}
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
          onClose={() => setExportOpen(false)}
        >
          <form method="dialog">
            <div className="dialog-icon"><Download size={19} /></div>
            <div className="dialog-copy">
              <span className="eyebrow">Export</span>
              <h2 id="export-title">Editable SVG</h2>
              <p>Export visible images, vector paths, concepts, and connectors as one scalable document.</p>
            </div>
            <dl className="export-summary">
              <div><dt>Visible objects</dt><dd>{nodes.filter((node) => !node.hidden).length}</dd></div>
              <div><dt>Vector paths</dt><dd>{nodes.reduce((count, node) => count + (node.data.kind === 'vector' ? node.data.paths.filter((path) => path.visible).length : 0), 0)}</dd></div>
              <div><dt>Processing</dt><dd>On device</dd></div>
            </dl>
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={() => setExportOpen(false)}>Cancel</button>
              <button type="button" className="primary-button" onClick={performExport}><Download size={14} /> Download SVG</button>
            </div>
          </form>
        </dialog>
      </main>
    </NodeActionContext.Provider>
  );
}

type NodeInspectorProps = {
  node: EditorNode;
  conversionOptions: ConversionOptions;
  onConversionOptionsChange: (options: ConversionOptions) => void;
  onUpdate: (id: string, updater: (node: EditorNode) => EditorNode, shouldRecord?: boolean) => void;
  onVectorize: () => void;
  onRebuild: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  converting: boolean;
};

function NodeInspector({
  node,
  conversionOptions,
  onConversionOptionsChange,
  onUpdate,
  onVectorize,
  onRebuild,
  onDuplicate,
  onDelete,
  onMove,
  converting,
}: NodeInspectorProps) {
  const updateData = (data: Partial<EditorNode['data']>, shouldRecord = true) =>
    onUpdate(
      node.id,
      (current) => ({
        ...current,
        data: { ...current.data, ...data } as EditorNode['data'],
      }),
      shouldRecord,
    );

  return (
    <>
      <div className="inspector-section">
        <label className="stacked-field">
          <span>Name</span>
          <input
            value={node.data.name}
            onChange={(event) => updateData({ name: event.target.value }, false)}
            onBlur={() => updateData({ name: node.data.name })}
          />
        </label>
        {node.data.kind === 'concept' ? (
          <label className="stacked-field">
            <span>Label</span>
            <input
              value={node.data.label}
              onChange={(event) => updateData({ label: event.target.value, name: event.target.value }, false)}
            />
          </label>
        ) : null}
      </div>
      <div className="inspector-section">
        <span className="section-label">Position</span>
        <div className="field-grid">
          <label>X <input type="number" value={Math.round(node.position.x)} onChange={(event) => onUpdate(node.id, (current) => ({ ...current, position: { ...current.position, x: Number(event.target.value) } }), false)} /></label>
          <label>Y <input type="number" value={Math.round(node.position.y)} onChange={(event) => onUpdate(node.id, (current) => ({ ...current, position: { ...current.position, y: Number(event.target.value) } }), false)} /></label>
        </div>
      </div>
      <div className="inspector-section">
        <span className="section-label">Appearance</span>
        <label className="full-field">
          <span>Opacity</span>
          <input type="range" min="0" max="100" value={Math.round(node.data.opacity * 100)} onChange={(event) => updateData({ opacity: Number(event.target.value) / 100 }, false)} />
          <output>{Math.round(node.data.opacity * 100)}%</output>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={node.data.locked} onChange={() => onUpdate(node.id, (current) => ({ ...current, draggable: current.data.locked, data: { ...current.data, locked: !current.data.locked } }))} />
          <span>Lock layer</span>
        </label>
      </div>
      {node.data.kind === 'raster' ? (
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
          <div className="conversion-actions">
            <button type="button" className="primary-button" onClick={onVectorize} disabled={converting}>{converting ? <LoaderCircle className="spin" size={14} /> : <Shapes size={14} />} Vectorize</button>
            <button type="button" className="secondary-button" onClick={onRebuild}><Sparkles size={14} /> Rebuild diagram</button>
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
        <button type="button" className="danger" aria-label="Delete layer" onClick={onDelete}><Trash2 size={14} /></button>
      </div>
    </>
  );
}

function PathInspector({
  path,
  onUpdate,
  onClose,
}: {
  path: VectorPathLayer;
  onUpdate: (updater: (path: VectorPathLayer) => VectorPathLayer, shouldRecord?: boolean) => void;
  onClose: () => void;
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
          <input value={path.name} onChange={(event) => onUpdate((current) => ({ ...current, name: event.target.value }), false)} />
        </label>
        <label className="color-field">
          <span>Fill</span>
          <input type="color" value={path.fill === 'none' ? '#000000' : path.fill} onChange={(event) => onUpdate((current) => ({ ...current, fill: event.target.value }), false)} />
          <code>{path.fill}</code>
        </label>
        <label className="full-field">
          <span>Opacity</span>
          <input type="range" min="0" max="100" value={Math.round(path.opacity * 100)} onChange={(event) => onUpdate((current) => ({ ...current, opacity: Number(event.target.value) / 100 }), false)} />
          <output>{Math.round(path.opacity * 100)}%</output>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={path.visible} onChange={() => onUpdate((current) => ({ ...current, visible: !current.visible }))} />
          <span>Visible on canvas</span>
        </label>
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
