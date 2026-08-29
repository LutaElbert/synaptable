import type { EditorEdge, EditorNode } from './types';

export type ConnectionCandidate = {
  source?: string | null;
  target?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type ConnectionIssue =
  | 'missing-endpoint'
  | 'unknown-endpoint'
  | 'self-connection'
  | 'locked-endpoint'
  | 'duplicate-connection';

export type GraphIntegrityIssue = {
  kind:
    | 'duplicate-layer-id'
    | 'duplicate-connector-id'
    | 'missing-endpoint'
    | 'self-connection'
    | 'duplicate-connection';
  id: string;
};

export function connectionIssue(
  nodes: EditorNode[],
  edges: EditorEdge[],
  connection: ConnectionCandidate,
  ignoreEdgeId?: string,
): ConnectionIssue | null {
  const { source, target } = connection;
  if (!source || !target) return 'missing-endpoint';
  const sourceNode = nodes.find((node) => node.id === source);
  const targetNode = nodes.find((node) => node.id === target);
  if (!sourceNode || !targetNode) return 'unknown-endpoint';
  if (source === target) return 'self-connection';
  if (sourceNode.data.locked || targetNode.data.locked) return 'locked-endpoint';
  if (edges.some((edge) => edge.id !== ignoreEdgeId && edge.source === source && edge.target === target)) {
    return 'duplicate-connection';
  }
  return null;
}

export function connectionIssueMessage(issue: ConnectionIssue): string {
  switch (issue) {
    case 'missing-endpoint':
      return 'Choose both a source and target layer.';
    case 'unknown-endpoint':
      return 'That connector points to a layer that no longer exists.';
    case 'self-connection':
      return 'A layer cannot connect to itself.';
    case 'locked-endpoint':
      return 'Unlock both layers before changing their connection.';
    case 'duplicate-connection':
      return 'Those layers are already connected in that direction.';
  }
}

export function canConnect(
  nodes: EditorNode[],
  edges: EditorEdge[],
  connection: ConnectionCandidate,
  ignoreEdgeId?: string,
): boolean {
  return connectionIssue(nodes, edges, connection, ignoreEdgeId) === null;
}

export function graphIntegrityIssues(nodes: EditorNode[], edges: EditorEdge[]): GraphIntegrityIssue[] {
  const issues: GraphIntegrityIssue[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const directedPairs = new Set<string>();

  for (const node of nodes) {
    if (nodeIds.has(node.id)) issues.push({ kind: 'duplicate-layer-id', id: node.id });
    nodeIds.add(node.id);
  }

  for (const edge of edges) {
    if (edgeIds.has(edge.id)) issues.push({ kind: 'duplicate-connector-id', id: edge.id });
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({ kind: 'missing-endpoint', id: edge.id });
      continue;
    }
    if (edge.source === edge.target) issues.push({ kind: 'self-connection', id: edge.id });
    const pair = `${edge.source}\u0000${edge.target}`;
    if (directedPairs.has(pair)) issues.push({ kind: 'duplicate-connection', id: edge.id });
    directedPairs.add(pair);
  }

  return issues;
}

export function removeNodesAndConnections(
  nodes: EditorNode[],
  edges: EditorEdge[],
  nodeIds: ReadonlySet<string>,
): { nodes: EditorNode[]; edges: EditorEdge[] } {
  return {
    nodes: nodes.filter((node) => !nodeIds.has(node.id)),
    edges: edges.filter((edge) => !nodeIds.has(edge.source) && !nodeIds.has(edge.target)),
  };
}

export function collapsedDescendantIds(nodes: EditorNode[], edges: EditorEdge[]): Set<string> {
  const hidden = new Set<string>();
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
  }
  const visit = (id: string, seen: Set<string>) => {
    for (const child of children.get(id) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      hidden.add(child);
      visit(child, seen);
    }
  };
  for (const node of nodes) {
    if (node.data.kind === 'concept' && node.data.collapsed) visit(node.id, new Set([node.id]));
  }
  return hidden;
}

export function tidyGraphPositions(
  nodes: EditorNode[],
  edges: EditorEdge[],
): Map<string, { x: number; y: number }> {
  const visibleNodes = nodes.filter((node) => !node.hidden);
  const positions = new Map<string, { x: number; y: number }>();
  if (visibleNodes.length === 0) return positions;

  const nodeIds = new Set(visibleNodes.map((node) => node.id));
  const incoming = new Map(visibleNodes.map((node) => [node.id, 0]));
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
  }

  const roots = visibleNodes.filter((node) => (incoming.get(node.id) ?? 0) === 0);
  const queue = (roots.length ? roots : [visibleNodes[0]]).map((node) => ({ id: node.id, depth: 0 }));
  const depths = new Map<string, number>();
  while (queue.length) {
    const current = queue.shift()!;
    if (depths.has(current.id)) continue;
    depths.set(current.id, current.depth);
    for (const child of children.get(current.id) ?? []) queue.push({ id: child, depth: current.depth + 1 });
  }
  for (const node of visibleNodes) if (!depths.has(node.id)) depths.set(node.id, 0);

  const rows = new Map<number, string[]>();
  for (const node of visibleNodes) {
    const depth = depths.get(node.id) ?? 0;
    rows.set(depth, [...(rows.get(depth) ?? []), node.id]);
  }
  for (const [depth, ids] of rows) {
    ids.forEach((id, index) => positions.set(id, { x: 110 + depth * 310, y: 90 + index * 150 }));
  }
  return positions;
}
