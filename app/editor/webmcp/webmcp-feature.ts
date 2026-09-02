import type { WebMcpModelContext } from './webmcp-types';

const ENABLED_VALUES = new Set(['1', 'true']);

export function isWebMcpFeatureEnabled(
  value?: string,
): boolean {
  return typeof value === 'string' && ENABLED_VALUES.has(value.trim().toLocaleLowerCase());
}

export function getWebMcpModelContext(
  candidate: Document | undefined = typeof document === 'undefined' ? undefined : document,
): WebMcpModelContext | null {
  const modelContext = candidate?.modelContext;
  return modelContext && typeof modelContext.registerTool === 'function' ? modelContext : null;
}
