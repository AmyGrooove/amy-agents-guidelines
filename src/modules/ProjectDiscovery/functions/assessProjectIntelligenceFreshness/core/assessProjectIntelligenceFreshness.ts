import { isRecord } from '#shared/functions/checks/isRecord';

import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import { AmyRuntimeError } from '#entities/runtime';

import { PROJECT_INTELLIGENCE_VERSIONS } from '#entities/project';
import {
  buildProjectIntelligenceGraph,
  fingerprintProjectIntelligenceKnowledge,
  loadProjectIntelligenceGraph,
} from '../../buildProjectIntelligenceGraph/core/buildProjectIntelligenceGraph.js';
import { normalizeProjectRelativePath } from '#entities/project';

import type {
  IProjectIntelligenceChangedSource,
  IProjectIntelligenceFreshnessAssessment,
  IProjectIntelligenceFreshnessOwnerAssessment,
  IProjectIntelligenceFreshnessOwnerSnapshot,
  IProjectIntelligenceFreshnessSnapshot,
  IProjectIntelligenceGraph,
  IProjectIntelligenceKnowledge,
  IProjectIntelligenceSourceFingerprint,
  TProjectIntelligenceChangeKind,
  TProjectIntelligenceFreshnessReason,
  TProjectIntelligenceFreshnessState,
  TProjectIntelligenceOwner,
  TProjectIntelligenceSourceKind,
  TProjectIntelligenceSourceRole,
} from '#entities/project';

const FRESHNESS_PATH = join('.amy', 'project-intelligence', 'freshness.json');
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const OWNER_PATTERN = /^module:[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const SOURCE_KINDS = new Set<TProjectIntelligenceSourceKind>([
  'directory',
  'file',
  'missing',
  'symlink',
]);
const SOURCE_ROLES = new Set<TProjectIntelligenceSourceRole>([
  'architecture',
  'contract',
  'implementation',
  'unknown',
]);
const IGNORED_DIRECTORY_NAMES = new Set(['.amy', '.git', 'node_modules']);


const createValidationError = (message: string) =>
  new AmyRuntimeError({
    code: 'VALIDATION_FAILURE',
    message,
  });

const hashValue = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');

const checkIsMissingFileError = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

const validateOwner = (value: unknown): TProjectIntelligenceOwner => {
  if (
    value !== 'architecture' &&
    value !== 'project' &&
    (typeof value !== 'string' || !OWNER_PATTERN.test(value))
  ) {
    throw createValidationError('Project Intelligence freshness owner is invalid');
  }

  return value as TProjectIntelligenceOwner;
};

const validateSourceFingerprint = (
  value: unknown,
): Readonly<IProjectIntelligenceSourceFingerprint> => {
  if (!isRecord(value)) {
    throw createValidationError(
      'Project Intelligence freshness source must be an object',
    );
  }

  const allowedKeys = [
    'bytes',
    'fileCount',
    'fingerprint',
    'kind',
    'path',
    'role',
  ];
  const unknownKeys = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknownKeys.length > 0) {
    throw createValidationError(
      `Unknown Project Intelligence freshness source fields: ${unknownKeys
        .sort()
        .join(', ')}`,
    );
  }

  if (
    typeof value.bytes !== 'number' ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes < 0 ||
    typeof value.fileCount !== 'number' ||
    !Number.isSafeInteger(value.fileCount) ||
    value.fileCount < 0 ||
    typeof value.fingerprint !== 'string' ||
    !HASH_PATTERN.test(value.fingerprint) ||
    typeof value.kind !== 'string' ||
    !SOURCE_KINDS.has(value.kind as TProjectIntelligenceSourceKind) ||
    typeof value.path !== 'string' ||
    typeof value.role !== 'string' ||
    !SOURCE_ROLES.has(value.role as TProjectIntelligenceSourceRole)
  ) {
    throw createValidationError(
      'Project Intelligence freshness source metadata is invalid',
    );
  }

  return Object.freeze({
    bytes: value.bytes,
    fileCount: value.fileCount,
    fingerprint: value.fingerprint,
    kind: value.kind as TProjectIntelligenceSourceKind,
    path: normalizeProjectRelativePath(value.path),
    role: value.role as TProjectIntelligenceSourceRole,
  });
};

