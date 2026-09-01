import type { EditorEdge, EditorNode } from './types';
import { tableDimensions } from './table-grid';

export const CONCEPT_MIN_WIDTH = 150;
export const CONCEPT_MIN_HEIGHT = 68;
export const CONCEPT_DEFAULT_WIDTH = 220;
export const CONCEPT_EDIT_MIN_WIDTH = 250;
export const CONCEPT_EDIT_MIN_HEIGHT = 150;
export const CONCEPT_BRANCH_GAP = 44;
export const CONCEPT_LEVEL_GAP = 92;

export type NodeDimensions = { width: number; height: number };
export type NodePosition = { x: number; y: number };

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function editorNodeDimensions(node: EditorNode): NodeDimensions {
  if (node.data.kind === 'table') return tableDimensions(node.data);
  const fallback = node.data.kind === 'concept'
    ? { width: CONCEPT_DEFAULT_WIDTH, height: CONCEPT_MIN_HEIGHT }
    : { width: 320, height: 240 };
  const styledWidth = positiveNumber(node.style?.width);
  const styledHeight = positiveNumber(node.style?.height);
  const measuredWidth = positiveNumber(node.measured?.width);
  const measuredHeight = positiveNumber(node.measured?.height);
  return {
    width: styledWidth || measuredWidth || fallback.width,
    height: Math.max(styledHeight, measuredHeight, fallback.height),
  };
}

export type RelativeConceptLayout = {
  parentId: string | null;
  positions: Map<string, NodePosition>;
};

/**
 * Calculates a predictable mind-map row for a new child or sibling. Children
 * share a level beneath their parent and are centered as a group, while a
 * root-level sibling is placed directly beside the selected concept.
 */
export function relativeConceptLayout(
  nodes: EditorNode[],
  edges: EditorEdge[],
  sourceId: string,
  relation: 'child' | 'sibling',
  newId: string,
  newDimensions: NodeDimensions = {
    width: CONCEPT_DEFAULT_WIDTH,
    height: CONCEPT_MIN_HEIGHT,
  },
): RelativeConceptLayout {
  const source = nodes.find((node) => node.id === sourceId);
  if (!source) return { parentId: null, positions: new Map() };

  const incoming = edges.find((edge) => edge.target === sourceId);
  const parentId = relation === 'child' ? sourceId : incoming?.source ?? null;
  if (!parentId) {
    const sourceSize = editorNodeDimensions(source);
    return {
      parentId: null,
      positions: new Map([[
        newId,
        {
          x: source.position.x + sourceSize.width + CONCEPT_BRANCH_GAP,
          y: source.position.y,
        },
      ]]),
    };
  }

  const parent = nodes.find((node) => node.id === parentId);
  if (!parent) return { parentId: null, positions: new Map() };

  const childIds = edges
    .filter((edge) => edge.source === parentId)
    .map((edge) => edge.target);
  const existingChildren = childIds
    .map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is EditorNode => Boolean(node))
    .sort((left, right) => left.position.x - right.position.x);

  const insertionIndex = relation === 'sibling'
    ? Math.max(0, existingChildren.findIndex((node) => node.id === sourceId) + 1)
    : existingChildren.length;
  const orderedChildren: Array<{ id: string; dimensions: NodeDimensions }> = existingChildren.map((node) => ({
    id: node.id,
    dimensions: editorNodeDimensions(node),
  }));
  orderedChildren.splice(insertionIndex, 0, { id: newId, dimensions: newDimensions });

  const parentSize = editorNodeDimensions(parent);
  const totalWidth = orderedChildren.reduce((sum, child) => sum + child.dimensions.width, 0)
    + Math.max(0, orderedChildren.length - 1) * CONCEPT_BRANCH_GAP;
  const rowY = parent.position.y + parentSize.height + CONCEPT_LEVEL_GAP;
  let cursorX = parent.position.x + parentSize.width / 2 - totalWidth / 2;
  const positions = new Map<string, NodePosition>();

  for (const child of orderedChildren) {
    positions.set(child.id, { x: cursorX, y: rowY });
    cursorX += child.dimensions.width + CONCEPT_BRANCH_GAP;
  }

  return { parentId, positions };
}
