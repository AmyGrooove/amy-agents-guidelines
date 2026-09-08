import { validateCompletionResult } from '../completion/validate-completion.js';
import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { RECOVERY_LIMITS, RECOVERY_VERSIONS } from './recovery-contract.js';

import type {
  IRecoveryBranch,
  IRecoveryFact,
  IRecoveryAttemptState,
  IRecoveryDiagnosis,
  IRecoveryFailureSignal,
  IRecoveryInput,
  IRecoveryPlanData,
  IRecoveryPolicyConfig,
  TRecoveryAction,
  TRecoveryBranchKind,
  TRecoveryFailureClass,
  TRecoveryPlan,
  TRecoveryReasonCode,
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
const RECOVERY_ACTIONS = new Set<TRecoveryAction>([
  'compute-escalate',
  'context-expand',
  'debugger',
  'retry',
  'stop',
]);
const RECOVERY_REASON_CODES = new Set<TRecoveryReasonCode>([
  'completion-already-complete',
  'completion-guard-terminal',
  'compute-escalation-required',
  'context-expansion-required',
  'debugger-required',
  'direct-retry-not-authorized',
  'escalation-budget-exhausted',
  'failure-diagnosed',
  'failure-evidence-preserved',
  'retry-budget-available',
  'scoped-retry',
  'verification-required',
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


const validateRecoveryDiagnosis = (value: unknown): Readonly<IRecoveryDiagnosis> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Recovery plan diagnosis must be an object');
  }

  assertAllowedKeys(
    value,
    ['branch', 'directRetryAllowed', 'evidenceRefs', 'failureClass', 'kind', 'schemaVersion', 'summary'],
    'Recovery plan diagnosis',
  );
  if (
    value.kind !== 'recovery-diagnosis' ||
    value.schemaVersion !== RECOVERY_VERSIONS.diagnosisSchema
  ) {
    throw createValidationError('Recovery plan diagnosis identity is invalid');
  }
  if (!FAILURE_CLASSES.has(value.failureClass as TRecoveryFailureClass)) {
    throw createValidationError('Recovery plan diagnosis failureClass is invalid');
  }
  if (typeof value.directRetryAllowed !== 'boolean') {
    throw createValidationError('Recovery plan diagnosis directRetryAllowed must be boolean');
  }

  return Object.freeze({
    branch: validateBranch(value.branch),
    directRetryAllowed: value.directRetryAllowed,
    evidenceRefs: validateStringList(value.evidenceRefs, 'Recovery plan diagnosis evidenceRefs', 1),
    failureClass: value.failureClass as TRecoveryFailureClass,
    kind: 'recovery-diagnosis',
    schemaVersion: RECOVERY_VERSIONS.diagnosisSchema,
    summary: validateNonEmptyString(value.summary, 'Recovery plan diagnosis summary'),
  });
};

const validateRecoveryAttempt = (value: unknown): Readonly<IRecoveryAttemptState> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Recovery plan attempt must be an object');
  }

  assertAllowedKeys(
    value,
    [
      'escalationCount',
      'escalationsRemaining',
      'nextEscalationCount',
      'nextRetryCount',
      'retriesRemaining',
      'retryCount',
    ],
    'Recovery plan attempt',
  );

  return Object.freeze({
    escalationCount: validateNonNegativeInteger(value.escalationCount, 'Recovery plan escalationCount'),
    escalationsRemaining: validateNonNegativeInteger(value.escalationsRemaining, 'Recovery plan escalationsRemaining'),
    retriesRemaining: validateNonNegativeInteger(value.retriesRemaining, 'Recovery plan retriesRemaining'),
    retryCount: validateNonNegativeInteger(value.retryCount, 'Recovery plan retryCount'),
    ...(value.nextEscalationCount === undefined
      ? {}
      : { nextEscalationCount: validateNonNegativeInteger(value.nextEscalationCount, 'Recovery plan nextEscalationCount') }),
    ...(value.nextRetryCount === undefined
      ? {}
      : { nextRetryCount: validateNonNegativeInteger(value.nextRetryCount, 'Recovery plan nextRetryCount') }),
  });
};

export const validateRecoveryPlan = (value: unknown): Readonly<TRecoveryPlan> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Recovery plan must be an object');
  }

  assertAllowedKeys(value, ['data', 'kind', 'schemaVersion'], 'Recovery plan');
  if (
    value.kind !== 'execution-plan' ||
    value.schemaVersion !== RECOVERY_VERSIONS.planSchema ||
    !checkIsRecord(value.data)
  ) {
    throw createValidationError('Recovery plan identity is invalid');
  }

  const data = value.data;
  assertAllowedKeys(
    data,
    [
      'action',
      'attempt',
      'diagnosis',
      'policyVersion',
      'preservedFacts',
      'reasonCodes',
      'recoveryId',
      'requiresVerification',
    ],
    'Recovery plan data',
  );
  if (data.policyVersion !== RECOVERY_VERSIONS.policy) {
    throw createValidationError('Recovery plan policyVersion is unsupported');
  }
  if (!RECOVERY_ACTIONS.has(data.action as TRecoveryAction)) {
    throw createValidationError('Recovery plan action is unsupported');
  }
  if (typeof data.requiresVerification !== 'boolean') {
    throw createValidationError('Recovery plan requiresVerification must be boolean');
  }
  if (!Array.isArray(data.preservedFacts)) {
    throw createValidationError('Recovery plan preservedFacts must be an array');
  }

  const reasonCodes = validateStringList(data.reasonCodes, 'Recovery plan reasonCodes', 1);
  if (reasonCodes.some((reason) => !RECOVERY_REASON_CODES.has(reason as TRecoveryReasonCode))) {
    throw createValidationError('Recovery plan reasonCodes contain an unsupported value');
  }

  const planData: IRecoveryPlanData = Object.freeze({
    action: data.action as TRecoveryAction,
    attempt: validateRecoveryAttempt(data.attempt),
    diagnosis: validateRecoveryDiagnosis(data.diagnosis),
    policyVersion: RECOVERY_VERSIONS.policy,
    preservedFacts: validateFacts(data.preservedFacts),
    reasonCodes: Object.freeze(reasonCodes as readonly TRecoveryReasonCode[]),
    recoveryId: validateNonEmptyString(data.recoveryId, 'Recovery plan recoveryId'),
    requiresVerification: data.requiresVerification,
  });

  return Object.freeze({
    data: planData,
    kind: 'execution-plan',
    schemaVersion: RECOVERY_VERSIONS.planSchema,
  });
};
