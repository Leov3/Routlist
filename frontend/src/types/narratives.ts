export type NarrativeStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type NarrativeVersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type NarrativeRunStatus = "RUNNING" | "COMPLETED" | "CANCELLED";

export type NarrativeNodeType =
  | "START"
  | "AUDIO"
  | "AUDIO_BUTTON"
  | "SCRIPT_TEXT"
  | "INSTRUCTION"
  | "PAUSE"
  | "DECISION"
  | "END";

export type DecisionOption = {
  id: string;
  label: string;
  description?: string;
};

export type BuilderNodeStatus = "valid" | "warning" | "error" | "info";

export type BuilderNodeBadge = {
  label: string;
  tone: BuilderNodeStatus;
};

export type NarrativeBuilderNodeData = {
  nodeType: NarrativeNodeType;
  title?: string;
  label?: string;
  body?: string;
  question?: string;
  instruction?: string;
  audioAssetId?: string;
  audioButtonId?: string;
  description?: string;
  required?: boolean;
  allowReplay?: boolean;
  operatorNotes?: string;
  notes?: string;
  pauseType?: string;
  durationSeconds?: string | number;
  manual?: boolean;
  options?: string | string[] | DecisionOption[];
  builderSummary?: string;
  builderStatus?: BuilderNodeStatus;
  builderStatusLabel?: string;
  builderBadges?: BuilderNodeBadge[];
};

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

export type NarrativeRunEvent = {
  id: string;
  nodeId: string;
  eventType: NarrativeRunEventType;
  payload?: Record<string, unknown> | null;
  createdAt: string;
};

export type NarrativeRunSummary = {
  id: string;
  narrativeId: string;
  narrativeVersionId: string;
  organizationId: string;
  status: NarrativeRunStatus;
  currentNodeId?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  narrative: {
    id: string;
    title: string;
    status: NarrativeStatus;
  };
  narrativeVersion: {
    id: string;
    versionNumber: number;
    status: NarrativeVersionStatus;
  };
};

export type NarrativeRunDetail = NarrativeRunSummary & {
  narrative: NarrativeSummary;
  narrativeVersion: NarrativeVersion;
  events: NarrativeRunEvent[];
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
