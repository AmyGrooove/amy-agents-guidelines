import { validateCompletionResult } from '../completion/validate-completion.js';
import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { validateRecoveryPlan } from '../recovery/validate-recovery.js';

import type {
  IOutcomeInput,
  IOutcomePostTaskSignal,
  IUserCorrectionDetectionInput,
  TOutcomeFailureClass,
  TPostTaskSignalImpact,
  TPostTaskSignalKind,
} from './outcome-intelligence-contract.js';

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

const checkIsRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

  if (!checkIsRecord(value)) {
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
  if (!checkIsRecord(value)) {
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
  if (!checkIsRecord(value)) {
    throw createValidationError('User correction detection input must be an object');
  }

  assertAllowedKeys(value, ['message', 'messageRef'], 'User correction detection input');

  return Object.freeze({
    message: validateBoundedString(value.message, 'User correction message', 4_000),
    messageRef: validateBoundedString(value.messageRef, 'User correction messageRef', 500),
  });
};
