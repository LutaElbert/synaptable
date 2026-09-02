import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import catalogSource from '../../../WEBMCP_TOOL_SCHEMAS.json';
import {
  APPROVED_WEBMCP_TOOL_NAMES,
  validateWebMcpInput,
  WEBMCP_CATALOG_TOOLS,
  WEBMCP_INPUT_MAX_BYTES,
  WEBMCP_RESULT_MAX_BYTES,
} from './webmcp-schema';
import { webmcpSchemaFingerprint } from './webmcp-validators.generated.js';

describe('WebMCP catalog and input schemas', () => {
  it('keeps committed standalone validators synchronized with the approved schemas', () => {
    const catalog = catalogSource as { tools: Array<{ name: string; inputSchema: unknown }> };
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(catalog.tools.map(({ name, inputSchema }) => ({ name, inputSchema }))))
      .digest('hex');
    expect(webmcpSchemaFingerprint).toBe(fingerprint);
  });

  it('loads exactly the six approved closed tool definitions', () => {
    expect(WEBMCP_CATALOG_TOOLS.map((tool) => tool.name)).toEqual(APPROVED_WEBMCP_TOOL_NAMES);
    expect(new Set(WEBMCP_CATALOG_TOOLS.map((tool) => tool.name)).size).toBe(6);
    expect(WEBMCP_RESULT_MAX_BYTES).toBe(1_500);
    for (const tool of WEBMCP_CATALOG_TOOLS) {
      expect(tool.name.length).toBeLessThanOrEqual(30);
      expect(tool.description.length).toBeLessThanOrEqual(500);
      expect(tool.annotations.untrustedContentHint).toBe(true);
      expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
    }
  });

  it('accepts the empty bootstrap input and rejects extra properties', () => {
    expect(validateWebMcpInput('get_workspace_summary', {})).toEqual({ ok: true, value: {} });
    expect(validateWebMcpInput('get_workspace_summary', { projectId: 'project-a' })).toMatchObject({
      ok: false,
      code: 'INVALID_INPUT',
    });
  });

  it('applies approved defaults without trusting the caller to provide them', () => {
    expect(validateWebMcpInput('find_layers', {
      projectId: 'project-a',
      expectedRevision: 0,
    })).toEqual({
      ok: true,
      value: {
        projectId: 'project-a',
        expectedRevision: 0,
        query: '',
        limit: 10,
      },
    });
    expect(validateWebMcpInput('create_table', {
      projectId: 'project-a',
      expectedRevision: 0,
    })).toEqual({
      ok: true,
      value: {
        projectId: 'project-a',
        expectedRevision: 0,
        rows: 3,
        columns: 3,
        headerRow: true,
        values: [],
      },
    });
  });

  it('rejects missing context, duplicate IDs, and invalid positions', () => {
    expect(validateWebMcpInput('find_layers', {})).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
    expect(validateWebMcpInput('organize_layers_into_table', {
      projectId: 'project-a',
      expectedRevision: 0,
      layerIds: ['same', 'same'],
    })).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
    for (const x of [Number.NaN, Number.POSITIVE_INFINITY, 1_000_001]) {
      expect(validateWebMcpInput('create_concept', {
        projectId: 'project-a',
        expectedRevision: 0,
        position: { x, y: 0 },
      })).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
    }
  });

  it('enforces table product, matrix, aggregate text, and serialized byte budgets', () => {
    expect(validateWebMcpInput('create_table', {
      projectId: 'project-a',
      expectedRevision: 0,
      rows: 100,
      columns: 30,
    })).toMatchObject({ ok: false, code: 'LIMIT_EXCEEDED' });
    expect(validateWebMcpInput('create_table', {
      projectId: 'project-a',
      expectedRevision: 0,
      rows: 1,
      columns: 1,
      values: [['a', 'b']],
    })).toMatchObject({ ok: false, code: 'INVALID_INPUT' });

    const largeValues = Array.from({ length: 51 }, () => Array.from({ length: 1 }, () => 'x'.repeat(2_000)));
    expect(validateWebMcpInput('create_table', {
      projectId: 'project-a',
      expectedRevision: 0,
      rows: 51,
      columns: 1,
      values: largeValues,
    })).toMatchObject({ ok: false, code: 'LIMIT_EXCEEDED' });

    const oversized = { extra: 'x'.repeat(WEBMCP_INPUT_MAX_BYTES) };
    expect(validateWebMcpInput('get_workspace_summary', oversized)).toMatchObject({
      ok: false,
      code: 'LIMIT_EXCEEDED',
    });
  });

  it('rejects prototype-like and unknown properties through the closed schema', () => {
    const input = JSON.parse('{"projectId":"project-a","expectedRevision":0,"query":"","__proto__":{"polluted":true}}');
    expect(validateWebMcpInput('find_layers', input)).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});
