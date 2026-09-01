import { MarkerType } from '@xyflow/react';
import { createTableData, cloneTableData, tableDimensions } from './table-grid';
import { initialDocument } from './initial-document';
import type { EditorDocument, EditorEdge, EditorNode } from './types';

export type ProjectStarter = 'blank' | 'idea' | 'table';

export function createStarterDocument(starter: ProjectStarter): EditorDocument {
  const updatedAt = Date.now();
  if (starter === 'blank') {
    return { schemaVersion: 6, title: 'Untitled project', nodes: [], edges: [], updatedAt };
  }
  if (starter === 'idea') {
    return { ...structuredClone(initialDocument), title: 'Untitled idea map', updatedAt };
  }
  const data = createTableData({ name: 'Table 1' });
  const dimensions = tableDimensions(data);
  return {
    schemaVersion: 6,
    title: 'Untitled table',
    updatedAt,
    nodes: [{
      id: crypto.randomUUID(),
      type: 'table',
      position: { x: 180, y: 120 },
      style: dimensions,
      draggable: true,
      deletable: true,
      data,
    }],
    edges: [],
  };
}

export function duplicateProjectDocument(source: EditorDocument): EditorDocument {
  const nodeIds = new Map(source.nodes.map((node) => [node.id, crypto.randomUUID()]));
  const nodes = source.nodes.map((node): EditorNode => {
    const data = node.data.kind === 'table'
      ? cloneTableData(node.data)
      : node.data.kind === 'vector'
        ? {
            ...structuredClone(node.data),
            paths: node.data.paths.map((path) => ({ ...structuredClone(path), id: crypto.randomUUID() })),
          }
        : structuredClone(node.data);
    return {
      ...structuredClone(node),
      id: nodeIds.get(node.id)!,
      selected: false,
      data,
    };
  });
  const edges = source.edges.map((edge): EditorEdge => ({
    ...structuredClone(edge),
    id: crypto.randomUUID(),
    source: nodeIds.get(edge.source)!,
    target: nodeIds.get(edge.target)!,
    selected: false,
    markerEnd: edge.markerEnd ?? { type: MarkerType.ArrowClosed },
  }));
  return {
    schemaVersion: 6,
    title: `Copy of ${source.title}`.slice(0, 120),
    updatedAt: Date.now(),
    nodes,
    edges,
  };
}
