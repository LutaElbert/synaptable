import catalogSource from '../../../WEBMCP_TOOL_SCHEMAS.json';
import type { EditorCommandErrorCode } from '../editor-commands';
import type { WebMcpToolAnnotations } from './webmcp-types';
import * as standaloneValidators from './webmcp-validators.generated.js';

export const WEBMCP_INPUT_MAX_BYTES = 256 * 1024;
export const WEBMCP_TABLE_MAX_INITIAL_CHARACTERS = 100_000;

export const APPROVED_WEBMCP_TOOL_NAMES = [
  'get_workspace_summary',
  'find_layers',
  'create_concept',
  'create_table',
  'organize_layers_into_table',
  'create_canvas_nodes_from_rows',
] as const;

export type ApprovedWebMcpToolName = (typeof APPROVED_WEBMCP_TOOL_NAMES)[number];

export type WebMcpCatalogTool = {
  name: ApprovedWebMcpToolName;
  title: string;
  description: string;
  riskClass: 'read-only' | 'reversible-mutation';
  annotations: WebMcpToolAnnotations;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
};

type ValidationSuccess = { ok: true; value: Record<string, unknown> };
type ValidationFailure = { ok: false; code: EditorCommandErrorCode; summary: string };
export type WebMcpInputValidation = ValidationSuccess | ValidationFailure;
type StandaloneValidator = ((value: unknown) => boolean) & {
  errors?: Array<{ instancePath: string; keyword: string }> | null;
};

const catalog = catalogSource as unknown as {
  catalogVersion: string;
  resultBudgetBytes: number;
  tools: WebMcpCatalogTool[];
};

const approvedNames = new Set<string>(APPROVED_WEBMCP_TOOL_NAMES);

if (
  catalog.tools.length !== APPROVED_WEBMCP_TOOL_NAMES.length
  || catalog.tools.some((tool) => !approvedNames.has(tool.name))
  || new Set(catalog.tools.map((tool) => tool.name)).size !== APPROVED_WEBMCP_TOOL_NAMES.length
) {
  throw new Error('The WebMCP tool catalog does not match the approved tool set.');
}

const validators = new Map<ApprovedWebMcpToolName, StandaloneValidator>(
  APPROVED_WEBMCP_TOOL_NAMES.map((name) => [name, standaloneValidators[name] as StandaloneValidator]),
);

export const WEBMCP_CATALOG_VERSION = catalog.catalogVersion;
export const WEBMCP_RESULT_MAX_BYTES = Math.min(1_500, catalog.resultBudgetBytes);
export const WEBMCP_CATALOG_TOOLS = catalog.tools;

function serializedBytes(value: unknown): number | null {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? new TextEncoder().encode(serialized).byteLength : null;
  } catch {
    return null;
  }
}

function validationCode(validator: StandaloneValidator): EditorCommandErrorCode {
  if (validator.errors?.some((error) => error.instancePath.startsWith('/position'))) {
    return 'INVALID_INPUT';
  }
  return validator.errors?.some((error) => [
    'maxItems',
    'maxLength',
    'maximum',
  ].includes(error.keyword))
    ? 'LIMIT_EXCEEDED'
    : 'INVALID_INPUT';
}

function tableRuntimeIssue(value: Record<string, unknown>): ValidationFailure | null {
  const rows = value.rows as number;
  const columns = value.columns as number;
  if (rows * columns > 2_000) {
    return { ok: false, code: 'LIMIT_EXCEEDED', summary: 'A table can contain at most 2,000 cells.' };
  }
  const values = (value.values ?? []) as string[][];
  value.values = values;
  if (values.length > rows || values.some((row) => row.length > columns)) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      summary: 'Initial values exceed the requested table dimensions.',
    };
  }
  const characters = values.reduce(
    (total, row) => total + row.reduce((rowTotal, cell) => rowTotal + cell.length, 0),
    0,
  );
  if (characters > WEBMCP_TABLE_MAX_INITIAL_CHARACTERS) {
    return {
      ok: false,
      code: 'LIMIT_EXCEEDED',
      summary: `Initial table values can contain at most ${WEBMCP_TABLE_MAX_INITIAL_CHARACTERS.toLocaleString()} characters.`,
    };
  }
  return null;
}

function validPosition(value: Record<string, unknown>): boolean {
  const position = value.position;
  if (position === undefined) return true;
  if (!position || typeof position !== 'object') return false;
  const { x, y } = position as { x?: unknown; y?: unknown };
  return typeof x === 'number'
    && typeof y === 'number'
    && Number.isFinite(x)
    && Number.isFinite(y)
    && Math.abs(x) <= 1_000_000
    && Math.abs(y) <= 1_000_000;
}

export function validateWebMcpInput(
  name: ApprovedWebMcpToolName,
  input: unknown,
): WebMcpInputValidation {
  const bytes = serializedBytes(input);
  if (bytes === null) {
    return { ok: false, code: 'INVALID_INPUT', summary: 'Tool input must be a JSON object.' };
  }
  if (bytes > WEBMCP_INPUT_MAX_BYTES) {
    return { ok: false, code: 'LIMIT_EXCEEDED', summary: 'Tool input exceeds the 256 KiB limit.' };
  }

  let value: unknown;
  try {
    value = structuredClone(input);
  } catch {
    return { ok: false, code: 'INVALID_INPUT', summary: 'Tool input must contain valid structured data.' };
  }
  const validator = validators.get(name);
  if (!validator || !validator(value)) {
    return {
      ok: false,
      code: validator ? validationCode(validator) : 'INVALID_INPUT',
      summary: 'Tool input does not match the approved schema.',
    };
  }
  const normalized = value as Record<string, unknown>;
  if (!validPosition(normalized)) {
    return { ok: false, code: 'INVALID_INPUT', summary: 'Choose a valid canvas position.' };
  }
  if (name === 'create_table') {
    const issue = tableRuntimeIssue(normalized);
    if (issue) return issue;
  }
  return { ok: true, value: normalized };
}
