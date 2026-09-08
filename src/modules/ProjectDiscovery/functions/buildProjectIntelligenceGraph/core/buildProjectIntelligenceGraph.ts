import { isRecord } from '#shared/functions/checks/isRecord';

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AmyRuntimeError } from '#entities/runtime';

import {
  PROJECT_INTELLIGENCE_VERSIONS,
} from '#entities/project';
import { normalizeProjectRelativePath } from '#entities/project';

import type {
  IModuleKnowledge,
  IProjectIntelligenceGraph,
  IProjectIntelligenceGraphEdge,
  IProjectIntelligenceGraphNode,
  IProjectIntelligenceImpactAnalysis,
  IProjectIntelligenceKnowledge,
  TProjectIntelligenceGraphNodeKind,
  TProjectIntelligenceGraphRelation,
  TProjectIntelligenceOwner,
  TProjectIntelligenceRiskReason,
  TProjectIntelligenceSourceRole,
} from '#entities/project';

const GRAPH_PATH = join('.amy', 'project-intelligence', 'graph.json');
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const OWNER_PATTERN = /^module:[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const GRAPH_NODE_KINDS = new Set<TProjectIntelligenceGraphNodeKind>([
  'architecture',
  'contract',
  'example',
  'module',
  'project',
  'reference',
  'source',
  'symbol',
  'test',
]);
const GRAPH_RELATIONS = new Set<TProjectIntelligenceGraphRelation>([
  'canonical_example',
  'consumed_by',
  'depends_on',
  'important_symbol',
  'owns',
  'public_api',
  'related_to',
  'tested_by',
]);
const SOURCE_ROLES = new Set<TProjectIntelligenceSourceRole>([
  'architecture',
  'contract',
  'implementation',
  'unknown',
]);


const createValidationError = (message: string) =>
  new AmyRuntimeError({
    code: 'VALIDATION_FAILURE',
    message,
  });

const assertAllowedKeys = (
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
  label: string,
) => {
  const unknownKeys = Object.keys(value).filter((key) => !keys.includes(key));

  if (unknownKeys.length > 0) {
    throw createValidationError(
      `Unknown ${label} fields: ${unknownKeys.sort().join(', ')}`,
    );
  }
};

const hashValue = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');

export const fingerprintProjectIntelligenceKnowledge = (
  knowledge: Readonly<IProjectIntelligenceKnowledge>,
) => hashValue(JSON.stringify(knowledge));

const createSemanticNodeId = (kind: string, value: string) =>
  `${kind}:${hashValue(value).slice(0, 20)}`;

const validateOwner = (value: unknown): TProjectIntelligenceOwner => {
  if (
    value !== 'architecture' &&
    value !== 'project' &&
    (typeof value !== 'string' || !OWNER_PATTERN.test(value))
  ) {
    throw createValidationError('Project Intelligence graph owner is invalid');
  }

  return value as TProjectIntelligenceOwner;
};

const validateNode = (value: unknown): Readonly<IProjectIntelligenceGraphNode> => {
  if (!isRecord(value)) {
    throw createValidationError('Project Intelligence graph node must be an object');
  }

  assertAllowedKeys(
    value,
    ['id', 'kind', 'label', 'moduleId', 'owner', 'path', 'semanticRole'],
    'Project Intelligence graph node',
  );

  if (
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    typeof value.kind !== 'string' ||
    !GRAPH_NODE_KINDS.has(value.kind as TProjectIntelligenceGraphNodeKind)
  ) {
    throw createValidationError('Project Intelligence graph node identity is invalid');
  }

  const label = value.label;
  const moduleId = value.moduleId;
  const path = value.path;
  const semanticRole = value.semanticRole;
  const owner = value.owner;

  if (label !== undefined && (typeof label !== 'string' || !label.trim())) {
    throw createValidationError('Project Intelligence graph node label is invalid');
  }

  if (
    moduleId !== undefined &&
    (typeof moduleId !== 'string' || !moduleId.trim())
  ) {
    throw createValidationError('Project Intelligence graph module id is invalid');
  }

  if (value.kind === 'module' && moduleId === undefined) {
    throw createValidationError('Project Intelligence module node requires moduleId');
  }

  const normalizedPath =
    path === undefined
      ? undefined
      : typeof path === 'string'
        ? normalizeProjectRelativePath(path)
        : (() => {
            throw createValidationError('Project Intelligence graph path is invalid');
          })();
  const normalizedOwner = owner === undefined ? undefined : validateOwner(owner);

  if (
    semanticRole !== undefined &&
    (typeof semanticRole !== 'string' ||
      !SOURCE_ROLES.has(semanticRole as TProjectIntelligenceSourceRole))
  ) {
    throw createValidationError(
      'Project Intelligence graph semantic role is invalid',
    );
  }

  if (
    (normalizedPath !== undefined || semanticRole !== undefined) &&
    normalizedOwner === undefined
  ) {
    throw createValidationError(
      'Project Intelligence path metadata requires an owner',
    );
  }

  if (normalizedPath !== undefined && semanticRole === undefined) {
    throw createValidationError(
      'Project Intelligence graph path requires semanticRole',
    );
  }

  return Object.freeze({
    id: value.id,
    kind: value.kind as TProjectIntelligenceGraphNodeKind,
    ...(typeof label === 'string' ? { label } : {}),
    ...(typeof moduleId === 'string' ? { moduleId } : {}),
    ...(normalizedOwner ? { owner: normalizedOwner } : {}),
    ...(normalizedPath ? { path: normalizedPath } : {}),
    ...(typeof semanticRole === 'string'
      ? { semanticRole: semanticRole as TProjectIntelligenceSourceRole }
      : {}),
  });
};

const validateEdge = (value: unknown): Readonly<IProjectIntelligenceGraphEdge> => {
  if (!isRecord(value)) {
    throw createValidationError('Project Intelligence graph edge must be an object');
  }

  assertAllowedKeys(value, ['from', 'relation', 'to'], 'graph edge');

  if (
    typeof value.from !== 'string' ||
    !value.from.trim() ||
    typeof value.to !== 'string' ||
    !value.to.trim() ||
    typeof value.relation !== 'string' ||
    !GRAPH_RELATIONS.has(value.relation as TProjectIntelligenceGraphRelation)
  ) {
    throw createValidationError('Project Intelligence graph edge is invalid');
  }

  return Object.freeze({
    from: value.from,
    relation: value.relation as TProjectIntelligenceGraphRelation,
    to: value.to,
  });
};

export const validateProjectIntelligenceGraph = (
  value: unknown,
): Readonly<IProjectIntelligenceGraph> => {
  if (!isRecord(value)) {
    throw createValidationError('Project Intelligence graph must be an object');
  }

  assertAllowedKeys(
    value,
    ['edges', 'knowledgeFingerprint', 'nodes', 'schemaVersion'],
    'Project Intelligence graph',
  );

  if (
    value.schemaVersion !== PROJECT_INTELLIGENCE_VERSIONS.graphSchema ||
    typeof value.knowledgeFingerprint !== 'string' ||
    !HASH_PATTERN.test(value.knowledgeFingerprint) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  ) {
    throw createValidationError('Project Intelligence graph schema is invalid');
  }

  const nodes = value.nodes
    .map(validateNode)
    .sort(({ id: left }, { id: right }) => left.localeCompare(right));
  const nodeIds = new Set(nodes.map(({ id }) => id));

  if (nodeIds.size !== nodes.length) {
    throw createValidationError('Project Intelligence graph node ids must be unique');
  }

  const edges = value.edges
    .map(validateEdge)
    .sort((left, right) =>
      `${left.from}\0${left.relation}\0${left.to}`.localeCompare(
        `${right.from}\0${right.relation}\0${right.to}`,
      ),
    );
  const edgeIds = new Set(
    edges.map(({ from, relation, to }) => `${from}\0${relation}\0${to}`),
  );

  if (edgeIds.size !== edges.length) {
    throw createValidationError('Project Intelligence graph edges must be unique');
  }

  for (const { from, to } of edges) {
    if (!nodeIds.has(from) || !nodeIds.has(to)) {
      throw createValidationError(
        'Project Intelligence graph edges must reference existing nodes',
      );
    }
  }

  return Object.freeze({
    edges: Object.freeze(edges),
    knowledgeFingerprint: value.knowledgeFingerprint,
    nodes: Object.freeze(nodes),
    schemaVersion: PROJECT_INTELLIGENCE_VERSIONS.graphSchema,
  });
};

export const buildProjectIntelligenceGraph = (
  knowledge: Readonly<IProjectIntelligenceKnowledge>,
): Readonly<IProjectIntelligenceGraph> => {
  const nodes = new Map<string, IProjectIntelligenceGraphNode>();
  const edges = new Map<string, IProjectIntelligenceGraphEdge>();
  const moduleIds = new Set(knowledge.modules.map(({ id }) => id));

  const addNode = (node: IProjectIntelligenceGraphNode) => {
    nodes.set(node.id, node);
  };
  const addEdge = (edge: IProjectIntelligenceGraphEdge) => {
    edges.set(`${edge.from}\0${edge.relation}\0${edge.to}`, edge);
  };
  const addPathNode = (
    from: string,
    path: string,
    owner: TProjectIntelligenceOwner,
    semanticRole: TProjectIntelligenceSourceRole,
    relation: TProjectIntelligenceGraphRelation,
    kind: 'example' | 'source' = 'source',
  ) => {
    const id = createSemanticNodeId(
      kind,
      `${owner}\0${semanticRole}\0${normalizeProjectRelativePath(path)}`,
    );

    addNode({
      id,
      kind,
      owner,
      path: normalizeProjectRelativePath(path),
      semanticRole,
    });
    addEdge({ from, relation, to: id });
  };
  const addLabelNode = (
    from: string,
    label: string,
    kind: 'contract' | 'reference' | 'test',
    relation: TProjectIntelligenceGraphRelation,
  ) => {
    const id = createSemanticNodeId(kind, `${from}\0${relation}\0${label}`);

    addNode({ id, kind, label });
    addEdge({ from, relation, to: id });
  };

  addNode({ id: 'architecture', kind: 'architecture' });
  addNode({ id: 'project', kind: 'project' });

  for (const path of knowledge.project.entryPoints ?? []) {
    addPathNode('project', path, 'project', 'contract', 'owns');
  }

  for (const path of knowledge.project.sourceOfTruth ?? []) {
    addPathNode('project', path, 'project', 'implementation', 'owns');
  }

  for (const module of knowledge.modules) {
    const moduleNodeId = `module:${module.id}`;
    const owner = moduleNodeId as TProjectIntelligenceOwner;

    addNode({
      id: moduleNodeId,
      kind: 'module',
      moduleId: module.id,
    });

    for (const path of module.sourceLocations) {
      addPathNode(
        moduleNodeId,
        path,
        owner,
        'implementation',
        'owns',
      );
    }

    for (const path of module.sourceOfTruth ?? []) {
      addPathNode(moduleNodeId, path, owner, 'contract', 'owns');
    }

    for (const path of module.examples ?? []) {
      addPathNode(
        moduleNodeId,
        path,
        owner,
        'contract',
        'canonical_example',
        'example',
      );
    }

    for (const contract of module.publicContracts ?? []) {
      addLabelNode(moduleNodeId, contract, 'contract', 'public_api');
    }

    for (const test of module.testing ?? []) {
      addLabelNode(moduleNodeId, test, 'test', 'tested_by');
    }

    for (const dependency of module.dependencies ?? []) {
      if (moduleIds.has(dependency)) {
        addEdge({
          from: moduleNodeId,
          relation: 'depends_on',
          to: `module:${dependency}`,
        });
      } else {
        addLabelNode(moduleNodeId, dependency, 'reference', 'depends_on');
      }
    }

    for (const consumer of module.consumers ?? []) {
      if (moduleIds.has(consumer)) {
        addEdge({
          from: moduleNodeId,
          relation: 'consumed_by',
          to: `module:${consumer}`,
        });
      } else {
        addLabelNode(moduleNodeId, consumer, 'reference', 'consumed_by');
      }
    }
  }

  return validateProjectIntelligenceGraph({
    edges: [...edges.values()],
    knowledgeFingerprint: fingerprintProjectIntelligenceKnowledge(knowledge),
    nodes: [...nodes.values()],
    schemaVersion: PROJECT_INTELLIGENCE_VERSIONS.graphSchema,
  });
};

const checkIsMissingFileError = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

const readGraph = async (projectRoot: string) => {
  try {
    return validateProjectIntelligenceGraph(
      JSON.parse(await readFile(join(projectRoot, GRAPH_PATH), 'utf8')) as unknown,
    );
  } catch (cause) {
    if (checkIsMissingFileError(cause)) {
      return undefined;
    }

    if (cause instanceof AmyRuntimeError) {
      throw cause;
    }

    throw new AmyRuntimeError({
      cause,
      code: 'VALIDATION_FAILURE',
      details: { path: join(projectRoot, GRAPH_PATH) },
      message: 'Cannot load Project Intelligence graph',
    });
  }
};

const writeGraph = async (
  projectRoot: string,
  graph: Readonly<IProjectIntelligenceGraph>,
) => {
  const path = join(projectRoot, GRAPH_PATH);

  await mkdir(join(projectRoot, '.amy', 'project-intelligence'), {
    recursive: true,
  });
  await writeFile(path, `${JSON.stringify(graph, undefined, 2)}\n`, 'utf8');

  return graph;
};

export const loadProjectIntelligenceGraph = readGraph;

export const rebuildProjectIntelligenceGraph = async (
  projectRoot: string,
  knowledge: Readonly<IProjectIntelligenceKnowledge>,
) => writeGraph(projectRoot, buildProjectIntelligenceGraph(knowledge));

export const saveProjectIntelligenceGraph = async (
  projectRoot: string,
  knowledge: Readonly<IProjectIntelligenceKnowledge>,
  value: unknown,
) => {
  const graph = validateProjectIntelligenceGraph(value);
  const knowledgeFingerprint = fingerprintProjectIntelligenceKnowledge(knowledge);

  if (graph.knowledgeFingerprint !== knowledgeFingerprint) {
    throw createValidationError(
      'Project Intelligence graph was built from different knowledge',
    );
  }

  const knowledgeModuleIds = new Set(knowledge.modules.map(({ id }) => id));
  const graphModuleNodes = graph.nodes.filter(({ kind }) => kind === 'module');
  const graphModuleIds = graphModuleNodes.flatMap(({ moduleId }) =>
    moduleId ? [moduleId] : [],
  );

  if (
    graphModuleIds.length !== knowledgeModuleIds.size ||
    graphModuleIds.some((id) => !knowledgeModuleIds.has(id)) ||
    graphModuleNodes.some(
      ({ id, moduleId }) => moduleId === undefined || id !== `module:${moduleId}`,
    ) ||
    !graph.nodes.some(({ id, kind }) => id === 'project' && kind === 'project') ||
    !graph.nodes.some(
      ({ id, kind }) => id === 'architecture' && kind === 'architecture',
    ) ||
    graph.nodes.some(
      ({ owner }) =>
        owner?.startsWith('module:') &&
        !knowledgeModuleIds.has(owner.slice('module:'.length)),
    )
  ) {
    throw createValidationError(
      'Project Intelligence graph module nodes must match canonical knowledge',
    );
  }

  return writeGraph(projectRoot, graph);
};

const getModuleId = (
  node: Readonly<IProjectIntelligenceGraphNode> | undefined,
) => (node?.kind === 'module' ? node.moduleId : undefined);

const getNodeValue = (node: Readonly<IProjectIntelligenceGraphNode>) =>
  node.path ?? node.label;

const createUnknownImpact = (
  moduleId: string,
  graphState: 'missing' | 'stale',
): Readonly<IProjectIntelligenceImpactAnalysis> => {
  const riskReason: TProjectIntelligenceRiskReason =
    graphState === 'missing' ? 'graph-missing' : 'graph-stale';

  return Object.freeze({
    canonicalExamples: Object.freeze([]),
    consumers: Object.freeze([]),
    dependencies: Object.freeze([]),
    graphState,
    moduleId,
    ownedSources: Object.freeze([]),
    publicApi: Object.freeze([]),
    relatedModules: Object.freeze([]),
    risk: 'unknown',
    riskReasons: Object.freeze([riskReason]),
    tests: Object.freeze([]),
  });
};

const getRiskReasons = (
  module: Readonly<IModuleKnowledge>,
  consumers: readonly string[],
  publicApi: readonly string[],
) => {
  const reasons = new Set<TProjectIntelligenceRiskReason>();

  for (const reason of module.specWorthy.reasons) {
    if (
      reason === 'critical-invariants' ||
      reason === 'high-change-risk' ||
      reason === 'many-consumers' ||
      reason === 'public-api'
    ) {
      reasons.add(reason);
    }
  }

  if (consumers.length >= 3) {
    reasons.add('many-consumers');
  }

  if (publicApi.length > 0) {
    reasons.add('public-api');
  }

  return [...reasons].sort();
};

export const analyzeProjectIntelligenceImpact = async (
  projectRoot: string,
  knowledge: Readonly<IProjectIntelligenceKnowledge>,
  moduleId: string,
): Promise<Readonly<IProjectIntelligenceImpactAnalysis>> => {
  const module = knowledge.modules.find(({ id }) => id === moduleId);

  if (!module) {
    throw createValidationError(`Unknown Project Intelligence module: ${moduleId}`);
  }

  const graph = await readGraph(projectRoot);

  if (!graph) {
    return createUnknownImpact(moduleId, 'missing');
  }

  if (
    graph.knowledgeFingerprint !== fingerprintProjectIntelligenceKnowledge(knowledge)
  ) {
    return createUnknownImpact(moduleId, 'stale');
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const moduleNodeId = `module:${moduleId}`;
  const outgoing = graph.edges.filter(({ from }) => from === moduleNodeId);
  const incoming = graph.edges.filter(({ to }) => to === moduleNodeId);
  const dependencies = outgoing.flatMap(({ relation, to }) => {
    const target = getModuleId(nodeById.get(to));

    return relation === 'depends_on' && target ? [target] : [];
  });
  const consumers = [
    ...outgoing.flatMap(({ relation, to }) => {
      const target = getModuleId(nodeById.get(to));

      return relation === 'consumed_by' && target ? [target] : [];
    }),
    ...incoming.flatMap(({ from, relation }) => {
      const source = getModuleId(nodeById.get(from));

      return relation === 'depends_on' && source ? [source] : [];
    }),
  ];
  const relatedModules = [
    ...outgoing.flatMap(({ relation, to }) => {
      const target = getModuleId(nodeById.get(to));

      return relation === 'related_to' && target ? [target] : [];
    }),
    ...incoming.flatMap(({ from, relation }) => {
      const source = getModuleId(nodeById.get(from));

      return relation === 'related_to' && source ? [source] : [];
    }),
  ];
  const collectValues = (relation: TProjectIntelligenceGraphRelation) =>
    outgoing.flatMap(({ relation: edgeRelation, to }) => {
      const node = nodeById.get(to);
      const value = node ? getNodeValue(node) : undefined;

      return edgeRelation === relation && value ? [value] : [];
    });
  const publicApi = collectValues('public_api');
  const ownedSources = outgoing.flatMap(({ relation, to }) => {
    const node = nodeById.get(to);

    return relation === 'owns' && node?.kind === 'source' && node.path
      ? [node.path]
      : [];
  });
  const canonicalExamples = collectValues('canonical_example');
  const tests = collectValues('tested_by');
  const uniqueSorted = (values: readonly string[]) =>
    [...new Set(values)].sort((left, right) => left.localeCompare(right));
  const normalizedConsumers = uniqueSorted(consumers);
  const normalizedPublicApi = uniqueSorted(publicApi);
  const riskReasons = getRiskReasons(
    module,
    normalizedConsumers,
    normalizedPublicApi,
  );
  const hasRelationships =
    dependencies.length > 0 || consumers.length > 0 || relatedModules.length > 0;

  return Object.freeze({
    canonicalExamples: Object.freeze(uniqueSorted(canonicalExamples)),
    consumers: Object.freeze(normalizedConsumers),
    dependencies: Object.freeze(uniqueSorted(dependencies)),
    graphState: 'current',
    moduleId,
    ownedSources: Object.freeze(uniqueSorted(ownedSources)),
    publicApi: Object.freeze(normalizedPublicApi),
    relatedModules: Object.freeze(uniqueSorted(relatedModules)),
    risk: riskReasons.length > 0 ? 'high' : hasRelationships ? 'medium' : 'low',
    riskReasons: Object.freeze(riskReasons),
    tests: Object.freeze(uniqueSorted(tests)),
  });
};
