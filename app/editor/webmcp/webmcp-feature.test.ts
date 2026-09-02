import { describe, expect, it } from 'vitest';
import { getWebMcpModelContext, isWebMcpFeatureEnabled } from './webmcp-feature';

describe('WebMCP feature boundary', () => {
  it.each(['1', 'true', ' TRUE '])('enables only an explicit supported value: %s', (value) => {
    expect(isWebMcpFeatureEnabled(value)).toBe(true);
  });

  it.each([undefined, '', '0', 'false', 'yes', 'enabled'])('defaults malformed or absent values off: %s', (value) => {
    expect(isWebMcpFeatureEnabled(value)).toBe(false);
  });

  it('feature-detects document.modelContext without a navigator fallback', () => {
    const registerTool = () => undefined;
    expect(getWebMcpModelContext({ modelContext: { registerTool } } as unknown as Document)).toEqual({ registerTool });
    expect(getWebMcpModelContext({} as Document)).toBeNull();
    expect(getWebMcpModelContext(undefined)).toBeNull();
  });
});
