import { MarkerType } from '@xyflow/react';
import type { EditorDocument } from './types';

export const initialDocument: EditorDocument = {
  schemaVersion: 1,
  title: 'Untitled concept map',
  updatedAt: Date.now(),
  nodes: [
    {
      id: 'research',
      type: 'concept',
      position: { x: 130, y: 210 },
      data: {
        kind: 'concept',
        name: 'Research',
        label: 'Research',
        eyebrow: 'Starting point',
        tone: 'indigo',
        opacity: 1,
        locked: false,
      },
    },
    {
      id: 'explore',
      type: 'concept',
      position: { x: 450, y: 115 },
      data: {
        kind: 'concept',
        name: 'Explore tools',
        label: 'Explore tools',
        eyebrow: 'Next step',
        tone: 'ink',
        opacity: 1,
        locked: false,
      },
    },
    {
      id: 'layers',
      type: 'concept',
      position: { x: 470, y: 340 },
      data: {
        kind: 'concept',
        name: 'Editable layers',
        label: 'Editable layers',
        eyebrow: 'Output',
        tone: 'mint',
        opacity: 1,
        locked: false,
      },
    },
  ],
  edges: [
    {
      id: 'research-explore',
      source: 'research',
      target: 'explore',
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#a9adb7', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed },
    },
    {
      id: 'research-layers',
      source: 'research',
      target: 'layers',
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#a9adb7', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed },
    },
  ],
};
