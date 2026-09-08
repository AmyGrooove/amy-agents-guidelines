import { isRecord } from '#shared/functions/checks/isRecord';

import { isAbsolute, posix, win32 } from 'node:path';

import { AmyRuntimeError } from '#entities/runtime';

import { PROJECT_INTELLIGENCE_VERSIONS } from '../../../types/projectIntelligenceContract.js';

import type {
  IArchitectureKnowledge,
  IModuleKnowledge,
  IProjectIntelligenceIndex,
  IProjectIntelligenceKnowledge,
  IProjectKnowledge,
  ISpecWorthinessDecision,
  TSpecWorthinessConfidence,
  TSpecWorthinessReason,
} from '../../../types/projectIntelligenceContract.js';

const MODULE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const SPEC_WORTHINESS_CONFIDENCE = new Set<TSpecWorthinessConfidence>([
  'high',
  'low',
  'medium',
]);
const SPEC_WORTHINESS_REASONS = new Set<TSpecWorthinessReason>([
  'architectural-role',
  'critical-invariants',
  'domain-responsibility',
  'hard-to-recover',
  'high-change-risk',
  'many-consumers',
  'nontrivial-data-flow',
  'public-api',
  'reused',
]);


const createValidationError = (message: string) =>
  new AmyRuntimeError({
    code: 'VALIDATION_FAILURE',
    message,
  });

const assertAllowedKeys = (
  value: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
  label: string,
) => {
  const unknownKeys = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknownKeys.length > 0) {
    throw createValidationError(
      `Unknown ${label} fields: ${unknownKeys.sort().join(', ')}`,
    );
  }
};

const validateSchema = (
  value: Readonly<Record<string, unknown>>,
  kind: string,
) => {
  if (value.schemaVersion !== PROJECT_INTELLIGENCE_VERSIONS.artifactSchema) {
    throw createValidationError(`Unsupported ${kind} schema version`);
  }
};

const validateOptionalString = (
  value: unknown,
  label: string,
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw createValidationError(`${label} must be a non-empty string`);
  }

  return value;
};

const validateStringArray = (
  value: unknown,
  label: string,
  options: Readonly<{ paths?: boolean; required?: boolean }> = {},
): readonly string[] | undefined => {
  if (value === undefined && !options.required) {
    return undefined;
  }

  if (
    !Array.isArray(value) ||
    (options.required && value.length === 0) ||
    !value.every((item) => typeof item === 'string' && item.trim())
  ) {
    throw createValidationError(`${label} must be an array of non-empty strings`);
  }

  return Object.freeze(
    value.map((item) =>
      options.paths ? normalizeProjectRelativePath(item) : item,
    ),
  );
};

export const normalizeProjectRelativePath = (value: string) => {
  const slashPath = value.replaceAll('\\', '/');
  const normalized = posix.normalize(slashPath);

  if (
    !value.trim() ||
    isAbsolute(value) ||
    win32.isAbsolute(value) ||
    slashPath.startsWith('/') ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    throw createValidationError(
      `Project Intelligence path must stay inside the project: ${value}`,
    );
  }

  return normalized;
};

const validateProject = (value: unknown): Readonly<IProjectKnowledge> => {
  if (!isRecord(value)) {
    throw createValidationError('Project knowledge must be an object');
  }

  assertAllowedKeys(
    value,
    [
      'constraints',
      'entryPoints',
      'kind',
      'modules',
      'purpose',
      'schemaVersion',
      'sourceOfTruth',
      'technologies',
      'verification',
    ],
    'project knowledge',
  );
  validateSchema(value, 'project knowledge');

  if (value.kind !== 'project') {
    throw createValidationError('Project knowledge kind must be project');
  }

  const constraints = validateStringArray(value.constraints, 'Project constraints');
  const entryPoints = validateStringArray(value.entryPoints, 'Project entry points', {
    paths: true,
  });
  const modules = validateStringArray(value.modules, 'Project modules');
  const purpose = validateOptionalString(value.purpose, 'Project purpose');
  const sourceOfTruth = validateStringArray(
    value.sourceOfTruth,
    'Project source of truth',
    { paths: true },
  );
  const technologies = validateStringArray(
    value.technologies,
    'Project technologies',
  );
  const verification = validateStringArray(
    value.verification,
    'Project verification',
  );

  return Object.freeze({
    kind: 'project',
    schemaVersion: PROJECT_INTELLIGENCE_VERSIONS.artifactSchema,
    ...(constraints ? { constraints } : {}),
    ...(entryPoints ? { entryPoints } : {}),
    ...(modules ? { modules } : {}),
    ...(purpose ? { purpose } : {}),
    ...(sourceOfTruth ? { sourceOfTruth } : {}),
    ...(technologies ? { technologies } : {}),
    ...(verification ? { verification } : {}),
  });
};