const validateOwnerSnapshot = (
  value: unknown,
): Readonly<IProjectIntelligenceFreshnessOwnerSnapshot> => {
  if (!isRecord(value)) {
    throw createValidationError(
      'Project Intelligence freshness owner snapshot must be an object',
    );
  }

  const unknownKeys = Object.keys(value).filter(
    (key) => !['knowledgeFingerprint', 'owner', 'sources'].includes(key),
  );

  if (
    unknownKeys.length > 0 ||
    typeof value.knowledgeFingerprint !== 'string' ||
    !HASH_PATTERN.test(value.knowledgeFingerprint) ||
    !Array.isArray(value.sources)
  ) {
    throw createValidationError(
      'Project Intelligence freshness owner snapshot is invalid',
    );
  }

  const sources = value.sources
    .map(validateSourceFingerprint)
    .sort((left, right) =>
      `${left.path}\0${left.role}`.localeCompare(`${right.path}\0${right.role}`),
    );
  const sourceKeys = new Set(sources.map(({ path, role }) => `${path}\0${role}`));

  if (sourceKeys.size !== sources.length) {
    throw createValidationError(
      'Project Intelligence freshness sources must be unique per owner',
    );
  }

  return Object.freeze({
    knowledgeFingerprint: value.knowledgeFingerprint,
    owner: validateOwner(value.owner),
    sources: Object.freeze(sources),
  });
};

export const validateProjectIntelligenceFreshnessSnapshot = (
  value: unknown,
): Readonly<IProjectIntelligenceFreshnessSnapshot> => {
  if (!isRecord(value)) {
    throw createValidationError(
      'Project Intelligence freshness snapshot must be an object',
    );
  }

  const unknownKeys = Object.keys(value).filter(
    (key) => !['owners', 'schemaVersion'].includes(key),
  );

  if (
    unknownKeys.length > 0 ||
    value.schemaVersion !== PROJECT_INTELLIGENCE_VERSIONS.freshnessSchema ||
    !Array.isArray(value.owners)
  ) {
    throw createValidationError('Project Intelligence freshness schema is invalid');
  }

  const owners = value.owners
    .map(validateOwnerSnapshot)
    .sort(({ owner: left }, { owner: right }) => left.localeCompare(right));
  const ownerIds = new Set(owners.map(({ owner }) => owner));

  if (ownerIds.size !== owners.length) {
    throw createValidationError(
      'Project Intelligence freshness owners must be unique',
    );
  }

  return Object.freeze({
    owners: Object.freeze(owners),
    schemaVersion: PROJECT_INTELLIGENCE_VERSIONS.freshnessSchema,
  });
};

const readFreshnessSnapshot = async (projectRoot: string) => {
  try {
    return validateProjectIntelligenceFreshnessSnapshot(
      JSON.parse(
        await readFile(join(projectRoot, FRESHNESS_PATH), 'utf8'),
      ) as unknown,
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
      details: { path: join(projectRoot, FRESHNESS_PATH) },
      message: 'Cannot load Project Intelligence freshness snapshot',
    });
  }
};

const writeFreshnessSnapshot = async (
  projectRoot: string,
  snapshot: Readonly<IProjectIntelligenceFreshnessSnapshot>,
) => {
  await mkdir(join(projectRoot, '.amy', 'project-intelligence'), {
    recursive: true,
  });
  await writeFile(
    join(projectRoot, FRESHNESS_PATH),
    `${JSON.stringify(snapshot, undefined, 2)}\n`,
    'utf8',
  );

  return snapshot;
};

interface IFingerprintResult {
  readonly bytes: number;
  readonly fileCount: number;
  readonly fingerprint: string;
  readonly kind: TProjectIntelligenceSourceKind;
}

