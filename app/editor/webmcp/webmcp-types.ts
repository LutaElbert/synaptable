export type WebMcpToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

export type WebMcpExecuteOptions = {
  signal: AbortSignal;
};

export type WebMcpToolDefinition = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown, options: WebMcpExecuteOptions) => unknown | Promise<unknown>;
  annotations?: WebMcpToolAnnotations;
};

export type WebMcpRegisterOptions = {
  signal: AbortSignal;
};

export type WebMcpModelContext = {
  registerTool: (
    definition: WebMcpToolDefinition,
    options?: WebMcpRegisterOptions,
  ) => void | Promise<void>;
};

declare global {
  interface Document {
    modelContext?: WebMcpModelContext;
  }
}

