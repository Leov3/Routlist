export type NarrativeStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type NarrativeVersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type NarrativeRunStatus = "RUNNING" | "COMPLETED" | "CANCELLED";

export type NarrativeNodeType =
  | "START"
  | "AUDIO"
  | "SCRIPT_TEXT"
  | "INSTRUCTION"
  | "PAUSE"
  | "DECISION"
  | "END";

export type NarrativeRunEventType =
  | "NODE_STARTED"
  | "NODE_COMPLETED"
  | "NODE_SKIPPED"
  | "AUDIO_PLAYED"
  | "DECISION_SELECTED"
  | "RUN_COMPLETED"
  | "RUN_CANCELLED";

export type NarrativeGraphNodeData = Record<string, unknown>;

export type NarrativeGraphNode = {
  id: string;
  type: NarrativeNodeType;
  position?: { x: number; y: number };
  data?: NarrativeGraphNodeData;
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

export type NarrativeVersion = {
  id: string;
  versionNumber: number;
  status: NarrativeVersionStatus;
  publishedAt?: string | null;
  createdAt?: string;
  graphJson?: NarrativeGraphJson;
};

export type NarrativeSummary = {
  id: string;
  title: string;
  description?: string | null;
  status: NarrativeStatus;
  createdAt: string;
  updatedAt: string;
  publishedVersionId?: string | null;
  _count?: {
    versions: number;
    runs: number;
  };
  publishedVersion?: {
    id: string;
    versionNumber: number;
    status: NarrativeVersionStatus;
    publishedAt?: string | null;
  } | null;
};

export type NarrativeBuilderState = {
  narrative: NarrativeSummary & {
    createdBy?: { id: string; fullName: string; email: string };
    updatedBy?: { id: string; fullName: string; email: string } | null;
    versions?: NarrativeVersion[];
  };
  draftVersion: NarrativeVersion | null;
  publishedVersion: NarrativeVersion | null;
  validation: { valid: boolean; errors: string[] };
};

export type NarrativeListItem = NarrativeSummary & {
  createdBy?: { id: string; fullName: string; email: string };
  updatedBy?: { id: string; fullName: string; email: string } | null;
};