const fingerprintPath = async (
  absolutePath: string,
  projectRelativePath: string,
): Promise<IFingerprintResult> => {
  let stats;

  try {
    stats = await lstat(absolutePath);
  } catch (error) {
    if (checkIsMissingFileError(error)) {
      return {
        bytes: 0,
        fileCount: 0,
        fingerprint: hashValue(`missing\0${projectRelativePath}`),
        kind: 'missing',
      };
    }

    throw new AmyRuntimeError({
      cause: error,
      code: 'CAPABILITY_EXECUTION_FAILURE',
      details: { path: projectRelativePath },
      message: `Cannot fingerprint Project Intelligence source ${projectRelativePath}`,
    });
  }

  if (stats.isSymbolicLink()) {
    const target = await readlink(absolutePath);

    return {
      bytes: Buffer.byteLength(target),
      fileCount: 1,
      fingerprint: hashValue(`symlink\0${projectRelativePath}\0${target}`),
      kind: 'symlink',
    };
  }

  if (stats.isFile()) {
    const content = await readFile(absolutePath);

    return {
      bytes: content.byteLength,
      fileCount: 1,
      fingerprint: hashValue(
        Buffer.concat([
          Buffer.from(`file\0${projectRelativePath}\0`),
          content,
        ]),
      ),
      kind: 'file',
    };
  }

  if (!stats.isDirectory()) {
    return {
      bytes: 0,
      fileCount: 0,
      fingerprint: hashValue(`unknown\0${projectRelativePath}`),
      kind: 'missing',
    };
  }

  const entries = (await readdir(absolutePath, { withFileTypes: true }))
    .filter(
      (entry) =>
        !entry.isDirectory() || !IGNORED_DIRECTORY_NAMES.has(entry.name),
    )
    .sort(({ name: left }, { name: right }) => left.localeCompare(right));
  const childResults = await Promise.all(
    entries.map(async ({ name }) => {
      const childAbsolutePath = join(absolutePath, name);
      const childProjectPath = normalizeProjectRelativePath(
        join(projectRelativePath, name),
      );
      const result = await fingerprintPath(childAbsolutePath, childProjectPath);

      return { name, result };
    }),
  );
  const bytes = childResults.reduce(
    (total, { result }) => total + result.bytes,
    0,
  );
  const fileCount = childResults.reduce(
    (total, { result }) => total + result.fileCount,
    0,
  );
  const manifest = childResults
    .map(({ name, result }) => `${name}\0${result.kind}\0${result.fingerprint}`)
    .join('\n');

  return {
    bytes,
    fileCount,
    fingerprint: hashValue(`directory\0${projectRelativePath}\0${manifest}`),
    kind: 'directory',
  };
};

const getOwnerKnowledgeFingerprint = (
  knowledge: Readonly<IProjectIntelligenceKnowledge>,
  owner: TProjectIntelligenceOwner,
) => {
  if (owner === 'project') {
    return hashValue(JSON.stringify(knowledge.project));
  }

  if (owner === 'architecture') {
    return hashValue(JSON.stringify(knowledge.architecture));
  }

  const moduleId = owner.slice('module:'.length);
  const module = knowledge.modules.find(({ id }) => id === moduleId);

  if (!module) {
    throw createValidationError(`Unknown Project Intelligence owner: ${owner}`);
  }

  return hashValue(JSON.stringify(module));
};

const getCurrentOwners = (
  knowledge: Readonly<IProjectIntelligenceKnowledge>,
): readonly TProjectIntelligenceOwner[] =>
  Object.freeze([
    'architecture',
    'project',
    ...knowledge.modules.map(({ id }) => `module:${id}` as const),
  ]);

const resolveOwners = (
  knowledge: Readonly<IProjectIntelligenceKnowledge>,
  owners?: readonly string[],
): readonly TProjectIntelligenceOwner[] => {
  const currentOwners = new Set(getCurrentOwners(knowledge));

  if (!owners) {
    return getCurrentOwners(knowledge);
  }

  const resolved = owners.map(validateOwner);

  for (const owner of resolved) {
    if (!currentOwners.has(owner)) {
      throw createValidationError(`Unknown Project Intelligence owner: ${owner}`);
    }
  }

  return Object.freeze([...new Set(resolved)]);
};

