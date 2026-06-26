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

function isGraphEdge(value: unknown): value is NarrativeGraphJson['edges'][number] {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.source === 'string' &&
    typeof value.target === 'string'
  );
}

export function isAnnotationNodeType(type: NarrativeGraphNode['type']) {
  return type === 'INSTRUCTION';
}

export function isFlowNodeType(type: NarrativeGraphNode['type']) {
  return !isAnnotationNodeType(type);
}

function extractDynamicAudioVariables(template: string) {
  const variables = new Set<string>();
  const pattern = /{{\s*([A-Za-z][A-Za-z0-9_-]*)\s*}}/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(template))) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

function containsInvalidDynamicAudioPlaceholder(template: string) {
  const stripped = template.replace(/{{\s*[A-Za-z][A-Za-z0-9_-]*\s*}}/g, '');
  return stripped.includes('{') || stripped.includes('}') || /<\s*[^<>]+\s*>/.test(template);
}

function executionEdges(
  nodes: NarrativeGraphNode[],
  edges: NarrativeGraphJson['edges'],
) {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const isAnnotationEdge = (edge: { source: string; target: string }) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    return Boolean(source && isAnnotationNodeType(source.type)) || Boolean(target && isAnnotationNodeType(target.type));
  };

  const directFlowEdges = edges.filter((edge) => !isAnnotationEdge(edge));
  const virtualBypassEdges = nodes
    .filter((node) => isAnnotationNodeType(node.type))
    .flatMap((node) => {
      const incoming = edges.filter((edge) => {
        const source = nodeById.get(edge.source);
        return edge.target === node.id && Boolean(source && isFlowNodeType(source.type));
      });
      const outgoing = edges.filter((edge) => {
        const target = nodeById.get(edge.target);
        return edge.source === node.id && Boolean(target && isFlowNodeType(target.type));
      });
      return incoming.flatMap((input) =>
        outgoing.map((output) => ({
          id: `annotation-bypass:${input.id}:${output.id}`,
          source: input.source,
          target: output.target,
          label: input.label,
        })),
      );
    });

  return [...directFlowEdges, ...virtualBypassEdges];
}

export function cloneGraphJson(graph: NarrativeGraphJson): NarrativeGraphJson {
  return JSON.parse(JSON.stringify(graph)) as NarrativeGraphJson;
}

export function emptyGraphJson(): NarrativeGraphJson {
  return cloneGraphJson(EMPTY_NARRATIVE_GRAPH);
}

export function validateNarrativeGraph(
  input: unknown,
  options: { strict?: boolean } = { strict: true }
): GraphValidationResult {
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

  const flowNodes = typedNodes.filter((node) => isFlowNodeType(node.type));
  const startNodes = flowNodes.filter((node) => node.type === 'START');
  const endNodes = flowNodes.filter((node) => node.type === 'END');
  const typedExecutionEdges = executionEdges(typedNodes, typedEdges);

  if (options.strict) {
    if (startNodes.length !== 1) {
      errors.push('Narrative must contain exactly one START node');
    }

    if (endNodes.length < 1) {
      errors.push('Narrative must contain at least one END node');
    }
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

  if (options.strict) {
    const executionOutgoingByNode = new Map<string, typeof typedExecutionEdges>();
    const executionIncomingByNode = new Map<string, typeof typedExecutionEdges>();

    for (const node of flowNodes) {
      executionOutgoingByNode.set(node.id, []);
      executionIncomingByNode.set(node.id, []);
    }

    for (const edge of typedExecutionEdges) {
      executionOutgoingByNode.get(edge.source)?.push(edge);
      executionIncomingByNode.get(edge.target)?.push(edge);
    }

    for (const node of flowNodes) {
      const incoming = executionIncomingByNode.get(node.id) ?? [];
      const outgoing = executionOutgoingByNode.get(node.id) ?? [];

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

      if (node.type === 'DYNAMIC_AUDIO') {
        const template = typeof node.data?.template === 'string' ? node.data.template.trim() : '';
        if (!template) {
          errors.push(`DYNAMIC_AUDIO node ${node.id} requires a non-empty template`);
        } else {
          if (containsInvalidDynamicAudioPlaceholder(template)) {
            errors.push(`DYNAMIC_AUDIO node ${node.id} contains invalid variable placeholders`);
          }

          const variables = extractDynamicAudioVariables(template);
          if (variables.length === 0) {
            errors.push(`DYNAMIC_AUDIO node ${node.id} requires at least one {{variable}} placeholder`);
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

        for (const edge of executionOutgoingByNode.get(nodeId) ?? []) {
          visit(edge.target);
        }

        visiting.delete(nodeId);
      };

      visit(startNodes[0].id);

      if (cycleFound) {
        errors.push('Narrative graph cannot contain cycles in the MVP');
      }

      const unreachableNodes = flowNodes.filter((node) => !reachable.has(node.id));
      if (unreachableNodes.length > 0) {
        errors.push(
          `Narrative contains unreachable nodes: ${unreachableNodes.map((node) => node.id).join(', ')}`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
