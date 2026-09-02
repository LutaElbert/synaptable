import { EDITOR_COMMAND_ERROR_CODES } from './editor-commands';
import type {
  EditorCommand,
  EditorCommandErrorCode,
  EditorCommandOutcome,
  EditorCommandResult,
  EditorCommandState,
} from './editor-commands';

export const PUBLIC_COMMAND_RESULT_MAX_BYTES = 1_500;
const PUBLIC_SUMMARY_MAX_CHARACTERS = 500;
const PUBLIC_ID_MAX_CHARACTERS = 160;
const PUBLIC_WARNING_MAX_CHARACTERS = 200;
const PUBLIC_WARNING_LIMIT = 3;

export type EditorCommandSession = {
  projectId: string;
  revision: number;
  state: EditorCommandState;
};

export type EditorCommandRequest = {
  projectId: string;
  expectedRevision: number;
  signal?: AbortSignal;
  command: EditorCommand;
};

export type SafeEditorCommandExecution = EditorCommandOutcome & {
  projectId: string;
  revision: number;
  committed: boolean;
};

export type EditorReadRequest<T> = {
  projectId: string;
  expectedRevision: number;
  signal?: AbortSignal;
  read: (state: Readonly<EditorCommandState>) => T;
};

export type SafeEditorReadResult<T> =
  | { ok: true; projectId: string; revision: number; data: T }
  | {
    ok: false;
    projectId: string;
    revision: number;
    code: EditorCommandErrorCode;
    summary: string;
  };

function failedExecution(
  session: Readonly<EditorCommandSession>,
  code: EditorCommandErrorCode,
  summary: string,
): SafeEditorCommandExecution {
  return {
    projectId: session.projectId,
    revision: session.revision,
    nodes: session.state.nodes,
    edges: session.state.edges,
    committed: false,
    result: { ok: false, code, summary, affectedIds: [], undoAvailable: false },
  };
}

function requestIssue(
  session: Readonly<EditorCommandSession>,
  request: { projectId: string; expectedRevision: number; signal?: AbortSignal },
): { code: EditorCommandErrorCode; summary: string } | null {
  if (request.signal?.aborted) return { code: 'CANCELLED', summary: 'The command was cancelled.' };
  if (!request.projectId || request.projectId !== session.projectId) {
    return {
      code: 'PROJECT_CHANGED',
      summary: 'The active project changed. Refresh the workspace context and try again.',
    };
  }
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision !== session.revision) {
    return {
      code: 'STALE_REVISION',
      summary: 'The workspace changed. Refresh the workspace context and try again.',
    };
  }
  return null;
}

function validOutcome(outcome: EditorCommandOutcome): boolean {
  const result = outcome.result;
  return Array.isArray(outcome.nodes)
    && Array.isArray(outcome.edges)
    && typeof result?.ok === 'boolean'
    && (result.ok || EDITOR_COMMAND_ERROR_CODES.includes(result.code))
    && typeof result.summary === 'string'
    && Array.isArray(result.affectedIds)
    && result.affectedIds.every((id) => typeof id === 'string')
    && typeof result.undoAvailable === 'boolean'
    && (!result.warnings || (
      Array.isArray(result.warnings)
      && result.warnings.every((warning) => typeof warning === 'string')
    ));
}

export function executeEditorCommandSafely(
  session: Readonly<EditorCommandSession>,
  request: EditorCommandRequest,
): SafeEditorCommandExecution {
  const beforeIssue = requestIssue(session, request);
  if (beforeIssue) return failedExecution(session, beforeIssue.code, beforeIssue.summary);

  let outcome: EditorCommandOutcome;
  try {
    outcome = request.command(session.state);
  } catch {
    return failedExecution(session, 'INTERNAL_ERROR', 'The command could not be completed safely.');
  }

  if (request.signal?.aborted) return failedExecution(session, 'CANCELLED', 'The command was cancelled.');
  if (!validOutcome(outcome)) {
    return failedExecution(session, 'INTERNAL_ERROR', 'The command returned an invalid result.');
  }
  if (!outcome.result.ok) {
    return failedExecution(session, outcome.result.code, outcome.result.summary);
  }
  return {
    ...outcome,
    projectId: session.projectId,
    revision: session.revision + 1,
    committed: true,
  };
}