const validateArchitecture = (
  value: unknown,
): Readonly<IArchitectureKnowledge> => {
  if (!isRecord(value)) {
    throw createValidationError('Architecture knowledge must be an object');
  }

  const optionalArrays = [
    'boundaries',
    'components',
    'dataFlows',
    'decisions',
    'dependencyDirection',
    'extensionModel',
    'invariants',
  ] as const;

  assertAllowedKeys(
    value,
    ['kind', 'schemaVersion', ...optionalArrays],
    'architecture knowledge',
  );
  validateSchema(value, 'architecture knowledge');

  if (value.kind !== 'architecture') {
    throw createValidationError(
      'Architecture knowledge kind must be architecture',
    );
  }

  const arrays = Object.fromEntries(
    optionalArrays.flatMap((key) => {
      const validated = validateStringArray(
        value[key],
        `Architecture ${key}`,
      );

      return validated ? [[key, validated]] : [];
    }),
  );

  return Object.freeze({
    ...arrays,
    kind: 'architecture',
    schemaVersion: PROJECT_INTELLIGENCE_VERSIONS.artifactSchema,
  });
};

export const validateSpecWorthinessDecision = (
  value: unknown,
): Readonly<ISpecWorthinessDecision> => {
  if (!isRecord(value)) {
    throw createValidationError('Spec-worthiness decision must be an object');
  }

  assertAllowedKeys(
    value,
    ['confidence', 'isSpecWorthy', 'reasons'],
    'spec-worthiness decision',
  );

  if (
    typeof value.isSpecWorthy !== 'boolean' ||
    typeof value.confidence !== 'string' ||
    !SPEC_WORTHINESS_CONFIDENCE.has(
      value.confidence as TSpecWorthinessConfidence,
    ) ||
    !Array.isArray(value.reasons) ||
    value.reasons.length === 0 ||
    new Set(value.reasons).size !== value.reasons.length ||
    !value.reasons.every(
      (reason) =>
        typeof reason === 'string' &&
        SPEC_WORTHINESS_REASONS.has(reason as TSpecWorthinessReason),
    )
  ) {
    throw createValidationError('Spec-worthiness decision is invalid');
  }

  return Object.freeze({
    confidence: value.confidence as TSpecWorthinessConfidence,
    isSpecWorthy: value.isSpecWorthy,
    reasons: Object.freeze([...value.reasons] as TSpecWorthinessReason[]),
  });
};

