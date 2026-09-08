import { isRecord } from '#shared/functions/checks/isRecord';

import { validateCompletionResult } from '../../validateCompletion/core/validateCompletion.js';
import { AmyRuntimeError } from '#entities/runtime';
import { validateRecoveryPlan } from '../../validateRecovery/index.js';
import { OUTCOME_INTELLIGENCE_VERSIONS } from '../../../types/outcomeIntelligenceContract.js';

import type {
  IOutcomeAssessment,
  IOutcomeFailure,
  IOutcomeInput,
  IOutcomePostTaskSignal,
  IUserCorrectionDetectionInput,
  TOutcomeConfidence,
  TOutcomeFailureClass,
  TOutcomeFailureSource,
  TOutcomeReasonCode,
  TOutcomeStatus,
  TPostTaskSignalImpact,
  TPostTaskSignalKind,
} from '../../../types/outcomeIntelligenceContract.js';

const POST_TASK_SIGNAL_KINDS = new Set<TPostTaskSignalKind>([
  'follow-up-bug',
  'later-rewrite',
  'revert',
  'user-correction',
]);
const POST_TASK_SIGNAL_IMPACTS = new Set<TPostTaskSignalImpact>([
  'failure',
  'partial',
]);
const OUTCOME_FAILURE_CLASSES = new Set<TOutcomeFailureClass>([
  'classification',
  'context',
  'decomposition',
  'documentation',
  'implementation',
  'integration',
  'planning',
  'routing',
  'runtime',
  'tool',
  'unknown',
  'verification',
]);


const OUTCOME_STATUSES = new Set<TOutcomeStatus>([
  'failure',
  'partial_success',
  'success',
  'unknown',
  'unverified',
]);
const OUTCOME_CONFIDENCES = new Set<TOutcomeConfidence>(['high', 'low', 'medium']);
const OUTCOME_FAILURE_SOURCES = new Set<TOutcomeFailureSource>([
  'completion',
  'post-task',
  'recovery',
]);
const OUTCOME_REASON_CODES = new Set<TOutcomeReasonCode>([
  'completion-evidence-missing',
  'completion-failed',
  'completion-incomplete',
  'completion-succeeded',
  'completion-unverified',
  'failure-classified',
  'post-task-failure-signal',
  'post-task-partial-signal',
  'recovery-observed',
]);


