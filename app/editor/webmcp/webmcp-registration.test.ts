import { describe, expect, it, vi } from 'vitest';
import type { EditorCommandSession } from '../editor-command-safety';
import { registerApprovedWebMcpTools } from './webmcp-registration';
import type { WebMcpToolRuntime } from './webmcp-tools';
import type { WebMcpModelContext, WebMcpRegisterOptions, WebMcpToolDefinition } from './webmcp-types';

function runtime(): WebMcpToolRuntime {
  const session: EditorCommandSession = {
    projectId: 'project-a',
    revision: 0,
    state: { nodes: [], edges: [] },
  };
  return {
    getSession: () => session,
    getProjectName: () => 'Project',
    getCanvasCenter: () => ({ x: 0, y: 0 }),
    executeCommand: async () => ({
      ...session.state,
      projectId: session.projectId,
      revision: session.revision,
      committed: false,
      result: {
        ok: false,
        code: 'INTERNAL_ERROR',
        summary: 'Not used.',
        affectedIds: [],
        undoAvailable: false,
      },
    }),
    notify: () => undefined,
  };
}

describe('WebMCP registration lifecycle', () => {
  it('registers exactly six tools with one cleanup signal and no cross-origin option', async () => {
    const registrations: Array<{ definition: WebMcpToolDefinition; options?: WebMcpRegisterOptions }> = [];
    const modelContext: WebMcpModelContext = {
      registerTool: vi.fn((definition, options) => {
        registrations.push({ definition, options });
      }),
    };
    const controller = new AbortController();
    await registerApprovedWebMcpTools({ modelContext, runtime: runtime(), signal: controller.signal });

    expect(registrations).toHaveLength(6);
    expect(registrations.every(({ options }) => options?.signal === controller.signal)).toBe(true);
    expect(registrations.every(({ options }) => !('exposedTo' in (options ?? {})))).toBe(true);
    expect(registrations.map(({ definition }) => definition.name)).toEqual([
      'get_workspace_summary',
      'find_layers',
      'create_concept',
      'create_table',
      'organize_layers_into_table',
      'create_canvas_nodes_from_rows',
    ]);
    controller.abort();
    expect(registrations.every(({ options }) => options?.signal.aborted)).toBe(true);
  });

  it('does not register after cleanup has already occurred', async () => {
    const registerTool = vi.fn();
    const controller = new AbortController();
    controller.abort();
    await registerApprovedWebMcpTools({
      modelContext: { registerTool },
      runtime: runtime(),
      signal: controller.signal,
    });
    expect(registerTool).not.toHaveBeenCalled();
  });

  it('stops a late asynchronous registration sequence after abort', async () => {
    const controller = new AbortController();
    const names: string[] = [];
    const modelContext: WebMcpModelContext = {
      registerTool: async (definition) => {
        names.push(definition.name);
        controller.abort();
      },
    };
    await registerApprovedWebMcpTools({ modelContext, runtime: runtime(), signal: controller.signal });
    expect(names).toEqual(['get_workspace_summary']);
  });

  it('leaves one live tool set after a strict-mode style cleanup and remount', async () => {
    const registrations: Array<{ name: string; signal: AbortSignal }> = [];
    const modelContext: WebMcpModelContext = {
      registerTool: (definition, options) => {
        if (!options) throw new Error('Expected cleanup signal.');
        registrations.push({ name: definition.name, signal: options.signal });
      },
    };
    const first = new AbortController();
    await registerApprovedWebMcpTools({ modelContext, runtime: runtime(), signal: first.signal });
    first.abort();
    const second = new AbortController();
    await registerApprovedWebMcpTools({ modelContext, runtime: runtime(), signal: second.signal });

    expect(registrations.filter(({ signal }) => !signal.aborted)).toHaveLength(6);
    expect(new Set(registrations.filter(({ signal }) => !signal.aborted).map(({ name }) => name)).size).toBe(6);
  });
});
