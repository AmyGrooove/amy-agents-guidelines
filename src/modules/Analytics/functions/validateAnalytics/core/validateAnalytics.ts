import { isRecord } from '#shared/functions/checks/isRecord';

import { AGENT_ROLES } from '#entities/agentRole';
import { AmyRuntimeError } from '#entities/runtime';
import { validateEvalRunResult } from '#modules/Evaluation';
import { validateOutcomeAssessment } from '#entities/executionResult';
import { validateStrategyRoutingDecision } from '#entities/executionPlan';
import { validateTaskIntelligenceAnalysis } from '#entities/task';
import {
  ANALYTICS_LIMITS,
} from '../../../types/analyticsContract.js';

import type { IObservabilityPolicyRef } from '#modules/Telemetry';
import type {
  IAnalyticsEvalRunSample,
  IAnalyticsExecutionObservation,
  IAnalyticsInput,
  IAnalyticsMechanismUse,
  IAnalyticsSegmentDefinition,
  IAnalyticsTaskSample,
  IAnalyticsUsage,
  IAnalyticsWindow,
  ITaskArchetypeDiscoveryInput,
  TAnalyticsMechanismSignal,
  TTaskArchetype,
} from '../../../types/analyticsContract.js';

const TASK_ARCHETYPES = new Set<TTaskArchetype>([
  'api-propagation',
  'bug-investigation',
  'exploration',
  'feature-modification',
  'other',
  'refactor',
  'testing',
]);


const createValidationError = (message: string) =>
  new AmyRuntimeError({
    code: 'VALIDATION_FAILURE',
    details: { capabilityId: 'amy.analytics' },
    message,
  });

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

const validateString = (value: unknown, label: string): string => {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > ANALYTICS_LIMITS.maxStringLength
  ) {
    throw createValidationError(
      `${label} must be a non-empty string up to ${ANALYTICS_LIMITS.maxStringLength} characters`,
    );
  }

  return value.trim();
};

const validateTimestamp = (value: unknown, label: string): string => {
  const timestamp = validateString(value, label);

  if (!Number.isFinite(Date.parse(timestamp))) {
    throw createValidationError(`${label} must be a valid timestamp`);
  }

  return timestamp;
};

const validateNonNegativeNumber = (
  value: unknown,
  label: string,
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw createValidationError(`${label} must be a finite non-negative number`);
  }

  return value;
};

const validatePolicyRef = (
  value: unknown,
  label: string,
): Readonly<IObservabilityPolicyRef> => {
  if (!isRecord(value)) {
    throw createValidationError(`${label} must be an object`);
  }

  assertAllowedKeys(value, ['owner', 'version'], label);

  if (!Number.isInteger(value.version) || (value.version as number) < 1) {
    throw createValidationError(`${label} version must be a positive integer`);
  }

  return Object.freeze({
    owner: validateString(value.owner, `${label} owner`),
    version: value.version as number,
  });
};

const validatePolicyRefs = (
  value: unknown,
  label: string,
): readonly Readonly<IObservabilityPolicyRef>[] => {
  if (!Array.isArray(value) || value.length > ANALYTICS_LIMITS.maxPolicyRefsPerSample) {
    throw createValidationError(
      `${label} must contain at most ${ANALYTICS_LIMITS.maxPolicyRefsPerSample} items`,
    );
  }

  const refs = value.map((item, index) => validatePolicyRef(item, `${label}[${index}]`));
  const keys = refs.map(({ owner, version }) => `${owner}:${version}`);

  if (new Set(keys).size !== keys.length) {
    throw createValidationError(`${label} must not contain duplicates`);
  }

  return Object.freeze(refs);
};


const MECHANISM_SIGNALS = new Set<TAnalyticsMechanismSignal>([
  'caught-issue',
  'recovered-failure',
  'unnecessary-invocation',
  'useful-evidence',
  'user-correction',
]);

const validateInteger = (
  value: unknown,
  label: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number => {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw createValidationError(`${label} must be an integer between ${minimum} and ${maximum}`);
  }

  return value as number;
};

