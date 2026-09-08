import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { validateTaskIntelligenceAnalysis } from '../task-intelligence/validate-task-intelligence.js';
import { validateVerificationResult } from '../verification/validate-verification.js';
import { DEFAULT_COMPLETION_POLICY } from './completion-contract.js';

import type {
  ICompletionExecutionEvidence,
  ICompletionGuardInput,
  ICompletionInput,
  ICompletionIntegrationEvidence,
  TCompletionIntegrationStatus,
  TCompletionWorkStatus,
} from './completion-contract.js';

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
  if (!checkIsRecord(value)) {
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
  if (!checkIsRecord(value)) {
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
  if (!checkIsRecord(value)) {
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
  if (!checkIsRecord(value)) {
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
