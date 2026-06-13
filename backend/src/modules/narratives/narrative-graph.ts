import {
  EMPTY_NARRATIVE_GRAPH,
  NARRATIVE_NODE_TYPES,
  type NarrativeGraphJson,
  type NarrativeGraphNode,
} from './narratives.types';

type GraphValidationResult = {
  valid: boolean;
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isGraphNode(value: unknown): value is NarrativeGraphNode {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    NARRATIVE_NODE_TYPES.includes(value.type as NarrativeGraphNode['type'])
  );
}

function isGraphEdge(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.source === 'string' &&
    typeof value.target === 'string'
  );
}

export function cloneGraphJson(graph: NarrativeGraphJson): NarrativeGraphJson {
  return JSON.parse(JSON.stringify(graph)) as NarrativeGraphJson;
}

export function emptyGraphJson(): NarrativeGraphJson {
  return cloneGraphJson(EMPTY_NARRATIVE_GRAPH);
}

export function validateNarrativeGraph(input: unknown): GraphValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { valid: false, errors: ['graphJson must be an object'] };
  }

  const nodes = Array.isArray(input.nodes) ? input.nodes : null;
  const edges = Array.isArray(input.edges) ? input.edges : null;

  if (!nodes) {
    errors.push('graphJson.nodes must be an array');
  }

  if (!edges) {
    errors.push('graphJson.edges must be an array');
  }

  if (errors.length) {
    return { valid: false, errors };
  }

  const typedNodes = (nodes ?? []).filter(isGraphNode);
  const typedEdges = (edges ?? []).filter(isGraphEdge);

  if (nodes && typedNodes.length !== nodes.length) {
    errors.push('graphJson.nodes contains invalid node entries');
  }

  if (edges && typedEdges.length !== edges.length) {
    errors.push('graphJson.edges contains invalid edge entries');
  }

  const nodeIds = new Set<string>();
  for (const node of typedNodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node id found: ${node.id}`);
      continue;
    }

    nodeIds.add(node.id);
  }

  const edgeIds = new Set<string>();
  for (const edge of typedEdges) {
    if (edgeIds.has(edge.id)) {
      errors.push(`Duplicate edge id found: ${edge.id}`);
      continue;
    }

    edgeIds.add(edge.id);
  }

  const startNodes = typedNodes.filter((node) => node.type === 'START');
  const endNodes = typedNodes.filter((node) => node.type === 'END');

  if (startNodes.length !== 1) {
    errors.push('Narrative must contain exactly one START node');
  }

  if (endNodes.length < 1) {
    errors.push('Narrative must contain at least one END node');
  }

  const outgoingByNode = new Map<string, typeof typedEdges>();
  const incomingByNode = new Map<string, typeof typedEdges>();

  for (const node of typedNodes) {
    outgoingByNode.set(node.id, []);
    incomingByNode.set(node.id, []);
  }

  for (const edge of typedEdges) {
    const sourceEdges = outgoingByNode.get(edge.source);
    const targetEdges = incomingByNode.get(edge.target);

    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} references missing source node ${edge.source}`);
      continue;
    }

    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} references missing target node ${edge.target}`);
      continue;
    }

    sourceEdges?.push(edge);
    targetEdges?.push(edge);

    if (edge.label && typeof edge.label === 'string' && !edge.label.trim()) {
      errors.push(`Edge ${edge.id} has an empty label`);
    }
  }

  for (const node of typedNodes) {
    const incoming = incomingByNode.get(node.id) ?? [];
    const outgoing = outgoingByNode.get(node.id) ?? [];

    if (node.type === 'START') {
      if (incoming.length > 0) {
        errors.push('START node cannot have incoming edges');
      }

      if (outgoing.length < 1) {
        errors.push('START node must have at least one outgoing edge');
      }
    }

    if (node.type === 'END' && outgoing.length > 0) {
      errors.push('END node cannot have outgoing edges');
    }

    if (node.type === 'DECISION') {
      if (outgoing.length < 2) {
        errors.push('DECISION node must have at least two outgoing edges');
      }

      for (const edge of outgoing) {
        if (!edge.label || !edge.label.trim()) {
          errors.push(`DECISION node ${node.id} requires labeled outgoing edges`);
          break;
        }
      }
    }
  }

  if (startNodes.length === 1) {
    const reachable = new Set<string>();
    const visiting = new Set<string>();
    let cycleFound = false;

    const visit = (nodeId: string) => {
      if (visiting.has(nodeId)) {
        cycleFound = true;
        return;
      }

      if (reachable.has(nodeId)) {
        return;
      }

      reachable.add(nodeId);
      visiting.add(nodeId);

      for (const edge of outgoingByNode.get(nodeId) ?? []) {
        visit(edge.target);
      }

      visiting.delete(nodeId);
    };

    visit(startNodes[0].id);

    if (cycleFound) {
      errors.push('Narrative graph cannot contain cycles in the MVP');
    }

    const unreachableNodes = typedNodes.filter((node) => !reachable.has(node.id));
    if (unreachableNodes.length > 0) {
      errors.push(
        `Narrative contains unreachable nodes: ${unreachableNodes.map((node) => node.id).join(', ')}`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