const validateExecutionObservation = (
  value: unknown,
): Readonly<IAnalyticsExecutionObservation> => {
  if (!isRecord(value)) {
    throw createValidationError('Analytics execution observation must be an object');
  }

  assertAllowedKeys(
    value,
    ['contextItems', 'reasoningEffort', 'workerCount'],
    'Analytics execution observation',
  );

  if (Object.keys(value).length === 0) {
    throw createValidationError('Analytics execution observation must contain at least one measurement');
  }

  return Object.freeze({
    ...(value.contextItems === undefined
      ? {}
      : { contextItems: validateInteger(value.contextItems, 'Analytics execution contextItems', 0) }),
    ...(value.reasoningEffort === undefined
      ? {}
      : { reasoningEffort: validateString(value.reasoningEffort, 'Analytics execution reasoningEffort') }),
    ...(value.workerCount === undefined
      ? {}
      : { workerCount: validateInteger(value.workerCount, 'Analytics execution workerCount', 0) }),
  });
};

const validateMechanismUse = (
  value: unknown,
  index: number,
): Readonly<IAnalyticsMechanismUse> => {
  const label = `Analytics mechanism use[${index}]`;

  if (!isRecord(value)) {
    throw createValidationError(`${label} must be an object`);
  }

  assertAllowedKeys(value, ['id', 'invocationCount', 'kind', 'signals', 'usage', 'version'], label);

  if (value.kind !== 'agent' && value.kind !== 'skill') {
    throw createValidationError(`${label} kind must be agent or skill`);
  }

  const id = validateString(value.id, `${label} id`);
  if (value.kind === 'agent' && !AGENT_ROLES.includes(id as (typeof AGENT_ROLES)[number])) {
    throw createValidationError(`${label} agent mechanism id must be a canonical agent role`);
  }

  if (!Array.isArray(value.signals) || value.signals.length > MECHANISM_SIGNALS.size) {
    throw createValidationError(`${label} signals must be a bounded array`);
  }

  const signals = value.signals.map((signal) => {
    if (typeof signal !== 'string' || !MECHANISM_SIGNALS.has(signal as TAnalyticsMechanismSignal)) {
      throw createValidationError(`${label} contains an unsupported signal`);
    }

    return signal as TAnalyticsMechanismSignal;
  });

  if (new Set(signals).size !== signals.length) {
    throw createValidationError(`${label} signals must not contain duplicates`);
  }

  return Object.freeze({
    id,
    invocationCount: validateInteger(
      value.invocationCount,
      `${label} invocationCount`,
      1,
      ANALYTICS_LIMITS.maxMechanismInvocations,
    ),
    kind: value.kind,
    signals: Object.freeze(signals),
    ...(value.usage === undefined ? {} : { usage: validateUsage(value.usage) }),
    version: validateString(value.version, `${label} version`),
  });
};

const validateMechanisms = (
  value: unknown,
): readonly Readonly<IAnalyticsMechanismUse>[] => {
  if (!Array.isArray(value) || value.length > ANALYTICS_LIMITS.maxMechanismsPerTask) {
    throw createValidationError(
      `Analytics task sample mechanisms must contain at most ${ANALYTICS_LIMITS.maxMechanismsPerTask} items`,
    );
  }

  const mechanisms = value.map(validateMechanismUse);
  const keys = mechanisms.map(({ id, kind, version }) => `${kind}:${id}:${version}`);

  if (new Set(keys).size !== keys.length) {
    throw createValidationError('Analytics task sample mechanisms must not contain duplicate mechanism versions');
  }

  return Object.freeze(mechanisms);
};

const validateUsage = (value: unknown): Readonly<IAnalyticsUsage> => {
  if (!isRecord(value)) {
    throw createValidationError('Analytics task sample usage must be an object');
  }

  assertAllowedKeys(value, ['costUnits', 'durationMs', 'tokens'], 'Analytics task sample usage');

  if (Object.keys(value).length === 0) {
    throw createValidationError('Analytics task sample usage must contain at least one measurement');
  }

  return Object.freeze({
    ...(value.costUnits === undefined
      ? {}
      : { costUnits: validateNonNegativeNumber(value.costUnits, 'Analytics usage costUnits') }),
    ...(value.durationMs === undefined
      ? {}
      : { durationMs: validateNonNegativeNumber(value.durationMs, 'Analytics usage durationMs') }),
    ...(value.tokens === undefined
      ? {}
      : { tokens: validateNonNegativeNumber(value.tokens, 'Analytics usage tokens') }),
  });
};

