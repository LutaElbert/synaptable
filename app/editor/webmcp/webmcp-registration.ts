import { createApprovedWebMcpToolDefinitions, type WebMcpToolRuntime } from './webmcp-tools';
import type { WebMcpModelContext } from './webmcp-types';

export async function registerApprovedWebMcpTools({
  modelContext,
  runtime,
  signal,
}: {
  modelContext: WebMcpModelContext;
  runtime: WebMcpToolRuntime;
  signal: AbortSignal;
}): Promise<void> {
  const definitions = createApprovedWebMcpToolDefinitions(runtime);
  for (const definition of definitions) {
    if (signal.aborted) return;
    await modelContext.registerTool(definition, { signal });
  }
}

