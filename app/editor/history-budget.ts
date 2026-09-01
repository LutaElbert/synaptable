import type { EditorDocument } from './types';

export type EditorSnapshot = Pick<EditorDocument, 'nodes' | 'edges'>;

export const HISTORY_MAX_ENTRIES = 40;
export const HISTORY_MAX_BYTES = 48 * 1024 * 1024;

const estimatedBytes = new WeakMap<EditorSnapshot, number>();

/**
 * Uses the complete serializable snapshot so every current and future node
 * kind contributes to the history budget. Multiplying JSON's UTF-16 code-unit
 * length by two is a stable conservative approximation for retained content;
 * the fixed allowance covers container/object overhead without pretending to
 * be an engine-specific heap measurement.
 */
export function estimateSnapshotBytes(snapshot: EditorSnapshot): number {
  const cached = estimatedBytes.get(snapshot);
  if (cached !== undefined) return cached;
  const serialized = JSON.stringify(snapshot);
  const bytes = serialized.length * 2 + (snapshot.nodes.length + snapshot.edges.length) * 128;
  estimatedBytes.set(snapshot, bytes);
  return bytes;
}

export function trimHistory(
  history: EditorSnapshot[],
  maxEntries = HISTORY_MAX_ENTRIES,
  maxBytes = HISTORY_MAX_BYTES,
): void {
  let bytes = history.reduce((total, item) => total + estimateSnapshotBytes(item), 0);
  while (history.length > maxEntries || (history.length > 1 && bytes > maxBytes)) {
    const removed = history.shift();
    if (removed) bytes -= estimateSnapshotBytes(removed);
  }
}