export const validateAnalyticsTaskSample = (
  value: unknown,
): Readonly<IAnalyticsTaskSample> => {
  if (!isRecord(value)) {
    throw createValidationError('Analytics task sample must be an object');
  }

  assertAllowedKeys(
    value,
    [
      'execution',
      'mechanisms',
      'observedAt',
      'outcomeAssessment',
      'policyRefs',
      'sampleId',
      'strategyDecision',
      'taskAnalysis',
      'usage',
    ],
    'Analytics task sample',
  );

  return Object.freeze({
    ...(value.execution === undefined ? {} : { execution: validateExecutionObservation(value.execution) }),
    ...(value.mechanisms === undefined ? {} : { mechanisms: validateMechanisms(value.mechanisms) }),
    observedAt: validateTimestamp(value.observedAt, 'Analytics task sample observedAt'),
    ...(value.outcomeAssessment === undefined
      ? {}
      : { outcomeAssessment: validateOutcomeAssessment(value.outcomeAssessment) }),
    policyRefs: validatePolicyRefs(value.policyRefs, 'Analytics task sample policyRefs'),
    sampleId: validateString(value.sampleId, 'Analytics task sample sampleId'),
    ...(value.strategyDecision === undefined
      ? {}
      : { strategyDecision: validateStrategyRoutingDecision(value.strategyDecision) }),
    taskAnalysis: validateTaskIntelligenceAnalysis(value.taskAnalysis),
    ...(value.usage === undefined ? {} : { usage: validateUsage(value.usage) }),
  });
};

export const validateAnalyticsEvalRunSample = (
  value: unknown,
): Readonly<IAnalyticsEvalRunSample> => {
  if (!isRecord(value)) {
    throw createValidationError('Analytics eval run sample must be an object');
  }

  assertAllowedKeys(
    value,
    ['observedAt', 'policyRefs', 'run', 'sampleId'],
    'Analytics eval run sample',
  );

  return Object.freeze({
    observedAt: validateTimestamp(value.observedAt, 'Analytics eval run sample observedAt'),
    policyRefs: validatePolicyRefs(value.policyRefs, 'Analytics eval run sample policyRefs'),
    run: validateEvalRunResult(value.run),
    sampleId: validateString(value.sampleId, 'Analytics eval run sample sampleId'),
  });
};

const validateArchetypes = (value: unknown, label: string): readonly TTaskArchetype[] => {
  if (!Array.isArray(value) || value.length === 0 || value.length > TASK_ARCHETYPES.size) {
    throw createValidationError(`${label} must be a non-empty bounded array`);
  }

  const archetypes = value.map((item) => {
    if (typeof item !== 'string' || !TASK_ARCHETYPES.has(item as TTaskArchetype)) {
      throw createValidationError(`${label} contains an unsupported archetype`);
    }

    return item as TTaskArchetype;
  });

  if (new Set(archetypes).size !== archetypes.length) {
    throw createValidationError(`${label} must not contain duplicates`);
  }

  return Object.freeze(archetypes);
};

const validateSegment = (
  value: unknown,
  index: number,
): Readonly<IAnalyticsSegmentDefinition> => {
  const label = `Analytics segments[${index}]`;

  if (!isRecord(value)) {
    throw createValidationError(`${label} must be an object`);
  }

  assertAllowedKeys(value, ['archetypes', 'policyRefs', 'segmentId'], label);

  if (value.archetypes === undefined && value.policyRefs === undefined) {
    throw createValidationError(`${label} must define at least one filter`);
  }

  return Object.freeze({
    ...(value.archetypes === undefined
      ? {}
      : { archetypes: validateArchetypes(value.archetypes, `${label} archetypes`) }),
    ...(value.policyRefs === undefined
      ? {}
      : { policyRefs: validatePolicyRefs(value.policyRefs, `${label} policyRefs`) }),
    segmentId: validateString(value.segmentId, `${label} segmentId`),
  });
};

