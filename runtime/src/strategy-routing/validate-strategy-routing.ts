import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { COMPUTE_PROFILES, COMPUTE_ROUTING_VERSIONS } from '../compute-routing/compute-routing-contract.js';
import { CONTEXT_INTELLIGENCE_VERSIONS } from '../context-intelligence/context-intelligence-contract.js';
import { validateTaskIntelligenceAnalysis } from '../task-intelligence/validate-task-intelligence.js';

import type {
  IComputeRoutingDecision,
  TComputeAssignmentStatus,
  TComputeProfile,
  TComputeReasonCode,
} from '../compute-routing/compute-routing-contract.js';
import type {
  IContextResolution,
  TContextConfidence,
  TContextEvidenceGap,
  TContextExploration,
  TContextReasonCode,
} from '../context-intelligence/context-intelligence-contract.js';
import type { TTaskConfidence } from '../task-intelligence/task-intelligence-contract.js';
import type { IStrategyRoutingInput } from './strategy-routing-contract.js';

const CONTEXT_CONFIDENCE = new Set<TContextConfidence>(['high', 'low', 'medium']);
const CONTEXT_EXPLORATION = new Set<TContextExploration>(['none', 'scout', 'source-read']);
const CONTEXT_EVIDENCE_GAPS = new Set<TContextEvidenceGap>([
  'freshness',
  'project-intelligence',
  'project-knowledge',
  'project-relationships',
  'scope-target',
]);
const CONTEXT_REASON_CODES = new Set<TContextReasonCode>([
  'budget-truncated',
  'explicit-file-target',
  'freshness-stale',
  'freshness-unknown',
  'graph-missing',
  'graph-stale',
  'module-id-match',
  'project-intelligence-unavailable',
  'project-knowledge-missing',
  'scout-recommended',
  'source-confirmation-required',
  'source-path-match',
  'trusted-spec-sufficient',
  'unresolved-scope-target',
]);
const COMPUTE_STATUSES = new Set<TComputeAssignmentStatus>([
  'escalated',
  'fallback',
  'mapped',
  'unavailable',
  'unmapped',
]);
const COMPUTE_REASON_CODES = new Set<TComputeReasonCode>([
  'default-profile',
  'heavy-task',
  'lightweight-task',
  'model-fallback',
  'model-mapped',
  'model-unavailable',
  'profile-downgraded',
  'profile-escalated',
  'profile-requested',
  'profile-upgraded',
  'standard-task',
]);
const TASK_CONFIDENCE = new Set<TTaskConfidence>(['high', 'low', 'medium']);

const checkIsRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createValidationError = (message: string) =>
  new AmyRuntimeError({ code: 'VALIDATION_FAILURE', message });

const assertAllowedKeys = (
  value: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
  label: string,
) => {
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key));

  if (unknownKeys.length > 0) {
    throw createValidationError(`${label} contains unknown fields: ${unknownKeys.join(', ')}`);
  }
};

const validateStringList = <T extends string>(
  value: unknown,
  allowed: ReadonlySet<T> | undefined,
  label: string,
): readonly T[] => {
  if (!Array.isArray(value)) {
    throw createValidationError(`${label} must be an array`);
  }

  if (
    value.some(
      (item) =>
        typeof item !== 'string' ||
        item.trim().length === 0 ||
        (allowed ? !allowed.has(item as T) : false),
    ) ||
    new Set(value).size !== value.length
  ) {
    throw createValidationError(`${label} is invalid`);
  }

  return Object.freeze([...value] as T[]);
};

const validateNonNegativeInteger = (value: unknown, label: string) => {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw createValidationError(`${label} must be a non-negative integer`);
  }

  return value as number;
};

const validateBudget = (value: unknown): IContextResolution['budget'] => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Context resolution budget must be an object');
  }

  assertAllowedKeys(value, ['limits', 'profile', 'truncated', 'usage'], 'Context resolution budget');

  if (!checkIsRecord(value.limits) || !checkIsRecord(value.usage)) {
    throw createValidationError('Context resolution budget limits and usage must be objects');
  }

  assertAllowedKeys(value.limits, ['maxFiles', 'maxModules', 'maxSpecItems'], 'Context budget limits');
  assertAllowedKeys(value.usage, ['files', 'modules', 'specItems'], 'Context budget usage');

  if (
    value.profile !== 'large' &&
    value.profile !== 'small' &&
    value.profile !== 'standard'
  ) {
    throw createValidationError('Context resolution budget profile is invalid');
  }

  if (typeof value.truncated !== 'boolean') {
    throw createValidationError('Context resolution budget truncated must be boolean');
  }

  return Object.freeze({
    limits: Object.freeze({
      maxFiles: validateNonNegativeInteger(value.limits.maxFiles, 'maxFiles'),
      maxModules: validateNonNegativeInteger(value.limits.maxModules, 'maxModules'),
      maxSpecItems: validateNonNegativeInteger(value.limits.maxSpecItems, 'maxSpecItems'),
    }),
    profile: value.profile,
    truncated: value.truncated,
    usage: Object.freeze({
      files: validateNonNegativeInteger(value.usage.files, 'files'),
      modules: validateNonNegativeInteger(value.usage.modules, 'modules'),
      specItems: validateNonNegativeInteger(value.usage.specItems, 'specItems'),
    }),
  });
};

