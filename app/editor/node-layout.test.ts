import { describe, expect, it } from 'vitest';
import { branchDirection, relativeConceptLayout } from './node-layout';
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

function raster(id: string, x: number, y: number, width = 320, height = 240): EditorNode {
  return {
    id,
    type: 'raster',
    position: { x, y },
    style: { width, height },
    data: {
      kind: 'raster',
      name: id,
      src: 'data:image/png;base64,',
      fileName: `${id}.png`,
      naturalWidth: width,
      naturalHeight: height,
      opacity: 1,
      locked: false,
    },
  };
}

function edge(source: string, target: string, direction: 'horizontal' | 'vertical' = 'horizontal'): EditorEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    ...(direction === 'vertical' ? { sourceHandle: 'bottom', targetHandle: 'top' } : {}),
    data: { label: '', kind: 'default' },
  };
}

describe('branchDirection', () => {
  it('prefers the selected sibling connection over other outgoing directions', () => {
    const edges = [edge('parent', 'horizontal'), edge('parent', 'vertical', 'vertical')];
    expect(branchDirection(edges, 'parent', 'vertical')).toBe('vertical');
  });

  it('continues a parent incoming direction when it has no children', () => {
    expect(branchDirection([edge('root', 'parent')], 'parent')).toBe('horizontal');
    expect(branchDirection([edge('root', 'parent', 'vertical')], 'parent')).toBe('vertical');
  });

  it('uses the vertical default for an isolated parent', () => {
    expect(branchDirection([], 'parent')).toBe('vertical');
  });
});

describe('relativeConceptLayout', () => {
  it('centers a first child beneath its parent', () => {
    const result = relativeConceptLayout([concept('parent', 100, 80)], [], 'parent', 'child', 'new');
    expect(result.parentId).toBe('parent');
    expect(result.direction).toBe('vertical');
    expect(result.positions.get('new')).toEqual({ x: 100, y: 240 });
  });

  it('distributes children by their measured widths without overlap', () => {
    const nodes = [concept('parent', 100, 80), concept('first', 100, 240, 180)];
    const result = relativeConceptLayout(nodes, [edge('parent', 'first', 'vertical')], 'parent', 'child', 'new');
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
    const edges = [edge('parent', 'first', 'vertical'), edge('parent', 'second', 'vertical')];
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

  it('centers a concept child beneath an image using the image height', () => {
    const result = relativeConceptLayout([raster('image', 40, 60)], [], 'image', 'child', 'new');
    expect(result.parentId).toBe('image');
    expect(result.positions.get('new')).toEqual({ x: 90, y: 392 });
  });

  it('places an unconnected image sibling beside the image without a parent', () => {
    const result = relativeConceptLayout([raster('image', 40, 60)], [], 'image', 'sibling', 'new');
    expect(result.parentId).toBeNull();
    expect(result.positions.get('new')).toEqual({ x: 404, y: 60 });
  });

  it('places an image sibling in its existing parent row', () => {
    const nodes = [concept('parent', 100, 80), raster('image', 0, 240, 320, 180)];
    const result = relativeConceptLayout(nodes, [edge('parent', 'image', 'vertical')], 'image', 'sibling', 'new');
    expect(result.parentId).toBe('parent');
    expect(result.positions.get('image')).toEqual({ x: -82, y: 240 });
    expect(result.positions.get('new')).toEqual({ x: 282, y: 240 });
  });

  it('continues a horizontal branch in a column to the right of its parent', () => {
    const nodes = [
      concept('parent', 100, 80),
      concept('first', 420, 40),
      concept('second', 420, 152),
    ];
    const edges = [edge('parent', 'first'), edge('parent', 'second')];
    const result = relativeConceptLayout(nodes, edges, 'parent', 'child', 'new');
    expect(result.direction).toBe('horizontal');
    expect(result.positions.get('first')!.x).toBe(412);
    expect(result.positions.get('first')!.x).toBe(result.positions.get('new')!.x);
    expect(result.positions.get('first')!.y).toBeLessThan(result.positions.get('second')!.y);
    expect(result.positions.get('second')!.y).toBeLessThan(result.positions.get('new')!.y);
  });

  it('uses the incoming direction for the first child of a connected parent', () => {
    const nodes = [concept('root', 0, 80), concept('parent', 320, 80)];
    const result = relativeConceptLayout(nodes, [edge('root', 'parent')], 'parent', 'child', 'new');
    expect(result.direction).toBe('horizontal');
    expect(result.positions.get('new')).toEqual({ x: 632, y: 80 });
  });
});
