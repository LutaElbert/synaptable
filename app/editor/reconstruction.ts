import type { EditorNode } from './types';

export type ReconstructionResult = {
  nodes: EditorNode[];
  warnings: string[];
};

export interface DiagramReconstructionProvider {
  readonly name: string;
  readonly available: boolean;
  reconstruct(imageDataUrl: string, signal: AbortSignal): Promise<ReconstructionResult>;
}

export const unconfiguredReconstructionProvider: DiagramReconstructionProvider = {
  name: 'No cloud provider connected',
  available: false,
  async reconstruct() {
    throw new Error('Diagram reconstruction needs a configured vision provider. Local vectorization is available now.');
  },
};
