import type { Edge, Node } from '@xyflow/react';

export type VectorPathLayer = {
  id: string;
  name: string;
  d: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
};

export type RichTextMark = {
  type: 'bold' | 'italic' | 'underline' | 'strike' | 'link';
  attrs?: { href?: string };
};

export type RichTextNode = {
  type:
    | 'doc'
    | 'paragraph'
    | 'text'
    | 'hardBreak'
    | 'bulletList'
    | 'orderedList'
    | 'listItem'
    | 'taskList'
    | 'taskItem';
  attrs?: { checked?: boolean; start?: number };
  marks?: RichTextMark[];
  text?: string;
  content?: RichTextNode[];
};

export type RichTextDocument = RichTextNode & { type: 'doc' };

export type BaseNodeData = Record<string, unknown> & {
  kind: 'concept' | 'raster' | 'vector' | 'table';
  name: string;
  opacity: number;
  locked: boolean;
};

export type TableCellTone = 'none' | 'gray' | 'indigo' | 'mint' | 'amber' | 'rose';

export type TableCell = {
  id: string;
  text: string;
  tone: TableCellTone;
  horizontalAlign: 'left' | 'center' | 'right';
};

export type TableColumn = {
  id: string;
  width: number;
};

export type TableRow = {
  id: string;
  height: number;
  cells: TableCell[];
};

export type TableNodeData = BaseNodeData & {
  kind: 'table';
  columns: TableColumn[];
  rows: TableRow[];
  headerRow: boolean;
  headerColumn: boolean;
};

export type ConceptNodeData = BaseNodeData & {
  kind: 'concept';
  label: string;
  title: RichTextDocument;
  body: RichTextDocument;
  eyebrow: string;
  tone: 'ink' | 'indigo' | 'mint';
  collapsed: boolean;
  horizontalAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
};

export type RasterNodeData = BaseNodeData & {
  kind: 'raster';
  src: string;
  fileName: string;
  naturalWidth: number;
  naturalHeight: number;
};

export type VectorNodeData = BaseNodeData & {
  kind: 'vector';
  sourceName: string;
  viewBox: [number, number, number, number];
  paths: VectorPathLayer[];
};

export type EditorNodeData = ConceptNodeData | RasterNodeData | VectorNodeData | TableNodeData;
export type EditorNode = Node<EditorNodeData>;
export type ConnectorKind = 'default' | 'dashed' | 'emphasis';
export type EditorEdgeData = Record<string, unknown> & {
  label: string;
  kind: ConnectorKind;
};
export type EditorEdge = Edge<EditorEdgeData>;

export type EditorDocument = {
  schemaVersion: 5;
  title: string;
  nodes: EditorNode[];
  edges: EditorEdge[];
  updatedAt: number;
};

export type ConversionPreset = 'balanced' | 'detailed' | 'poster';

export type ConversionOptions = {
  preset: ConversionPreset;
  colors: number;
  despeckle: number;
};

export type VectorizationResult = {
  viewBox: [number, number, number, number];
  width: number;
  height: number;
  paths: VectorPathLayer[];
};