const getCurrentGraph = async (
  projectRoot: string,
  knowledge: Readonly<IProjectIntelligenceKnowledge>,
) => {
  const graph = await loadProjectIntelligenceGraph(projectRoot);

  return graph?.knowledgeFingerprint ===
    fingerprintProjectIntelligenceKnowledge(knowledge)
    ? graph
    : buildProjectIntelligenceGraph(knowledge);
};

const getOwnerSourceDescriptors = (
  graph: Readonly<IProjectIntelligenceGraph>,
  owner: TProjectIntelligenceOwner,
) =>
  graph.nodes
    .flatMap(({ owner: nodeOwner, path, semanticRole }) =>
      nodeOwner === owner && path && semanticRole
        ? [{ path, role: semanticRole }]
        : [],
    )
    .filter(
      ({ path, role }, index, values) =>
        values.findIndex(
          (candidate) => candidate.path === path && candidate.role === role,
        ) === index,
    )
    .sort((left, right) =>
      `${left.path}\0${left.role}`.localeCompare(`${right.path}\0${right.role}`),
    );

const captureOwner = async (
  projectRoot: string,
  knowledge: Readonly<IProjectIntelligenceKnowledge>,
  graph: Readonly<IProjectIntelligenceGraph>,
  owner: TProjectIntelligenceOwner,
): Promise<Readonly<IProjectIntelligenceFreshnessOwnerSnapshot>> => {
  const descriptors = getOwnerSourceDescriptors(graph, owner);
  const sources = await Promise.all(
    descriptors.map(async ({ path, role }) => {
      const normalizedPath = normalizeProjectRelativePath(path);
      const result = await fingerprintPath(
        join(projectRoot, normalizedPath),
        normalizedPath,
      );

      return Object.freeze({
        ...result,
        path: normalizedPath,
        role,
      });
    }),
  );

  return Object.freeze({
    knowledgeFingerprint: getOwnerKnowledgeFingerprint(knowledge, owner),
    owner,
    sources: Object.freeze(sources),
  });
};

export const refreshProjectIntelligenceFreshness = async (
  projectRoot: string,
  knowledge: Readonly<IProjectIntelligenceKnowledge>,
  owners?: readonly string[],
) => {
  const targetOwners = resolveOwners(knowledge, owners);
  const graph = await getCurrentGraph(projectRoot, knowledge);
  const previous = await readFreshnessSnapshot(projectRoot);
  const captured = await Promise.all(
    targetOwners.map((owner) => captureOwner(projectRoot, knowledge, graph, owner)),
  );
  const capturedByOwner = new Map(captured.map((item) => [item.owner, item]));
  const currentOwnerSet = new Set(getCurrentOwners(knowledge));
  const preserved =
    previous?.owners.filter(
      ({ owner }) => currentOwnerSet.has(owner) && !capturedByOwner.has(owner),
    ) ?? [];
  const snapshot = validateProjectIntelligenceFreshnessSnapshot({
    owners: [...preserved, ...captured],
    schemaVersion: PROJECT_INTELLIGENCE_VERSIONS.freshnessSchema,
  });

  return writeFreshnessSnapshot(projectRoot, snapshot);
};

const getChangedSources = (
  previous: readonly Readonly<IProjectIntelligenceSourceFingerprint>[],
  current: readonly Readonly<IProjectIntelligenceSourceFingerprint>[],
) => {
  const previousByKey = new Map(
    previous.map((source) => [`${source.path}\0${source.role}`, source]),
  );

  return current.flatMap((source) => {
    const before = previousByKey.get(`${source.path}\0${source.role}`);

    if (!before || before.fingerprint === source.fingerprint) {
      return [];
    }

    return [
      Object.freeze({
        currentFingerprint: source.fingerprint,
        path: source.path,
        previousFingerprint: before.fingerprint,
        role: source.role,
      }),
    ];
  });
};

const createAssessment = (
  owner: TProjectIntelligenceOwner,
  state: TProjectIntelligenceFreshnessState,
  changeKind: TProjectIntelligenceChangeKind,
  reasons: readonly TProjectIntelligenceFreshnessReason[],
  changedSources: readonly Readonly<IProjectIntelligenceChangedSource>[] = [],
): Readonly<IProjectIntelligenceFreshnessOwnerAssessment> =>
  Object.freeze({
    changeKind,
    changedSources: Object.freeze([...changedSources]),
    owner,
    reasons: Object.freeze([...reasons]),
    state,
  });

