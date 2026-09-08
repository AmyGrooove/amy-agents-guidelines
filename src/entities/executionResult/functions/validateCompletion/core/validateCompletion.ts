import { isRecord } from '#shared/functions/checks/isRecord';

import { AmyRuntimeError } from '#entities/runtime';
import { validateTaskIntelligenceAnalysis } from '#entities/task';
import { validateVerificationResult } from '#entities/verificationResult';
import { COMPLETION_VERSIONS, DEFAULT_COMPLETION_POLICY } from '../../../types/completionContract.js';

import type {
  ICompletionExecutionEvidence,
  ICompletionGuardInput,
  ICompletionInput,
  ICompletionIntegrationEvidence,
  TCompletionConfidence,
  TCompletionGuardDecision,
  TCompletionIntegrationStatus,
  TCompletionResult,
  TCompletionStatus,
  TCompletionWorkStatus,
} from '../../../types/completionContract.js';

const WORK_STATUSES = new Set<TCompletionWorkStatus>([
  'completed',
  'failed',
  'incomplete',
  'unverified',
]);
const INTEGRATION_STATUSES = new Set<TCompletionIntegrationStatus>([
  ...WORK_STATUSES,
  'not-required',
]);

const COMPLETION_STATUSES = new Set<TCompletionStatus>([
  'complete',
  'failed',
  'incomplete',
  'unverified',
]);
const COMPLETION_CONFIDENCES = new Set<TCompletionConfidence>([
  'high',
  'low',
  'medium',
]);
const COMPLETION_GUARD_DECISIONS = new Set<TCompletionGuardDecision>([
  'complete',
  'retry',
  'stop-failed',
  'stop-incomplete',
  'stop-unverified',
]);


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

const validateNonEmptyString = (value: unknown, label: string) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createValidationError(`${label} must be a non-empty string`);
  }

  return value.trim();
};

const validateStringList = (value: unknown, label: string) => {
  if (!Array.isArray(value)) {
    throw createValidationError(`${label} must be an array`);
  }

  const values = value.map((item) => validateNonEmptyString(item, label));

  if (new Set(values).size !== values.length) {
    throw createValidationError(`${label} must not contain duplicates`);
  }

  return Object.freeze([...values]);
};

const validateReason = (value: unknown, label: string) =>
  value === undefined ? undefined : validateNonEmptyString(value, label);

const validateExecution = (value: unknown): Readonly<ICompletionExecutionEvidence> => {
  if (!isRecord(value)) {
    throw createValidationError('Completion execution evidence must be an object');
  }

  assertAllowedKeys(
    value,
    ['evidenceRefs', 'reason', 'status', 'unresolvedIssues'],
    'Completion execution evidence',
  );

  if (!WORK_STATUSES.has(value.status as TCompletionWorkStatus)) {
    throw createValidationError('Completion execution status is invalid');
  }

  const status = value.status as TCompletionWorkStatus;
  const evidenceRefs = validateStringList(value.evidenceRefs, 'Completion execution evidenceRefs');
  const unresolvedIssues = validateStringList(
    value.unresolvedIssues,
    'Completion execution unresolvedIssues',
  );
  const reason = validateReason(value.reason, 'Completion execution reason');

  if ((status === 'completed' || status === 'failed') && evidenceRefs.length === 0) {
    throw createValidationError(`${status} completion execution requires evidence`);
  }
  if (
    (status === 'failed' || status === 'incomplete' || status === 'unverified') &&
    unresolvedIssues.length === 0 &&
    !reason
  ) {
    throw createValidationError(`${status} completion execution must explain the unresolved state`);
  }

  return Object.freeze({
    evidenceRefs,
    ...(reason ? { reason } : {}),
    status,
    unresolvedIssues,
  });
};

const validateIntegration = (
  value: unknown,
): Readonly<ICompletionIntegrationEvidence> => {
  if (!isRecord(value)) {
    throw createValidationError('Completion integration evidence must be an object');
  }

  assertAllowedKeys(
    value,
    ['evidenceRefs', 'reason', 'status'],
    'Completion integration evidence',
  );

  if (!INTEGRATION_STATUSES.has(value.status as TCompletionIntegrationStatus)) {
    throw createValidationError('Completion integration status is invalid');
  }

  const status = value.status as TCompletionIntegrationStatus;
  const evidenceRefs = validateStringList(value.evidenceRefs, 'Completion integration evidenceRefs');
  const reason = validateReason(value.reason, 'Completion integration reason');

  if ((status === 'completed' || status === 'failed') && evidenceRefs.length === 0) {
    throw createValidationError(`${status} completion integration requires evidence`);
  }
  if (
    (status === 'failed' || status === 'incomplete' || status === 'not-required' || status === 'unverified') &&
    !reason
  ) {
    throw createValidationError(`${status} completion integration requires a reason`);
  }

  return Object.freeze({
    evidenceRefs,
    ...(reason ? { reason } : {}),
    status,
  });
};

const validateOptionalInteger = (
  value: unknown,
  label: string,
  fallback: number,
) => {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw createValidationError(`${label} must be a non-negative safe integer`);
  }
  return value as number;
};