const validateWindow = (value: unknown): Readonly<IAnalyticsWindow> => {
  if (!isRecord(value)) {
    throw createValidationError('Analytics window must be an object');
  }

  assertAllowedKeys(value, ['fromInclusive', 'toExclusive'], 'Analytics window');

  if (value.fromInclusive === undefined && value.toExclusive === undefined) {
    throw createValidationError('Analytics window must define at least one boundary');
  }

  const fromInclusive = value.fromInclusive === undefined
    ? undefined
    : validateTimestamp(value.fromInclusive, 'Analytics window fromInclusive');
  const toExclusive = value.toExclusive === undefined
    ? undefined
    : validateTimestamp(value.toExclusive, 'Analytics window toExclusive');

  if (
    fromInclusive !== undefined &&
    toExclusive !== undefined &&
    Date.parse(fromInclusive) >= Date.parse(toExclusive)
  ) {
    throw createValidationError('Analytics window fromInclusive must be before toExclusive');
  }

  return Object.freeze({
    ...(fromInclusive === undefined ? {} : { fromInclusive }),
    ...(toExclusive === undefined ? {} : { toExclusive }),
  });
};

export const validateAnalyticsInput = (value: unknown): Readonly<IAnalyticsInput> => {
  if (!isRecord(value)) {
    throw createValidationError('Analytics input must be an object');
  }

  assertAllowedKeys(
    value,
    ['evalRunSamples', 'reportId', 'segments', 'taskSamples', 'window'],
    'Analytics input',
  );

  if (
    !Array.isArray(value.taskSamples) ||
    value.taskSamples.length > ANALYTICS_LIMITS.maxTaskSamples ||
    !Array.isArray(value.evalRunSamples) ||
    value.evalRunSamples.length > ANALYTICS_LIMITS.maxEvalRunSamples ||
    !Array.isArray(value.segments) ||
    value.segments.length > ANALYTICS_LIMITS.maxSegments
  ) {
    throw createValidationError('Analytics input collections exceed their limits');
  }

  const taskSamples = value.taskSamples.map(validateAnalyticsTaskSample);
  const evalRunSamples = value.evalRunSamples.map(validateAnalyticsEvalRunSample);
  const segments = value.segments.map(validateSegment);
  const sampleIds = [...taskSamples, ...evalRunSamples].map(({ sampleId }) => sampleId);
  const segmentIds = segments.map(({ segmentId }) => segmentId);

  if (new Set(sampleIds).size !== sampleIds.length) {
    throw createValidationError('Analytics sample ids must be unique');
  }
  if (new Set(segmentIds).size !== segmentIds.length || segmentIds.includes('overall')) {
    throw createValidationError('Analytics segment ids must be unique and cannot use overall');
  }

  return Object.freeze({
    evalRunSamples: Object.freeze(evalRunSamples),
    reportId: validateString(value.reportId, 'Analytics reportId'),
    segments: Object.freeze(segments),
    taskSamples: Object.freeze(taskSamples),
    ...(value.window === undefined ? {} : { window: validateWindow(value.window) }),
  });
};

export const validateTaskArchetypeDiscoveryInput = (
  value: unknown,
): Readonly<ITaskArchetypeDiscoveryInput> => {
  if (!isRecord(value)) {
    throw createValidationError('Task archetype discovery input must be an object');
  }

  assertAllowedKeys(value, ['taskSamples'], 'Task archetype discovery input');

  if (!Array.isArray(value.taskSamples) || value.taskSamples.length > ANALYTICS_LIMITS.maxTaskSamples) {
    throw createValidationError('Task archetype discovery taskSamples exceed their limit');
  }

  const taskSamples = value.taskSamples.map(validateAnalyticsTaskSample);
  const ids = taskSamples.map(({ sampleId }) => sampleId);

  if (new Set(ids).size !== ids.length) {
    throw createValidationError('Task archetype discovery sample ids must be unique');
  }

  return Object.freeze({ taskSamples: Object.freeze(taskSamples) });
};
