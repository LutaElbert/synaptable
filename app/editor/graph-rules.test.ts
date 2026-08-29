import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import {
  canConnect,
  collapsedDescendantIds,
  connectionIssue,
  graphIntegrityIssues,
  removeNodesAndConnections,
  tidyGraphPositions,
} from './graph-rules';
import type { EditorEdge, EditorNode } from './types';

function fixture() {
  return structuredClone(initialDocument);
}

function edge(id: string, source: string, target: string): EditorEdge {
  return {
    id,
    source,
    target,
    type: 'smoothstep',
    data: { label: '', kind: 'default' },
  };
}

describe('connection rules', () => {
  it('accepts a new directed connection and permits its reverse', () => {
    const document = fixture();
    expect(canConnect(document.nodes, document.edges, { source: 'explore', target: 'layers' })).toBe(true);
    expect(canConnect(document.nodes, document.edges, { source: 'explore', target: 'research' })).toBe(true);
  });

  it('rejects missing, unknown, and self endpoints', () => {
    const document = fixture();
    expect(connectionIssue(document.nodes, document.edges, { source: null, target: 'layers' })).toBe('missing-endpoint');
    expect(connectionIssue(document.nodes, document.edges, { source: 'unknown', target: 'layers' })).toBe('unknown-endpoint');
    expect(connectionIssue(document.nodes, document.edges, { source: 'research', target: 'research' })).toBe('self-connection');
  });

  it('rejects duplicate directed connections regardless of handles', () => {
    const document = fixture();
    expect(connectionIssue(document.nodes, document.edges, {
      source: 'research',
      target: 'explore',
      sourceHandle: 'bottom',
      targetHandle: 'top',
    })).toBe('duplicate-connection');
  });

  it('rejects connections when either endpoint is locked', () => {
    const document = fixture();
    document.nodes[1].data.locked = true;
    expect(connectionIssue(document.nodes, document.edges, { source: 'explore', target: 'layers' })).toBe('locked-endpoint');
    expect(connectionIssue(document.nodes, document.edges, { source: 'layers', target: 'explore' })).toBe('locked-endpoint');
  });

  it('ignores the edge being reconnected when checking duplicates', () => {
    const document = fixture();
    expect(canConnect(
      document.nodes,
      document.edges,
      { source: 'research', target: 'explore' },
      'research-explore',
    )).toBe(true);
  });
});

describe('graph integrity', () => {
  it('reports duplicate ids, missing endpoints, self-links, and duplicate pairs', () => {
    const document = fixture();
    const nodes = [...document.nodes, structuredClone(document.nodes[0])];
    const edges = [
      ...document.edges,
      edge('research-explore', 'explore', 'layers'),
      edge('orphan', 'explore', 'missing'),
      edge('self', 'layers', 'layers'),
      edge('duplicate-pair', 'research', 'layers'),
    ];
    expect(graphIntegrityIssues(nodes, edges).map((issue) => issue.kind)).toEqual(expect.arrayContaining([
      'duplicate-layer-id',
      'duplicate-connector-id',
      'missing-endpoint',
      'self-connection',
      'duplicate-connection',
    ]));
  });

  it('deletes incident connectors with selected layers', () => {
    const document = fixture();
    const result = removeNodesAndConnections(document.nodes, document.edges, new Set(['research']));
    expect(result.nodes.map((node) => node.id)).toEqual(['explore', 'layers']);
    expect(result.edges).toEqual([]);
  });

  it('finds collapsed descendants without looping on cycles', () => {
    const document = fixture();
    const research = document.nodes.find((node) => node.id === 'research') as EditorNode;
    if (research.data.kind !== 'concept') throw new Error('Expected a concept fixture.');
    research.data.collapsed = true;
    document.edges.push(edge('cycle', 'layers', 'research'));
    expect(collapsedDescendantIds(document.nodes, document.edges)).toEqual(new Set(['explore', 'layers']));
  });

  it('creates deterministic positions for rooted, cyclic, and disconnected graphs', () => {
    const document = fixture();
    document.edges.push(edge('cycle', 'layers', 'research'));
    const disconnected = structuredClone(document.nodes[0]);
    disconnected.id = 'disconnected';
    disconnected.data.name = 'Disconnected';
    document.nodes.push(disconnected);
    const positions = tidyGraphPositions(document.nodes, document.edges);
    expect(positions.size).toBe(4);
    expect([...positions.values()].every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    expect(tidyGraphPositions(document.nodes, document.edges)).toEqual(positions);
  });

  it('excludes hidden layers from tidy positions', () => {
    const document = fixture();
    document.nodes[1].hidden = true;
    expect(tidyGraphPositions(document.nodes, document.edges).has('explore')).toBe(false);
  });
});