const validateGuard = (value: unknown): Readonly<ICompletionGuardInput> => {
  if (value === undefined) {
    return Object.freeze({
      maxRetries: DEFAULT_COMPLETION_POLICY.maxGuardRetries,
      retryCount: 0,
    });
  }
  if (!isRecord(value)) {
    throw createValidationError('Completion guard must be an object');
  }

  assertAllowedKeys(value, ['maxRetries', 'retryCount'], 'Completion guard');
  const maxRetries = validateOptionalInteger(
    value.maxRetries,
    'Completion guard maxRetries',
    DEFAULT_COMPLETION_POLICY.maxGuardRetries,
  );
  const retryCount = validateOptionalInteger(value.retryCount, 'Completion guard retryCount', 0);

  if (maxRetries > DEFAULT_COMPLETION_POLICY.maxGuardRetriesHardCap) {
    throw createValidationError(
      `Completion guard maxRetries must not exceed ${DEFAULT_COMPLETION_POLICY.maxGuardRetriesHardCap}`,
    );
  }

  return Object.freeze({ maxRetries, retryCount });
};

export const validateCompletionInput = (value: unknown): Readonly<ICompletionInput> => {
  if (!isRecord(value)) {
    throw createValidationError('Completion input must be an object');
  }

  assertAllowedKeys(
    value,
    ['completionId', 'execution', 'guard', 'integration', 'taskAnalysis', 'verificationResult'],
    'Completion input',
  );

  return Object.freeze({
    completionId: validateNonEmptyString(value.completionId, 'Completion id'),
    execution: validateExecution(value.execution),
    guard: validateGuard(value.guard),
    integration: validateIntegration(value.integration),
    taskAnalysis: validateTaskIntelligenceAnalysis(value.taskAnalysis),
    verificationResult: validateVerificationResult(value.verificationResult),
  });
};


export const validateCompletionResult = (value: unknown): Readonly<TCompletionResult> => {
  if (!isRecord(value)) {
    throw createValidationError('Completion result must be an object');
  }

  assertAllowedKeys(value, ['data', 'kind', 'schemaVersion'], 'Completion result');
  if (
    value.kind !== 'quality-result' ||
    value.schemaVersion !== COMPLETION_VERSIONS.resultSchema ||
    !isRecord(value.data)
  ) {
    throw createValidationError('Completion result identity is invalid');
  }

  assertAllowedKeys(
    value.data,
    ['completionId', 'confidence', 'evidence', 'guard', 'policyVersion', 'reasonCodes', 'status'],
    'Completion result data',
  );
  if (value.data.policyVersion !== COMPLETION_VERSIONS.policy) {
    throw createValidationError('Completion result policyVersion is unsupported');
  }
  if (!COMPLETION_STATUSES.has(value.data.status as TCompletionStatus)) {
    throw createValidationError('Completion result status is invalid');
  }
  if (!COMPLETION_CONFIDENCES.has(value.data.confidence as TCompletionConfidence)) {
    throw createValidationError('Completion result confidence is invalid');
  }
  if (!isRecord(value.data.guard)) {
    throw createValidationError('Completion result guard must be an object');
  }

  assertAllowedKeys(
    value.data.guard,
    ['decision', 'maxRetries', 'retriesRemaining', 'retryCount'],
    'Completion result guard',
  );
  if (!COMPLETION_GUARD_DECISIONS.has(value.data.guard.decision as TCompletionGuardDecision)) {
    throw createValidationError('Completion result guard decision is invalid');
  }
  const maxRetries = validateOptionalInteger(
    value.data.guard.maxRetries,
    'Completion result guard maxRetries',
    DEFAULT_COMPLETION_POLICY.maxGuardRetries,
  );
  const retryCount = validateOptionalInteger(
    value.data.guard.retryCount,
    'Completion result guard retryCount',
    0,
  );
  const retriesRemaining = validateOptionalInteger(
    value.data.guard.retriesRemaining,
    'Completion result guard retriesRemaining',
    0,
  );

  if (maxRetries > DEFAULT_COMPLETION_POLICY.maxGuardRetriesHardCap) {
    throw createValidationError(
      `Completion result guard maxRetries must not exceed ${DEFAULT_COMPLETION_POLICY.maxGuardRetriesHardCap}`,
    );
  }
  if (retriesRemaining !== Math.max(0, maxRetries - retryCount)) {
    throw createValidationError('Completion result guard retriesRemaining is inconsistent');
  }
  if (!isRecord(value.data.evidence)) {
    throw createValidationError('Completion result evidence must be an object');
  }
  if (value.data.evidence.kind !== 'completion-evidence' ||
    value.data.evidence.schemaVersion !== COMPLETION_VERSIONS.evidenceSchema) {
    throw createValidationError('Completion result evidence identity is invalid');
  }

  const reasonCodes = validateStringList(value.data.reasonCodes, 'Completion result reasonCodes');
  const completionId = validateNonEmptyString(value.data.completionId, 'Completion result completionId');

  return Object.freeze({
    data: Object.freeze({
      completionId,
      confidence: value.data.confidence as TCompletionConfidence,
      evidence: value.data.evidence as TCompletionResult['data']['evidence'],
      guard: Object.freeze({
        decision: value.data.guard.decision as TCompletionGuardDecision,
        maxRetries,
        retriesRemaining,
        retryCount,
      }),
      policyVersion: COMPLETION_VERSIONS.policy,
      reasonCodes: reasonCodes as TCompletionResult['data']['reasonCodes'],
      status: value.data.status as TCompletionStatus,
    }),
    kind: 'quality-result' as const,
    schemaVersion: COMPLETION_VERSIONS.resultSchema,
  });
};
