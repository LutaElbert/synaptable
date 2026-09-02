import {
  createCanvasNodesFromRowIndexesCommand,
  createConceptCommand,
  createTableCommand,
  findLayers,
  getWorkspaceSummary,
  organizeLayersIntoTableCommand,
  type EditorCommand,
} from '../editor-commands';
import {
  readEditorStateSafely,
  type EditorCommandRequest,
  type EditorCommandSession,
  type SafeEditorCommandExecution,
} from '../editor-command-safety';
import type { NodePosition } from '../node-layout';
import {
  webMcpFailure,
  webMcpLayerSearchResult,
  webMcpMutationResult,
  webMcpWorkspaceSummaryResult,
  type WebMcpToolResult,
} from './webmcp-results';
import {
  WEBMCP_CATALOG_TOOLS,
  validateWebMcpInput,
  type ApprovedWebMcpToolName,
} from './webmcp-schema';
import type { WebMcpExecuteOptions, WebMcpToolDefinition } from './webmcp-types';

type ProjectContextInput = {
  projectId: string;
  expectedRevision: number;
};

type FindLayersInput = ProjectContextInput & {
  query: string;
  kinds?: Array<'concept' | 'raster' | 'vector' | 'table'>;
  limit: number;
};

type CreateConceptInput = ProjectContextInput & {
  title: string;
  body: string;
  eyebrow: string;
  position?: NodePosition;
};

type CreateTableInput = ProjectContextInput & {
  name?: string;
  rows: number;
  columns: number;
  headerRow: boolean;
  values: string[][];
  position?: NodePosition;
};

type OrganizeLayersInput = ProjectContextInput & {
  layerIds: string[];
  name: string;
};

type CreateNodesFromRowsInput = ProjectContextInput & {
  tableId: string;
  rowIndexes: number[];
  columnIndexes: number[];
};

const NEVER_ABORTED_SIGNAL = new AbortController().signal;

export type WebMcpToolRuntime = {
  getSession: () => EditorCommandSession;
  getProjectName: () => string;
  getCanvasCenter: () => NodePosition;
  executeCommand: (request: EditorCommandRequest) => Promise<SafeEditorCommandExecution>;
  notify: (summary: string, tone: 'success' | 'error') => void;
};

function contextFrom(value: Record<string, unknown>): ProjectContextInput {
  return value as ProjectContextInput;
}

function cancelled(runtime: WebMcpToolRuntime) {
  const session = runtime.getSession();
  return webMcpFailure(session.projectId, session.revision, 'CANCELLED', 'The command was cancelled.');
}

function invalidInputResult(
  runtime: WebMcpToolRuntime,
  issue: Exclude<ReturnType<typeof validateWebMcpInput>, { ok: true }>,
) {
  const session = runtime.getSession();
  return webMcpFailure(session.projectId, session.revision, issue.code, issue.summary);
}

function isMutationTool(name: ApprovedWebMcpToolName): boolean {
  return name !== 'get_workspace_summary' && name !== 'find_layers';
}

async function executeMutation(
  runtime: WebMcpToolRuntime,
  context: ProjectContextInput,
  command: EditorCommand,
  signal: AbortSignal,
): Promise<WebMcpToolResult> {
  const execution = await runtime.executeCommand({ ...context, command, signal });
  const result = webMcpMutationResult(execution);
  runtime.notify(result.summary, result.ok ? 'success' : 'error');
  return result;
}

export async function executeApprovedWebMcpTool(
  name: ApprovedWebMcpToolName,
  input: unknown,
  options: WebMcpExecuteOptions | undefined,
  runtime: WebMcpToolRuntime,
): Promise<WebMcpToolResult> {
  const signal = options?.signal ?? NEVER_ABORTED_SIGNAL;
  if (signal.aborted) return cancelled(runtime);
  const validation = validateWebMcpInput(name, input);
  if (!validation.ok) {
    const result = invalidInputResult(runtime, validation);
    if (isMutationTool(name)) runtime.notify(result.summary, 'error');
    return result;
  }
  if (signal.aborted) return cancelled(runtime);
  const value = validation.value;

  switch (name) {
    case 'get_workspace_summary': {
      const session = runtime.getSession();
      if (!session.projectId) {
        return webMcpFailure('', session.revision, 'PROJECT_CHANGED', 'No active project is available.');
      }
      const read = readEditorStateSafely(session, {
        projectId: session.projectId,
        expectedRevision: session.revision,
        signal,
        read: (state) => getWorkspaceSummary(state, {
          projectId: session.projectId,
          projectName: runtime.getProjectName(),
        }),
      });
      return read.ok
        ? webMcpWorkspaceSummaryResult(read.projectId, read.revision, read.data)
        : webMcpFailure(read.projectId, read.revision, read.code, read.summary);
    }
    case 'find_layers': {
      const normalized = value as FindLayersInput;
      const session = runtime.getSession();
      const read = readEditorStateSafely(session, {
        projectId: normalized.projectId,
        expectedRevision: normalized.expectedRevision,
        signal,
        read: (state) => findLayers(state, {
          query: normalized.query,
          kinds: normalized.kinds,
          limit: normalized.limit,
        }),
      });
      return read.ok
        ? webMcpLayerSearchResult(read.projectId, read.revision, read.data)
        : webMcpFailure(read.projectId, read.revision, read.code, read.summary);
    }
    case 'create_concept': {
      const normalized = value as CreateConceptInput;
      return executeMutation(runtime, contextFrom(value), createConceptCommand({
        center: normalized.position ?? runtime.getCanvasCenter(),
        title: normalized.title,
        body: normalized.body,
        eyebrow: normalized.eyebrow,
      }), signal);
    }
    case 'create_table': {
      const normalized = value as CreateTableInput;
      return executeMutation(runtime, contextFrom(value), createTableCommand({
        center: normalized.position ?? runtime.getCanvasCenter(),
        name: normalized.name,
        rows: normalized.rows,
        columns: normalized.columns,
        headerRow: normalized.headerRow,
        values: normalized.values,
      }), signal);
    }
    case 'organize_layers_into_table': {
      const normalized = value as OrganizeLayersInput;
      return executeMutation(runtime, contextFrom(value), organizeLayersIntoTableCommand({
        layerIds: normalized.layerIds,
        name: normalized.name,
      }), signal);
    }
    case 'create_canvas_nodes_from_rows': {
      const normalized = value as CreateNodesFromRowsInput;
      return executeMutation(runtime, contextFrom(value), createCanvasNodesFromRowIndexesCommand({
        tableId: normalized.tableId,
        rowIndexes: normalized.rowIndexes,
        columnIndexes: normalized.columnIndexes,
      }), signal);
    }
  }
}

export function createApprovedWebMcpToolDefinitions(
  runtime: WebMcpToolRuntime,
): WebMcpToolDefinition[] {
  return WEBMCP_CATALOG_TOOLS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: (input, options) => executeApprovedWebMcpTool(tool.name, input, options, runtime),
    annotations: tool.annotations,
  }));
}
