export const NARRATIVE_NODE_TYPES = [
  'START',
  'AUDIO',
  'SCRIPT_TEXT',
  'INSTRUCTION',
  'PAUSE',
  'DECISION',
  'END',
] as const;

export type NarrativeNodeType = (typeof NARRATIVE_NODE_TYPES)[number];

export const NARRATIVE_RUN_EVENT_TYPES = [
  'NODE_STARTED',
  'NODE_COMPLETED',
  'NODE_SKIPPED',
  'AUDIO_PLAYED',
  'DECISION_SELECTED',
  'RUN_COMPLETED',
  'RUN_CANCELLED',
] as const;

export type NarrativeRunEventTypeName =
  (typeof NARRATIVE_RUN_EVENT_TYPES)[number];

export type NarrativeGraphNode = {
  id: string;
  type: NarrativeNodeType;
  position?: {
    x: number;
    y: number;
  };
  data?: Record<string, unknown>;
};

export type NarrativeGraphEdge = {
  id: string;
  source: string;
  target: string;
  label?: string | null;
};

export type NarrativeGraphJson = {
  nodes: NarrativeGraphNode[];
  edges: NarrativeGraphEdge[];
};

export const EMPTY_NARRATIVE_GRAPH: NarrativeGraphJson = {
  nodes: [],
  edges: [],
};
