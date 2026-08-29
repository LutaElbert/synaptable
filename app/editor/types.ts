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
};

type BaseNodeData = Record<string, unknown> & {
  kind: 'concept' | 'raster' | 'vector';
  name: string;
  opacity: number;
  locked: boolean;
};

export type ConceptNodeData = BaseNodeData & {
  kind: 'concept';
  label: string;
  eyebrow: string;
  tone: 'ink' | 'indigo' | 'mint';
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

export type EditorNodeData = ConceptNodeData | RasterNodeData | VectorNodeData;
export type EditorNode = Node<EditorNodeData>;
export type EditorEdge = Edge;

export type EditorDocument = {
  schemaVersion: 1;
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
