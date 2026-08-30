import { describe, expect, it } from 'vitest';
import { relativeConceptLayout } from './node-layout';
import { conceptTitleFromPlainText } from './rich-text';
import type { EditorEdge, EditorNode } from './types';

function concept(id: string, x: number, y: number, width = 220, height = 68): EditorNode {
  return {
    id,
    type: 'concept',
    position: { x, y },
    style: { width, height },
    data: {
      kind: 'concept',
      name: id,
      label: id,
      title: conceptTitleFromPlainText(id),
      body: { type: 'doc', content: [{ type: 'paragraph' }] },
      eyebrow: 'Concept',
      tone: 'ink',
      collapsed: false,
      horizontalAlign: 'left',
      verticalAlign: 'top',
      opacity: 1,
      locked: false,
    },
  };
}

function edge(source: string, target: string): EditorEdge {
  return { id: `${source}-${target}`, source, target, data: { label: '', kind: 'default' } };
}

describe('relativeConceptLayout', () => {
  it('centers a first child beneath its parent', () => {
    const result = relativeConceptLayout([concept('parent', 100, 80)], [], 'parent', 'child', 'new');
    expect(result.parentId).toBe('parent');
    expect(result.positions.get('new')).toEqual({ x: 100, y: 240 });
  });

  it('distributes children by their measured widths without overlap', () => {
    const nodes = [concept('parent', 100, 80), concept('first', 100, 240, 180)];
    const result = relativeConceptLayout(nodes, [edge('parent', 'first')], 'parent', 'child', 'new');
    const first = result.positions.get('first')!;
    const next = result.positions.get('new')!;
    expect(next.x - (first.x + 180)).toBe(44);
    expect(first.y).toBe(next.y);
    expect(first.x + (180 + 44 + 220) / 2).toBe(210);
  });

  it('inserts a sibling after the selected child', () => {
    const nodes = [
      concept('parent', 100, 80),
      concept('first', 0, 240),
      concept('second', 264, 240),
    ];
    const edges = [edge('parent', 'first'), edge('parent', 'second')];
    const result = relativeConceptLayout(nodes, edges, 'first', 'sibling', 'new');
    expect(result.parentId).toBe('parent');
    expect(result.positions.get('first')!.x).toBeLessThan(result.positions.get('new')!.x);
    expect(result.positions.get('new')!.x).toBeLessThan(result.positions.get('second')!.x);
  });

  it('places an unconnected root sibling beside the selected concept', () => {
    const result = relativeConceptLayout([concept('root', 50, 70)], [], 'root', 'sibling', 'new');
    expect(result.parentId).toBeNull();
    expect(result.positions.get('new')).toEqual({ x: 314, y: 70 });
  });
});