const validateModule = (value: unknown): Readonly<IModuleKnowledge> => {
  if (!isRecord(value)) {
    throw createValidationError('Module knowledge must be an object');
  }

  const optionalArrays = [
    'consumers',
    'dataFlow',
    'decisions',
    'dependencies',
    'examples',
    'extensionPoints',
    'invariants',
    'nonResponsibilities',
    'publicContracts',
    'responsibilities',
    'sourceOfTruth',
    'testing',
  ] as const;

  assertAllowedKeys(
    value,
    [
      'id',
      'kind',
      'purpose',
      'schemaVersion',
      'sourceLocations',
      'specWorthy',
      ...optionalArrays,
    ],
    'module knowledge',
  );
  validateSchema(value, 'module knowledge');

  if (
    value.kind !== 'module' ||
    typeof value.id !== 'string' ||
    !MODULE_ID_PATTERN.test(value.id)
  ) {
    throw createValidationError('Module identity is invalid');
  }

  const sourceLocations = validateStringArray(
    value.sourceLocations,
    'Module source locations',
    { paths: true, required: true },
  );
  const purpose = validateOptionalString(value.purpose, 'Module purpose');
  const arrays = Object.fromEntries(
    optionalArrays.flatMap((key) => {
      const validated = validateStringArray(value[key], `Module ${key}`, {
        paths: key === 'examples' || key === 'sourceOfTruth',
      });

      return validated ? [[key, validated]] : [];
    }),
  );

  const specWorthy = validateSpecWorthinessDecision(value.specWorthy);

  if (!specWorthy.isSpecWorthy) {
    throw createValidationError(
      'Only spec-worthy modules can be persisted as module specs',
    );
  }

  return Object.freeze({
    ...arrays,
    id: value.id,
    kind: 'module',
    ...(purpose ? { purpose } : {}),
    schemaVersion: PROJECT_INTELLIGENCE_VERSIONS.artifactSchema,
    sourceLocations: sourceLocations ?? [],
    specWorthy,
  });
};

export const validateProjectIntelligenceKnowledge = (
  value: unknown,
): Readonly<IProjectIntelligenceKnowledge> => {
  if (!isRecord(value)) {
    throw createValidationError('Project Intelligence knowledge must be an object');
  }

  assertAllowedKeys(
    value,
    ['architecture', 'modules', 'project'],
    'Project Intelligence knowledge',
  );

  if (!Array.isArray(value.modules)) {
    throw createValidationError('Project Intelligence modules must be an array');
  }

  const modules = value.modules
    .map(validateModule)
    .sort(({ id: leftId }, { id: rightId }) => leftId.localeCompare(rightId));
  const moduleIds = new Set(modules.map(({ id }) => id));

  if (moduleIds.size !== modules.length) {
    throw createValidationError('Project Intelligence module ids must be unique');
  }

  return Object.freeze({
    architecture: validateArchitecture(value.architecture),
    modules: Object.freeze(modules),
    project: validateProject(value.project),
  });
};

export const validateProjectIntelligenceIndex = (
  value: unknown,
): Readonly<IProjectIntelligenceIndex> => {
  if (!isRecord(value)) {
    throw createValidationError('Project Intelligence index must be an object');
  }

  assertAllowedKeys(
    value,
    ['architecture', 'modules', 'project', 'schemaVersion'],
    'Project Intelligence index',
  );
  validateSchema(value, 'Project Intelligence index');

  if (
    value.project !== 'project.json' ||
    value.architecture !== 'architecture.json' ||
    !Array.isArray(value.modules)
  ) {
    throw createValidationError('Project Intelligence index is invalid');
  }

  const modules = value.modules.map((entry) => {
    if (!isRecord(entry)) {
      throw createValidationError('Project Intelligence module index is invalid');
    }

    assertAllowedKeys(entry, ['id', 'path'], 'module index');

    if (
      typeof entry.id !== 'string' ||
      !MODULE_ID_PATTERN.test(entry.id) ||
      entry.path !== `modules/${entry.id}.json`
    ) {
      throw createValidationError('Project Intelligence module index is invalid');
    }

    return Object.freeze({ id: entry.id, path: entry.path });
  });

  if (
    modules.some(
      (entry, index) =>
        index > 0 &&
        (modules[index - 1]?.id.localeCompare(entry.id) ?? 0) >= 0,
    )
  ) {
    throw createValidationError('Project Intelligence module index must be ordered');
  }

  return Object.freeze({
    architecture: 'architecture.json',
    modules: Object.freeze(modules),
    project: 'project.json',
    schemaVersion: PROJECT_INTELLIGENCE_VERSIONS.artifactSchema,
  });
};
