import { validateCompletionResult } from '../completion/validate-completion.js';
import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { RECOVERY_LIMITS } from './recovery-contract.js';

import type {
  IRecoveryBranch,
  IRecoveryFact,
  IRecoveryFailureSignal,
  IRecoveryInput,
  IRecoveryPolicyConfig,
  TRecoveryBranchKind,
  TRecoveryFailureClass,
} from './recovery-contract.js';

const FAILURE_CLASSES = new Set<TRecoveryFailureClass>([
  'architecture-uncertainty',
  'context-understanding',
  'implementation',
  'integration',
  'tool',
  'verification',
]);
const BRANCH_KINDS = new Set<TRecoveryBranchKind>([
  'dag-node',
  'integration',
  'task',
  'verification',
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

const validateStringList = (value: unknown, label: string, minimum = 0) => {
  if (!Array.isArray(value)) {
    throw createValidationError(`${label} must be an array`);
  }

  const values = value.map((item) => validateNonEmptyString(item, label));

  if (values.length < minimum) {
    throw createValidationError(`${label} must contain at least ${minimum} item(s)`);
  }
  if (new Set(values).size !== values.length) {
    throw createValidationError(`${label} must not contain duplicates`);
  }

  return Object.freeze([...values]);
};

const validateNonNegativeInteger = (value: unknown, label: string, fallback?: number) => {
  if (value === undefined && fallback !== undefined) return fallback;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw createValidationError(`${label} must be a non-negative safe integer`);
  }
  return value as number;
};

const validateBranch = (value: unknown): Readonly<IRecoveryBranch> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Recovery branch must be an object');
  }

  assertAllowedKeys(value, ['id', 'kind'], 'Recovery branch');
  if (!BRANCH_KINDS.has(value.kind as TRecoveryBranchKind)) {
    throw createValidationError('Recovery branch kind is invalid');
  }

  return Object.freeze({
    id: validateNonEmptyString(value.id, 'Recovery branch id'),
    kind: value.kind as TRecoveryBranchKind,
  });
};

const validateFailure = (value: unknown): Readonly<IRecoveryFailureSignal> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Recovery failure must be an object');
  }

  assertAllowedKeys(
    value,
    ['branch', 'directRetryAllowed', 'evidenceRefs', 'failureClass', 'summary'],
    'Recovery failure',
  );
  if (!FAILURE_CLASSES.has(value.failureClass as TRecoveryFailureClass)) {
    throw createValidationError('Recovery failureClass is invalid');
  }

  if (typeof value.directRetryAllowed !== 'boolean') {
    throw createValidationError('Recovery failure directRetryAllowed must be boolean');
  }

  return Object.freeze({
    branch: validateBranch(value.branch),
    directRetryAllowed: value.directRetryAllowed,
    evidenceRefs: validateStringList(value.evidenceRefs, 'Recovery failure evidenceRefs', 1),
    failureClass: value.failureClass as TRecoveryFailureClass,
    summary: validateNonEmptyString(value.summary, 'Recovery failure summary'),
  });
};

const validateFacts = (value: unknown): readonly Readonly<IRecoveryFact>[] => {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw createValidationError('Recovery preservedFacts must be an array');
  }

  const facts = value.map((fact, index) => {
    if (!checkIsRecord(fact)) {
      throw createValidationError(`Recovery preservedFacts[${index}] must be an object`);
    }

    assertAllowedKeys(fact, ['ref', 'summary'], `Recovery preservedFacts[${index}]`);

    return Object.freeze({
      ref: validateNonEmptyString(fact.ref, `Recovery preservedFacts[${index}] ref`),
      summary: validateNonEmptyString(fact.summary, `Recovery preservedFacts[${index}] summary`),
    });
  });
  const refs = facts.map(({ ref }) => ref);

  if (new Set(refs).size !== refs.length) {
    throw createValidationError('Recovery preservedFacts refs must be unique');
  }

  return Object.freeze(facts);
};

export const validateRecoveryPolicy = (value: unknown): Readonly<IRecoveryPolicyConfig> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Recovery policy must be an object');
  }

  assertAllowedKeys(value, ['maxEscalations'], 'Recovery policy');
  const maxEscalations = validateNonNegativeInteger(
    value.maxEscalations,
    'Recovery policy maxEscalations',
  );

  if (maxEscalations > RECOVERY_LIMITS.maxEscalationsHardCap) {
    throw createValidationError(
      `Recovery policy maxEscalations must not exceed ${RECOVERY_LIMITS.maxEscalationsHardCap}`,
    );
  }

  return Object.freeze({ maxEscalations });
};

export const validateRecoveryInput = (value: unknown): Readonly<IRecoveryInput> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Recovery input must be an object');
  }

  assertAllowedKeys(
    value,
    ['completionResult', 'escalationCount', 'failure', 'preservedFacts', 'recoveryId'],
    'Recovery input',
  );

  return Object.freeze({
    completionResult: validateCompletionResult(value.completionResult),
    escalationCount: validateNonNegativeInteger(value.escalationCount, 'Recovery escalationCount', 0),
    failure: validateFailure(value.failure),
    preservedFacts: validateFacts(value.preservedFacts),
    recoveryId: validateNonEmptyString(value.recoveryId, 'Recovery id'),
  });
};
