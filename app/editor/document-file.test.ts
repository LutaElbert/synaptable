import { describe, expect, it } from 'vitest';
import { initialDocument } from './initial-document';
import {
  parseProjectBackup,
  serializeProjectBackup,
  validateEditorDocument,
} from './document-file';

describe('SynapTable project backups', () => {
  it('round-trips a valid document through the portable envelope', () => {
    const source = serializeProjectBackup(initialDocument);
    const restored = parseProjectBackup(source);

    expect(restored.title).toBe(initialDocument.title);
    expect(restored.nodes).toHaveLength(initialDocument.nodes.length);
    expect(restored.edges).toHaveLength(initialDocument.edges.length);
    expect(restored.nodes.every((node) => node.selected === false)).toBe(true);
    expect(restored.schemaVersion).toBe(2);
  });

  it('migrates version 1 projects to rich-text document version 2', () => {
    const legacy = structuredClone(initialDocument) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    const nodes = legacy.nodes as Array<{ data: Record<string, unknown> }>;
    for (const node of nodes) {
      delete node.data.body;
      delete node.data.collapsed;
    }
    const migrated = validateEditorDocument(legacy);
    expect(migrated.schemaVersion).toBe(2);
    const concept = migrated.nodes.find((node) => node.data.kind === 'concept');
    expect(concept?.data.kind === 'concept' && concept.data.body.type).toBe('doc');
  });

  it('rejects unsafe rich-text links', () => {
    const unsafe = structuredClone(initialDocument);
    const concept = unsafe.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.body = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{
        type: 'text',
        text: 'unsafe',
        marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
      }] }],
    };
    expect(() => validateEditorDocument(unsafe)).toThrow('unsafe link');
  });

  it('rejects duplicate layer ids', () => {
    const duplicate = structuredClone(initialDocument);
    duplicate.nodes[1].id = duplicate.nodes[0].id;
    expect(() => validateEditorDocument(duplicate)).toThrow('duplicate layer ids');
  });

  it('rejects unsupported project envelopes', () => {
    expect(() => parseProjectBackup('{"format":"another-app","version":1}')).toThrow(
      'not a supported SynapTable',
    );
  });
});
