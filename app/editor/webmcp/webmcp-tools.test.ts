// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { initialDocument } from '../initial-document';
import { executeEditorCommandSafely, type EditorCommandSession } from '../editor-command-safety';
import type { EditorNode } from '../types';
import { createApprovedWebMcpToolDefinitions, executeApprovedWebMcpTool, type WebMcpToolRuntime } from './webmcp-tools';

function runtimeFixture() {
  let session: EditorCommandSession = {
    projectId: 'project-a',
    revision: 0,
    state: {
      nodes: structuredClone(initialDocument.nodes),
      edges: structuredClone(initialDocument.edges),
    },
  };
  const notify = vi.fn();
  const runtime: WebMcpToolRuntime = {
    getSession: () => session,
    getProjectName: () => 'Private film plan',
    getCanvasCenter: () => ({ x: 500, y: 300 }),
    executeCommand: async (request) => {
      const execution = executeEditorCommandSafely(session, request);
      if (execution.committed) {
        session = {
          projectId: execution.projectId,
          revision: execution.revision,
          state: { nodes: execution.nodes, edges: execution.edges },
        };
      }
      return execution;
    },
    notify,
  };
  return {
    runtime,
    notify,
    session: () => session,
    setNodes: (nodes: EditorNode[]) => {
      session = { ...session, state: { ...session.state, nodes } };
    },
  };
}

function options(signal = new AbortController().signal) {
  return { signal };
}

