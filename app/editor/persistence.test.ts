import { describe, expect, it } from 'vitest';
import {
  checkpointIdsToPrune,
  MAX_CHECKPOINT_BYTES,
  serializedDocumentBytes,
  type LocalCheckpoint,
} from './persistence';
import { initialDocument } from './initial-document';

function checkpoint(id: string, createdAt: number, bytes: number): LocalCheckpoint {
  return { id, projectId: 'project', createdAt, bytes, title: id, document: structuredClone(initialDocument) };
}

describe('checkpoint budgets', () => {
  it('measures the validated serialized document payload', () => {
    const document = structuredClone(initialDocument);
    const before = serializedDocumentBytes(document);
    if (document.nodes[0].data.kind !== 'concept') throw new Error('Expected a concept fixture.');
    document.nodes[0].data.body = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A'.repeat(2_000) }] }],
    };
    expect(serializedDocumentBytes(document)).toBeGreaterThan(before + 1_900);
  });

  it('prunes oldest checkpoints by count', () => {
    const checkpoints = Array.from({ length: 4 }, (_, index) => checkpoint(String(index), index, 100));
    expect(checkpointIdsToPrune(checkpoints, 2, MAX_CHECKPOINT_BYTES)).toEqual(['0', '1']);
  });

  it('prunes oldest checkpoints by aggregate bytes and preserves the newest', () => {
    const checkpoints = [checkpoint('old', 1, 60), checkpoint('middle', 2, 60), checkpoint('new', 3, 60)];
    expect(checkpointIdsToPrune(checkpoints, 20, 120)).toEqual(['old']);
    expect(checkpointIdsToPrune(checkpoints, 20, 1)).toEqual(['old', 'middle']);
  });
});