export function readEditorStateSafely<T>(
  session: Readonly<EditorCommandSession>,
  request: EditorReadRequest<T>,
): SafeEditorReadResult<T> {
  const issue = requestIssue(session, request);
  if (issue) {
    return {
      ok: false,
      projectId: session.projectId,
      revision: session.revision,
      code: issue.code,
      summary: issue.summary,
    };
  }
  try {
    const data = request.read(session.state);
    if (request.signal?.aborted) {
      return {
        ok: false,
        projectId: session.projectId,
        revision: session.revision,
        code: 'CANCELLED',
        summary: 'The command was cancelled.',
      };
    }
    return { ok: true, projectId: session.projectId, revision: session.revision, data };
  } catch {
    return {
      ok: false,
      projectId: session.projectId,
      revision: session.revision,
      code: 'INTERNAL_ERROR',
      summary: 'The workspace could not be read safely.',
    };
  }
}

function serializedBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function boundedPublicCommandResult(
  result: Readonly<EditorCommandResult>,
  maxBytes = PUBLIC_COMMAND_RESULT_MAX_BYTES,
): EditorCommandResult {
  const safeBudget = Number.isSafeInteger(maxBytes) && maxBytes >= 256
    ? Math.min(maxBytes, PUBLIC_COMMAND_RESULT_MAX_BYTES)
    : PUBLIC_COMMAND_RESULT_MAX_BYTES;
  const originalAffectedCount = result.affectedIds.length;
  const common = {
    summary: result.summary.slice(0, PUBLIC_SUMMARY_MAX_CHARACTERS),
    affectedIds: result.affectedIds
      .filter((id) => typeof id === 'string' && id.length > 0)
      .map((id) => id.slice(0, PUBLIC_ID_MAX_CHARACTERS)),
    undoAvailable: result.undoAvailable,
    warnings: result.warnings
      ?.filter((warning) => typeof warning === 'string' && warning.length > 0)
      .slice(0, PUBLIC_WARNING_LIMIT)
      .map((warning) => warning.slice(0, PUBLIC_WARNING_MAX_CHARACTERS)),
  };
  const output: EditorCommandResult = result.ok
    ? { ok: true, ...common }
    : { ok: false, code: result.code, ...common };

  while (serializedBytes(output) > safeBudget && output.affectedIds.length) {
    output.affectedIds.pop();
  }
  const omittedCount = originalAffectedCount - output.affectedIds.length;
  if (omittedCount > 0) {
    output.warnings = [
      ...(output.warnings ?? []).slice(0, PUBLIC_WARNING_LIMIT - 1),
      `${omittedCount} affected ${omittedCount === 1 ? 'ID was' : 'IDs were'} omitted from this summary.`,
    ];
  }
  while (serializedBytes(output) > safeBudget && (output.warnings?.length ?? 0) > 1) {
    output.warnings?.shift();
  }
  while (serializedBytes(output) > safeBudget && output.summary.length > 80) {
    output.summary = `${output.summary.slice(0, Math.max(80, output.summary.length - 80)).trimEnd()}…`;
  }
  while (serializedBytes(output) > safeBudget && (output.warnings?.length ?? 0) > 0) {
    output.warnings?.pop();
  }
  while (serializedBytes(output) > safeBudget && output.summary.length > 0) {
    output.summary = output.summary.slice(0, Math.max(0, output.summary.length - 16));
  }
  if (!output.warnings?.length) delete output.warnings;
  return output;
}

export type QueuedEditorCommand = {
  getSession: () => EditorCommandSession;
  request: EditorCommandRequest;
  commit: (execution: SafeEditorCommandExecution) => void | Promise<void>;
};

export class EditorCommandQueue {
  #tail: Promise<void> = Promise.resolve();

  /**
   * Runs one pure command at a time and awaits its atomic persistence/publish
   * callback before the next queued request can inspect the current session.
   */
  enqueue({ getSession, request, commit }: QueuedEditorCommand): Promise<SafeEditorCommandExecution> {
    const run = this.#tail
      .catch(() => undefined)
      .then(async () => {
        const execution = executeEditorCommandSafely(getSession(), request);
        if (!execution.committed) return execution;
        try {
          await commit(execution);
          return execution;
        } catch {
          const current = getSession();
          if (request.signal?.aborted) {
            return failedExecution(current, 'CANCELLED', 'The command was cancelled.');
          }
          return failedExecution(current, 'PERSISTENCE_FAILED', 'The command could not be saved safely.');
        }
      });
    this.#tail = run.then(() => undefined, () => undefined);
    return run;
  }
}