describe('approved WebMCP canvas tools', () => {
  it('creates exactly the six catalog definitions with approved annotations', () => {
    const { runtime } = runtimeFixture();
    const definitions = createApprovedWebMcpToolDefinitions(runtime);
    expect(definitions.map((definition) => definition.name)).toEqual([
      'get_workspace_summary',
      'find_layers',
      'create_concept',
      'create_table',
      'organize_layers_into_table',
      'create_canvas_nodes_from_rows',
    ]);
    expect(definitions.slice(0, 2).every((definition) => definition.annotations?.readOnlyHint)).toBe(true);
    expect(definitions.slice(2).every((definition) => definition.annotations?.readOnlyHint === false)).toBe(true);
    expect(definitions.every((definition) => definition.annotations?.untrustedContentHint)).toBe(true);
  });

  it('supports the native one-argument execute callback', async () => {
    const { runtime } = runtimeFixture();
    const summary = createApprovedWebMcpToolDefinitions(runtime)
      .find((definition) => definition.name === 'get_workspace_summary');
    await expect(summary?.execute({})).resolves.toMatchObject({
      ok: true,
      projectId: 'project-a',
      revision: 0,
    });
  });

  it('bootstraps only the active workspace with bounded counts and no bodies', async () => {
    const { runtime } = runtimeFixture();
    const result = await executeApprovedWebMcpTool('get_workspace_summary', {}, options(), runtime);
    expect(result).toMatchObject({
      ok: true,
      projectId: 'project-a',
      revision: 0,
      data: { projectName: 'Private film plan', layerCount: 3 },
    });
    expect(JSON.stringify(result)).not.toContain('Starting point');
  });

  it('finds visible layers while keeping searchable bodies out of results', async () => {
    const fixture = runtimeFixture();
    const first = fixture.session().state.nodes[0];
    if (first.data.kind !== 'concept') throw new Error('Expected concept fixture.');
    first.data.body = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'SECRET NEEDLE' }] }],
    };
    const result = await executeApprovedWebMcpTool('find_layers', {
      projectId: 'project-a',
      expectedRevision: 0,
      query: 'secret needle',
    }, options(), fixture.runtime);
    expect(result).toMatchObject({ ok: true, data: { totalMatches: 1 } });
    expect(JSON.stringify(result)).not.toContain('SECRET NEEDLE');
  });

  it('creates a concept at the visible center and rejects stale replay', async () => {
    const fixture = runtimeFixture();
    const input = {
      projectId: 'project-a',
      expectedRevision: 0,
      title: 'Agent beat',
    };
    const created = await executeApprovedWebMcpTool('create_concept', input, options(), fixture.runtime);
    expect(created).toMatchObject({ ok: true, revision: 1, affectedCount: 1, undoAvailable: true });
    expect(fixture.session().state.nodes.at(-1)).toMatchObject({
      position: { x: 406, y: 261 },
      data: { name: 'Agent beat' },
    });

    const replay = await executeApprovedWebMcpTool('create_concept', input, options(), fixture.runtime);
    expect(replay).toMatchObject({ ok: false, code: 'STALE_REVISION', refreshRequired: true });
    expect(fixture.session().state.nodes.filter((node) => node.data.name === 'Agent beat')).toHaveLength(1);
  });

  it('creates a bounded table with plain values and one revision advance', async () => {
    const fixture = runtimeFixture();
    const result = await executeApprovedWebMcpTool('create_table', {
      projectId: 'project-a',
      expectedRevision: 0,
      name: 'Agent scenes',
      rows: 2,
      columns: 2,
      values: [['Scene', 'Status'], ['Opening', '=EXECUTE()']],
    }, options(), fixture.runtime);
    expect(result).toMatchObject({ ok: true, revision: 1, affectedCount: 1 });
    const table = fixture.session().state.nodes.at(-1);
    expect(table?.data).toMatchObject({ kind: 'table', name: 'Agent scenes' });
    expect(JSON.stringify(table?.data)).toContain('=EXECUTE()');
  });

  it('organizes explicit visible layers and keeps every original unchanged', async () => {
    const fixture = runtimeFixture();
    const originals = structuredClone(fixture.session().state);
    const result = await executeApprovedWebMcpTool('organize_layers_into_table', {
      projectId: 'project-a',
      expectedRevision: 0,
      layerIds: ['research', 'layers'],
    }, options(), fixture.runtime);
    expect(result).toMatchObject({ ok: true, revision: 1, affectedCount: 1 });
    expect(fixture.session().state.nodes.slice(0, originals.nodes.length).map((node) => ({
      ...node,
      selected: originals.nodes.find((original) => original.id === node.id)?.selected,
    }))).toEqual(originals.nodes);
    expect(fixture.session().state.edges).toEqual(originals.edges);
  });

  it('creates concepts from explicit data rows and preserves the source table', async () => {
    const fixture = runtimeFixture();
    const tableResult = await executeApprovedWebMcpTool('create_table', {
      projectId: 'project-a',
      expectedRevision: 0,
      name: 'Scenes',
      rows: 2,
      columns: 2,
      values: [['Scene', 'Status'], ['Opening', 'Ready']],
    }, options(), fixture.runtime);
    if (!tableResult.ok || !('affectedIds' in tableResult)) throw new Error('Expected created table.');
    const table = fixture.session().state.nodes.find((node) => node.id === tableResult.affectedIds[0]);
    if (!table || table.data.kind !== 'table') throw new Error('Expected table fixture.');
    const before = structuredClone(table);
    const converted = await executeApprovedWebMcpTool('create_canvas_nodes_from_rows', {
      projectId: 'project-a',
      expectedRevision: 1,
      tableId: table.id,
      rowIndexes: [1],
      columnIndexes: [0, 1],
    }, options(), fixture.runtime);
    expect(converted).toMatchObject({ ok: true, revision: 2, affectedCount: 1 });
    const sourceAfter = fixture.session().state.nodes.find((node) => node.id === table.id);
    expect(sourceAfter?.data).toEqual(before.data);
    expect(fixture.session().state.nodes.at(-1)?.data).toMatchObject({ kind: 'concept', name: 'Opening' });
  });

  it('rejects header rows, protected layers, wrong projects, and cancellation atomically', async () => {
    const fixture = runtimeFixture();
    const locked = structuredClone(fixture.session().state.nodes);
    locked[0].data.locked = true;
    fixture.setNodes(locked);
    const protectedResult = await executeApprovedWebMcpTool('organize_layers_into_table', {
      projectId: 'project-a',
      expectedRevision: 0,
      layerIds: [locked[0].id],
    }, options(), fixture.runtime);
    expect(protectedResult).toMatchObject({ ok: false, code: 'PROTECTED_CONTENT' });

    const wrongProject = await executeApprovedWebMcpTool('find_layers', {
      projectId: 'project-b',
      expectedRevision: 0,
    }, options(), fixture.runtime);
    expect(wrongProject).toMatchObject({ ok: false, code: 'PROJECT_CHANGED' });
    expect(JSON.stringify(wrongProject)).not.toContain('Private film plan');

    const controller = new AbortController();
    controller.abort();
    const cancelled = await executeApprovedWebMcpTool('create_concept', {
      projectId: 'project-a',
      expectedRevision: 0,
    }, options(controller.signal), fixture.runtime);
    expect(cancelled).toMatchObject({ ok: false, code: 'CANCELLED' });
    expect(fixture.session().revision).toBe(0);
  });

  it('rejects an explicit table header row before creating any nodes', async () => {
    const fixture = runtimeFixture();
    const tableResult = await executeApprovedWebMcpTool('create_table', {
      projectId: 'project-a',
      expectedRevision: 0,
      rows: 2,
      columns: 1,
      values: [['Scene'], ['Opening']],
    }, options(), fixture.runtime);
    if (!tableResult.ok || !('affectedIds' in tableResult)) throw new Error('Expected table.');
    const table = fixture.session().state.nodes.find((node) => node.id === tableResult.affectedIds[0]);
    if (!table || table.data.kind !== 'table') throw new Error('Expected table.');
    const count = fixture.session().state.nodes.length;
    const result = await executeApprovedWebMcpTool('create_canvas_nodes_from_rows', {
      projectId: 'project-a',
      expectedRevision: 1,
      tableId: table.id,
      rowIndexes: [0],
      columnIndexes: [0],
    }, options(), fixture.runtime);
    expect(result).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
    expect(fixture.session().state.nodes).toHaveLength(count);
  });
});