const createValidationError = (message: string) =>
  new AmyRuntimeError({
    code: 'VALIDATION_FAILURE',
    details: { capabilityId: 'amy.outcome-intelligence' },
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

const validateBoundedString = (
  value: unknown,
  label: string,
  maxLength: number,
): string => {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    throw createValidationError(
      `${label} must be a non-empty string up to ${maxLength} characters`,
    );
  }

  return value.trim();
};

const validateStringList = (
  value: unknown,
  label: string,
  options: Readonly<{ maxItems: number; minItems?: number }>,
): readonly string[] => {
  if (!Array.isArray(value)) {
    throw createValidationError(`${label} must be an array`);
  }

  const minItems = options.minItems ?? 0;

  if (value.length < minItems || value.length > options.maxItems) {
    throw createValidationError(
      `${label} must contain between ${minItems} and ${options.maxItems} items`,
    );
  }

  const values = value.map((entry, index) =>
    validateBoundedString(entry, `${label}[${index}]`, 500),
  );

  if (new Set(values).size !== values.length) {
    throw createValidationError(`${label} must not contain duplicates`);
  }

  return Object.freeze(values);
};

const getDefaultImpact = (kind: TPostTaskSignalKind): TPostTaskSignalImpact =>
  kind === 'follow-up-bug' || kind === 'revert' ? 'failure' : 'partial';

const validatePostTaskSignal = (
  value: unknown,
  index: number,
): Readonly<IOutcomePostTaskSignal> => {
  const label = `Outcome postTaskSignals[${index}]`;

  if (!isRecord(value)) {
    throw createValidationError(`${label} must be an object`);
  }

  assertAllowedKeys(
    value,
    ['evidenceRefs', 'failureClass', 'impact', 'kind', 'summary'],
    label,
  );

  if (
    typeof value.kind !== 'string' ||
    !POST_TASK_SIGNAL_KINDS.has(value.kind as TPostTaskSignalKind)
  ) {
    throw createValidationError(`${label} kind is unsupported`);
  }

  if (
    value.impact !== undefined &&
    (typeof value.impact !== 'string' ||
      !POST_TASK_SIGNAL_IMPACTS.has(value.impact as TPostTaskSignalImpact))
  ) {
    throw createValidationError(`${label} impact is unsupported`);
  }

  if (
    value.failureClass !== undefined &&
    (typeof value.failureClass !== 'string' ||
      !OUTCOME_FAILURE_CLASSES.has(value.failureClass as TOutcomeFailureClass))
  ) {
    throw createValidationError(`${label} failureClass is unsupported`);
  }

  const kind = value.kind as TPostTaskSignalKind;

  return Object.freeze({
    evidenceRefs: validateStringList(value.evidenceRefs, `${label} evidenceRefs`, {
      maxItems: 16,
      minItems: 1,
    }),
    kind,
    summary: validateBoundedString(value.summary, `${label} summary`, 500),
    ...(value.failureClass === undefined
      ? {}
      : { failureClass: value.failureClass as TOutcomeFailureClass }),
    impact:
      value.impact === undefined
        ? getDefaultImpact(kind)
        : (value.impact as TPostTaskSignalImpact),
  });
};

export const validateOutcomeInput = (value: unknown): Readonly<IOutcomeInput> => {
  if (!isRecord(value)) {
    throw createValidationError('Outcome input must be an object');
  }

  assertAllowedKeys(
    value,
    ['completionResult', 'outcomeId', 'postTaskSignals', 'recoveryPlans', 'taskId'],
    'Outcome input',
  );

  if (value.recoveryPlans !== undefined && !Array.isArray(value.recoveryPlans)) {
    throw createValidationError('Outcome recoveryPlans must be an array');
  }
  if (Array.isArray(value.recoveryPlans) && value.recoveryPlans.length > 16) {
    throw createValidationError('Outcome recoveryPlans must contain at most 16 items');
  }
  if (value.postTaskSignals !== undefined && !Array.isArray(value.postTaskSignals)) {
    throw createValidationError('Outcome postTaskSignals must be an array');
  }
  if (Array.isArray(value.postTaskSignals) && value.postTaskSignals.length > 16) {
    throw createValidationError('Outcome postTaskSignals must contain at most 16 items');
  }

  return Object.freeze({
    outcomeId: validateBoundedString(value.outcomeId, 'Outcome outcomeId', 200),
    taskId: validateBoundedString(value.taskId, 'Outcome taskId', 200),
    ...(value.completionResult === undefined
      ? {}
      : { completionResult: validateCompletionResult(value.completionResult) }),
    ...(value.postTaskSignals === undefined
      ? {}
      : {
          postTaskSignals: Object.freeze(
            (value.postTaskSignals as unknown[]).map((signal, index) =>
              validatePostTaskSignal(signal, index),
            ),
          ),
        }),
    ...(value.recoveryPlans === undefined
      ? {}
      : {
          recoveryPlans: Object.freeze(
            (value.recoveryPlans as unknown[]).map((plan) => validateRecoveryPlan(plan)),
          ),
        }),
  });
};

export const validateUserCorrectionDetectionInput = (
  value: unknown,
): Readonly<IUserCorrectionDetectionInput> => {
  if (!isRecord(value)) {
    throw createValidationError('User correction detection input must be an object');
  }

  assertAllowedKeys(value, ['message', 'messageRef'], 'User correction detection input');

  return Object.freeze({
    message: validateBoundedString(value.message, 'User correction message', 4_000),
    messageRef: validateBoundedString(value.messageRef, 'User correction messageRef', 500),
  });
};

const validateOutcomeFailure = (
  value: unknown,
  index: number,
): Readonly<IOutcomeFailure> => {
  const label = `Outcome assessment failures[${index}]`;

  if (!isRecord(value)) {
    throw createValidationError(`${label} must be an object`);
  }

  assertAllowedKeys(
    value,
    ['evidenceRefs', 'failureClass', 'failureId', 'kind', 'schemaVersion', 'source', 'summary'],
    label,
  );

  if (
    value.kind !== 'failure-intelligence' ||
    value.schemaVersion !== OUTCOME_INTELLIGENCE_VERSIONS.failureSchema ||
    !OUTCOME_FAILURE_CLASSES.has(value.failureClass as TOutcomeFailureClass) ||
    !OUTCOME_FAILURE_SOURCES.has(value.source as TOutcomeFailureSource)
  ) {
    throw createValidationError(`${label} identity or taxonomy is invalid`);
  }

  return Object.freeze({
    evidenceRefs: validateStringList(value.evidenceRefs, `${label} evidenceRefs`, {
      maxItems: 64,
    }),
    failureClass: value.failureClass as TOutcomeFailureClass,
    failureId: validateBoundedString(value.failureId, `${label} failureId`, 300),
    kind: 'failure-intelligence' as const,
    schemaVersion: OUTCOME_INTELLIGENCE_VERSIONS.failureSchema,
    source: value.source as TOutcomeFailureSource,
    summary: validateBoundedString(value.summary, `${label} summary`, 500),
  });
};

export const validateOutcomeAssessment = (
  value: unknown,
): Readonly<IOutcomeAssessment> => {
  if (!isRecord(value)) {
    throw createValidationError('Outcome assessment must be an object');
  }

  assertAllowedKeys(
    value,
    [
      'attempts',
      'confidence',
      'evidenceRefs',
      'failures',
      'kind',
      'outcomeId',
      'reasonCodes',
      'schemaVersion',
      'status',
      'taskId',
      'unresolvedIssues',
    ],
    'Outcome assessment',
  );

  if (
    value.kind !== 'outcome-assessment' ||
    value.schemaVersion !== OUTCOME_INTELLIGENCE_VERSIONS.outcomeSchema ||
    !OUTCOME_STATUSES.has(value.status as TOutcomeStatus) ||
    !OUTCOME_CONFIDENCES.has(value.confidence as TOutcomeConfidence) ||
    !isRecord(value.attempts) ||
    !Array.isArray(value.failures)
  ) {
    throw createValidationError('Outcome assessment identity is invalid');
  }

  assertAllowedKeys(
    value.attempts,
    ['escalationCount', 'retryCount'],
    'Outcome assessment attempts',
  );

  const retryCount = value.attempts.retryCount;
  const escalationCount = value.attempts.escalationCount;

  if (
    !Number.isInteger(retryCount) ||
    (retryCount as number) < 0 ||
    !Number.isInteger(escalationCount) ||
    (escalationCount as number) < 0
  ) {
    throw createValidationError('Outcome assessment attempts are invalid');
  }

  if (value.failures.length > 64) {
    throw createValidationError('Outcome assessment failures must contain at most 64 items');
  }

  if (!Array.isArray(value.reasonCodes)) {
    throw createValidationError('Outcome assessment reasonCodes must be an array');
  }

  const reasonCodes = value.reasonCodes.map((reason) => {
    if (typeof reason !== 'string' || !OUTCOME_REASON_CODES.has(reason as TOutcomeReasonCode)) {
      throw createValidationError('Outcome assessment reasonCodes contain an invalid value');
    }

    return reason as TOutcomeReasonCode;
  });

  if (new Set(reasonCodes).size !== reasonCodes.length) {
    throw createValidationError('Outcome assessment reasonCodes must not contain duplicates');
  }

  return Object.freeze({
    attempts: Object.freeze({
      escalationCount: escalationCount as number,
      retryCount: retryCount as number,
    }),
    confidence: value.confidence as TOutcomeConfidence,
    evidenceRefs: validateStringList(value.evidenceRefs, 'Outcome assessment evidenceRefs', {
      maxItems: 128,
    }),
    failures: Object.freeze(value.failures.map(validateOutcomeFailure)),
    kind: 'outcome-assessment' as const,
    outcomeId: validateBoundedString(value.outcomeId, 'Outcome assessment outcomeId', 200),
    reasonCodes: Object.freeze(reasonCodes),
    schemaVersion: OUTCOME_INTELLIGENCE_VERSIONS.outcomeSchema,
    status: value.status as TOutcomeStatus,
    taskId: validateBoundedString(value.taskId, 'Outcome assessment taskId', 200),
    unresolvedIssues: validateStringList(
      value.unresolvedIssues,
      'Outcome assessment unresolvedIssues',
      { maxItems: 64 },
    ),
  });
};