const assessOwner = async (
  projectRoot: string,
  knowledge: Readonly<IProjectIntelligenceKnowledge>,
  graph: Readonly<IProjectIntelligenceGraph>,
  owner: TProjectIntelligenceOwner,
  baseline: Readonly<IProjectIntelligenceFreshnessOwnerSnapshot> | undefined,
) => {
  if (!baseline) {
    return createAssessment(owner, 'unknown', 'unknown', ['baseline-missing']);
  }

  if (baseline.knowledgeFingerprint !== getOwnerKnowledgeFingerprint(knowledge, owner)) {
    return createAssessment(owner, 'unknown', 'unknown', ['knowledge-changed']);
  }

  const current = await captureOwner(projectRoot, knowledge, graph, owner);

  if (current.sources.length === 0) {
    return createAssessment(owner, 'unknown', 'unknown', ['no-sources']);
  }

  const previousKeys = baseline.sources.map(
    ({ path, role }) => `${path}\0${role}`,
  );
  const currentKeys = current.sources.map(({ path, role }) => `${path}\0${role}`);

  if (JSON.stringify(previousKeys) !== JSON.stringify(currentKeys)) {
    return createAssessment(owner, 'unknown', 'unknown', ['source-set-changed']);
  }

  if (current.sources.some(({ kind }) => kind === 'missing')) {
    const missingSources = current.sources
      .filter(({ kind }) => kind === 'missing')
      .map(({ fingerprint, path, role }) =>
        Object.freeze({
          currentFingerprint: fingerprint,
          path,
          role,
        }),
      );

    return createAssessment(
      owner,
      'unknown',
      'unknown',
      ['source-missing'],
      missingSources,
    );
  }

  const changedSources = getChangedSources(baseline.sources, current.sources);

  if (changedSources.length === 0) {
    return createAssessment(owner, 'trusted', 'none', []);
  }

  const roles = new Set(changedSources.map(({ role }) => role));
  const reasons: TProjectIntelligenceFreshnessReason[] = [];

  if (roles.has('architecture')) {
    reasons.push('architecture-drift');
  }

  if (roles.has('contract')) {
    reasons.push('contract-drift');
  }

  if (roles.has('implementation')) {
    reasons.push('implementation-drift');
  }

  if (roles.has('unknown')) {
    reasons.push('unknown-drift');
  }

  if (roles.has('architecture')) {
    return createAssessment(
      owner,
      'stale',
      'architecture',
      reasons,
      changedSources,
    );
  }

  if (roles.has('contract')) {
    return createAssessment(
      owner,
      'stale',
      'contract',
      reasons,
      changedSources,
    );
  }

  if (roles.has('unknown')) {
    return createAssessment(
      owner,
      'unknown',
      'unknown',
      reasons,
      changedSources,
    );
  }

  return createAssessment(
    owner,
    'trusted',
    'implementation',
    reasons,
    changedSources,
  );
};

export const assessProjectIntelligenceFreshness = async (
  projectRoot: string,
  knowledge: Readonly<IProjectIntelligenceKnowledge>,
  owners?: readonly string[],
): Promise<Readonly<IProjectIntelligenceFreshnessAssessment>> => {
  const targetOwners = resolveOwners(knowledge, owners);
  const graph = await getCurrentGraph(projectRoot, knowledge);
  const snapshot = await readFreshnessSnapshot(projectRoot);
  const baselineByOwner = new Map(
    snapshot?.owners.map((item) => [item.owner, item]) ?? [],
  );
  const assessments = await Promise.all(
    targetOwners.map((owner) =>
      assessOwner(projectRoot, knowledge, graph, owner, baselineByOwner.get(owner)),
    ),
  );
  const state = assessments.some(({ state }) => state === 'stale')
    ? 'stale'
    : assessments.some(({ state }) => state === 'unknown')
      ? 'unknown'
      : 'trusted';

  return Object.freeze({
    owners: Object.freeze(assessments),
    state,
  });
};