const validateContextResolution = (value: unknown): Readonly<IContextResolution> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Context resolution must be an object');
  }

  assertAllowedKeys(
    value,
    ['budget', 'confidence', 'evidenceGaps', 'exploration', 'reasonCodes', 'schemaVersion', 'sourceReads'],
    'Context resolution',
  );

  if (
    value.schemaVersion !== CONTEXT_INTELLIGENCE_VERSIONS.resolutionSchema ||
    !CONTEXT_CONFIDENCE.has(value.confidence as TContextConfidence) ||
    !CONTEXT_EXPLORATION.has(value.exploration as TContextExploration)
  ) {
    throw createValidationError('Context resolution identity is invalid');
  }

  const sourceReads = validateStringList<string>(value.sourceReads, undefined, 'Context source reads');

  return Object.freeze({
    budget: validateBudget(value.budget),
    confidence: value.confidence as TContextConfidence,
    evidenceGaps: validateStringList(
      value.evidenceGaps,
      CONTEXT_EVIDENCE_GAPS,
      'Context evidence gaps',
    ),
    exploration: value.exploration as TContextExploration,
    reasonCodes: validateStringList(
      value.reasonCodes,
      CONTEXT_REASON_CODES,
      'Context reason codes',
    ),
    schemaVersion: CONTEXT_INTELLIGENCE_VERSIONS.resolutionSchema,
    sourceReads,
  });
};

const validateComputeDecision = (value: unknown): Readonly<IComputeRoutingDecision> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Compute decision must be an object');
  }

  assertAllowedKeys(
    value,
    ['assignment', 'confidence', 'profile', 'reasonCodes', 'schemaVersion', 'target'],
    'Compute decision',
  );

  if (
    value.schemaVersion !== COMPUTE_ROUTING_VERSIONS.decisionSchema ||
    !TASK_CONFIDENCE.has(value.confidence as TTaskConfidence) ||
    !COMPUTE_PROFILES.includes(value.profile as TComputeProfile) ||
    !checkIsRecord(value.assignment) ||
    !checkIsRecord(value.target)
  ) {
    throw createValidationError('Compute decision identity is invalid');
  }

  assertAllowedKeys(value.assignment, ['model', 'reasoningEffort', 'status'], 'Compute assignment');
  assertAllowedKeys(value.target, ['id', 'kind'], 'Compute target');

  if (
    !COMPUTE_STATUSES.has(value.assignment.status as TComputeAssignmentStatus) ||
    value.target.kind !== 'task'
  ) {
    throw createValidationError('Strategy Routing accepts only task-level Compute decisions');
  }

  if (
    value.target.id !== undefined &&
    (typeof value.target.id !== 'string' || value.target.id.trim().length === 0)
  ) {
    throw createValidationError('Compute task target id is invalid');
  }

  if (
    (value.assignment.model !== undefined &&
      (typeof value.assignment.model !== 'string' || value.assignment.model.trim().length === 0)) ||
    (value.assignment.reasoningEffort !== undefined &&
      (typeof value.assignment.reasoningEffort !== 'string' ||
        value.assignment.reasoningEffort.trim().length === 0))
  ) {
    throw createValidationError('Compute assignment strings are invalid');
  }

  const assignment = Object.freeze({
    ...(typeof value.assignment.model === 'string' ? { model: value.assignment.model } : {}),
    ...(typeof value.assignment.reasoningEffort === 'string'
      ? { reasoningEffort: value.assignment.reasoningEffort }
      : {}),
    status: value.assignment.status as TComputeAssignmentStatus,
  });

  return Object.freeze({
    assignment,
    confidence: value.confidence as TTaskConfidence,
    profile: value.profile as TComputeProfile,
    reasonCodes: validateStringList(
      value.reasonCodes,
      COMPUTE_REASON_CODES,
      'Compute reason codes',
    ),
    schemaVersion: COMPUTE_ROUTING_VERSIONS.decisionSchema,
    target: Object.freeze({
      ...(typeof value.target.id === 'string' ? { id: value.target.id } : {}),
      kind: 'task' as const,
    }),
  });
};

export const validateStrategyRoutingInput = (
  value: unknown,
): Readonly<IStrategyRoutingInput> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Strategy Routing input must be an object');
  }

  assertAllowedKeys(
    value,
    ['computeDecision', 'contextResolution', 'taskAnalysis'],
    'Strategy Routing input',
  );

  const taskAnalysis = validateTaskIntelligenceAnalysis(value.taskAnalysis);
  const contextResolution =
    value.contextResolution === undefined
      ? undefined
      : validateContextResolution(value.contextResolution);
  const computeDecision =
    value.computeDecision === undefined
      ? undefined
      : validateComputeDecision(value.computeDecision);

  return Object.freeze({
    ...(computeDecision ? { computeDecision } : {}),
    ...(contextResolution ? { contextResolution } : {}),
    taskAnalysis,
  });
};
