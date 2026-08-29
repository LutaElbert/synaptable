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
    expect(restored.schemaVersion).toBe(3);
  });

  it('migrates version 1 projects to rich-title document version 3', () => {
    const legacy = structuredClone(initialDocument) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    const nodes = legacy.nodes as Array<{ data: Record<string, unknown> }>;
    for (const node of nodes) {
      delete node.data.body;
      delete node.data.collapsed;
      delete node.data.title;
    }
    const migrated = validateEditorDocument(legacy);
    expect(migrated.schemaVersion).toBe(3);
    const concept = migrated.nodes.find((node) => node.data.kind === 'concept');
    expect(concept?.data.kind === 'concept' && concept.data.body.type).toBe('doc');
    expect(concept?.data.kind === 'concept' && concept.data.title.type).toBe('doc');
  });

  it('migrates version 2 labels into formatted version 3 titles', () => {
    const legacy = structuredClone(initialDocument) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 2;
    const nodes = legacy.nodes as Array<{ data: Record<string, unknown> }>;
    for (const node of nodes) delete node.data.title;
    const migrated = validateEditorDocument(legacy);
    const concept = migrated.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    expect(migrated.schemaVersion).toBe(3);
    expect(concept.data.title.content?.[0].content?.[0].marks).toEqual([{ type: 'bold' }]);
  });

  it('rejects multiline concept titles', () => {
    const invalid = structuredClone(initialDocument);
    const concept = invalid.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.title = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
      ],
    };
    expect(() => validateEditorDocument(invalid)).toThrow('single line');
  });

  it('rejects unsafe links in concept titles', () => {
    const unsafe = structuredClone(initialDocument);
    const concept = unsafe.nodes.find((node) => node.data.kind === 'concept');
    if (!concept || concept.data.kind !== 'concept') throw new Error('Missing concept fixture.');
    concept.data.title.content = [{
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'unsafe',
        marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
      }],
    }];
    expect(() => validateEditorDocument(unsafe)).toThrow('unsafe link');
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

  it.each([
    {
      name: 'duplicate connector ids',
      message: 'duplicate connector ids',
      mutate(document: typeof initialDocument) {
        document.edges[1].id = document.edges[0].id;
      },
    },
    {
      name: 'missing connector endpoints',
      message: 'missing layer',
      mutate(document: typeof initialDocument) {
        document.edges[0].target = 'missing-layer';
      },
    },
    {
      name: 'self-connections',
      message: 'layer to itself',
      mutate(document: typeof initialDocument) {
        document.edges[0].target = document.edges[0].source;
      },
    },
    {
      name: 'duplicate directed connectors',
      message: 'duplicate directed connectors',
      mutate(document: typeof initialDocument) {
        document.edges[1].source = document.edges[0].source;
        document.edges[1].target = document.edges[0].target;
      },
    },
  ])('rejects $name in portable backups', ({ message, mutate }) => {
    const document = structuredClone(initialDocument);
    mutate(document);
    const envelope = JSON.stringify({
      format: 'synaptable-project',
      version: 2,
      document,
    });
    expect(() => parseProjectBackup(envelope)).toThrow(message);
  });

  it('repairs invalid local graph edges without losing valid layers', () => {
    const local = structuredClone(initialDocument);
    local.edges.push({ ...structuredClone(local.edges[0]), id: 'duplicate-pair' });
    local.edges.push({ ...structuredClone(local.edges[0]), id: 'orphan', target: 'missing-layer' });
    const repaired = validateEditorDocument(local);
    expect(repaired.nodes).toHaveLength(local.nodes.length);
    expect(repaired.edges).toHaveLength(initialDocument.edges.length);
  });

  it('rejects unsupported project envelopes', () => {
    expect(() => parseProjectBackup('{"format":"another-app","version":1}')).toThrow(
      'not a supported SynapTable',
    );
  });
});
