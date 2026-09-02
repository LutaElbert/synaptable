import type {
  EditorCommandErrorCode,
  LayerSearchResult,
  WorkspaceSummary,
} from '../editor-commands';
import type { SafeEditorCommandExecution } from '../editor-command-safety';
import { WEBMCP_RESULT_MAX_BYTES } from './webmcp-schema';

export type WebMcpToolFailure = {
  ok: false;
  projectId: string;
  revision: number;
  code: EditorCommandErrorCode;
  summary: string;
  retryable: boolean;
  refreshRequired: boolean;
};

export type WebMcpMutationSuccess = {
  ok: true;
  projectId: string;
  revision: number;
  summary: string;
  affectedIds: string[];
  affectedCount: number;
  undoAvailable: true;
  warnings?: string[];
};

export type WebMcpWorkspaceSummarySuccess = {
  ok: true;
  projectId: string;
  revision: number;
  summary: string;
  data: Omit<WorkspaceSummary, 'projectId' | 'selectedIds'> & { selectedIds: string[] };
};

export type WebMcpLayerSearchSuccess = {
  ok: true;
  projectId: string;
  revision: number;
  summary: string;
  data: LayerSearchResult;
};

export type WebMcpToolResult =
  | WebMcpToolFailure
  | WebMcpMutationSuccess
  | WebMcpWorkspaceSummarySuccess
  | WebMcpLayerSearchSuccess;

export function webMcpSerializedBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function failurePolicy(code: EditorCommandErrorCode) {
  switch (code) {
    case 'CANCELLED':
      return { retryable: true, refreshRequired: false };
    case 'PROJECT_CHANGED':
    case 'STALE_REVISION':
    case 'NOT_FOUND':
    case 'PERSISTENCE_FAILED':
    case 'INTERNAL_ERROR':
      return { retryable: true, refreshRequired: true };
    case 'INVALID_INPUT':
    case 'PROTECTED_CONTENT':
    case 'LIMIT_EXCEEDED':
    case 'CONFLICT':
      return { retryable: false, refreshRequired: false };
  }
}

export function webMcpFailure(
  projectId: string,
  revision: number,
  code: EditorCommandErrorCode,
  summary: string,
): WebMcpToolFailure {
  const policy = failurePolicy(code);
  const result: WebMcpToolFailure = {
    ok: false,
    projectId: projectId.slice(0, 160),
    revision: Math.max(0, Number.isSafeInteger(revision) ? revision : 0),
    code,
    summary: summary.slice(0, 500),
    ...policy,
  };
  while (webMcpSerializedBytes(result) > WEBMCP_RESULT_MAX_BYTES && result.summary.length) {
    result.summary = result.summary.slice(0, Math.max(0, result.summary.length - 16));
  }
  return result;
}

export function webMcpMutationResult(
  execution: SafeEditorCommandExecution,
): WebMcpMutationSuccess | WebMcpToolFailure {
  if (!execution.result.ok) {
    return webMcpFailure(
      execution.projectId,
      execution.revision,
      execution.result.code,
      execution.result.summary,
    );
  }
  const originalCount = execution.result.affectedIds.length;
  const result: WebMcpMutationSuccess = {
    ok: true,
    projectId: execution.projectId.slice(0, 160),
    revision: execution.revision,
    summary: execution.result.summary.slice(0, 500),
    affectedIds: execution.result.affectedIds
      .filter(Boolean)
      .slice(0, 25)
      .map((id) => id.slice(0, 160)),
    affectedCount: originalCount,
    undoAvailable: true,
    ...(execution.result.warnings?.length
      ? { warnings: execution.result.warnings.slice(0, 3).map((warning) => warning.slice(0, 200)) }
      : {}),
  };
  while (webMcpSerializedBytes(result) > WEBMCP_RESULT_MAX_BYTES && result.affectedIds.length) {
    result.affectedIds.pop();
  }
  const omittedCount = originalCount - result.affectedIds.length;
  if (omittedCount > 0) {
    result.warnings = [
      ...(result.warnings ?? []).slice(0, 2),
      `${omittedCount} affected ${omittedCount === 1 ? 'ID was' : 'IDs were'} omitted from this result.`,
    ];
  }
  while (webMcpSerializedBytes(result) > WEBMCP_RESULT_MAX_BYTES && (result.warnings?.length ?? 0) > 1) {
    result.warnings?.shift();
  }
  while (webMcpSerializedBytes(result) > WEBMCP_RESULT_MAX_BYTES && result.summary.length > 80) {
    result.summary = `${result.summary.slice(0, Math.max(80, result.summary.length - 48)).trimEnd()}…`;
  }
  while (webMcpSerializedBytes(result) > WEBMCP_RESULT_MAX_BYTES && (result.warnings?.length ?? 0)) {
    result.warnings?.pop();
  }
  if (!result.warnings?.length) delete result.warnings;
  return result;
}

export function webMcpWorkspaceSummaryResult(
  projectId: string,
  revision: number,
  summary: WorkspaceSummary,
): WebMcpWorkspaceSummarySuccess {
  const result: WebMcpWorkspaceSummarySuccess = {
    ok: true,
    projectId: projectId.slice(0, 160),
    revision,
    summary: 'Workspace summary ready.',
    data: {
      projectName: summary.projectName.slice(0, 500),
      layerCount: summary.layerCount,
      connectorCount: summary.connectorCount,
      layerCounts: summary.layerCounts,
      selectedIds: summary.selectedIds.slice(0, 25).map((id) => id.slice(0, 160)),
      hiddenCount: summary.hiddenCount,
      lockedCount: summary.lockedCount,
    },
  };
  while (webMcpSerializedBytes(result) > WEBMCP_RESULT_MAX_BYTES && result.data.selectedIds.length) {
    result.data.selectedIds.pop();
  }
  while (webMcpSerializedBytes(result) > WEBMCP_RESULT_MAX_BYTES && result.data.projectName.length > 80) {
    result.data.projectName = `${result.data.projectName.slice(0, result.data.projectName.length - 32).trimEnd()}…`;
  }
  return result;
}

export function webMcpLayerSearchResult(
  projectId: string,
  revision: number,
  search: LayerSearchResult,
): WebMcpLayerSearchSuccess {
  const result: WebMcpLayerSearchSuccess = {
    ok: true,
    projectId: projectId.slice(0, 160),
    revision,
    summary: `${search.totalMatches} matching ${search.totalMatches === 1 ? 'layer' : 'layers'} found.`,
    data: {
      matches: search.matches.slice(0, 20).map((match) => ({
        ...match,
        id: match.id.slice(0, 160),
        name: match.name.slice(0, 80),
      })),
      totalMatches: search.totalMatches,
      truncated: search.truncated || search.matches.length > 20,
    },
  };
  while (webMcpSerializedBytes(result) > WEBMCP_RESULT_MAX_BYTES && result.data.matches.length) {
    result.data.matches.pop();
    result.data.truncated = true;
  }
  return result;
}
