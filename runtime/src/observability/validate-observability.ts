import { AmyRuntimeError } from '../errors/amy-runtime-error.js';

import type {
  IObservabilityDecisionInput,
  IObservabilityPolicyRef,
  IObservabilitySubject,
  IObservabilityTelemetryInput,
  TObservabilityConfidence,
  TObservabilityDecisionKind,
  TObservabilityInput,
  TObservabilitySubjectKind,
  TObservabilityTelemetryEvent,
} from './observability-contract.js';

const SUBJECT_KINDS: readonly TObservabilitySubjectKind[] = [
  'agent-run',
  'dag-node',
  'recovery',
  'runtime',
  'session',
  'task',
  'tool-call',
  'verification',
];
const TELEMETRY_EVENTS: readonly TObservabilityTelemetryEvent[] = [
  'cancelled',
  'completed',
  'failed',
  'observed',
  'started',
];
const DECISION_KINDS: readonly TObservabilityDecisionKind[] = [
  'classification',
  'compute',
  'context',
  'decomposition',
  'escalation',
  'parallelism',
  'recovery',
  'reviewer',
  'retry',
  'scout',
  'strategy',
  'verifier',
];
const CONFIDENCE_LEVELS: readonly TObservabilityConfidence[] = [
  'high',
  'low',
  'medium',
];

const checkIsRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createValidationError = (message: string) =>
  new AmyRuntimeError({
    code: 'VALIDATION_FAILURE',
    details: { capabilityId: 'amy.observability' },
    message,
  });

const validateUnknownKeys = (
  value: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
  label: string,
) => {
  const unknownKeys = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknownKeys.length > 0) {
    throw createValidationError(
      `Unknown ${label} fields: ${unknownKeys.join(', ')}`,
    );
  }
};

const validateBoundedString = (
  value: unknown,
  label: string,
  maxLength = 500,
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

  return value;
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

  if (value.length < minItems) {
    throw createValidationError(
      `${label} must contain at least ${minItems === 1 ? 'one item' : `${minItems} items`}`,
    );
  }

  if (value.length > options.maxItems) {
    throw createValidationError(
      `${label} must contain at most ${options.maxItems} items`,
    );
  }

  return Object.freeze(
    value.map((item, index) =>
      validateBoundedString(item, `${label}[${index}]`, 500),
    ),
  );
};

const validateSubject = (value: unknown): Readonly<IObservabilitySubject> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Observability subject must be an object');
  }

  validateUnknownKeys(value, ['id', 'kind'], 'observability subject');

  if (
    typeof value.kind !== 'string' ||
    !SUBJECT_KINDS.includes(value.kind as TObservabilitySubjectKind)
  ) {
    throw createValidationError('Observability subject kind is unsupported');
  }

  return Object.freeze({
    id: validateBoundedString(value.id, 'Observability subject id', 200),
    kind: value.kind as TObservabilitySubjectKind,
  });
};

const validatePolicy = (value: unknown): Readonly<IObservabilityPolicyRef> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Observability policy must be an object');
  }

  validateUnknownKeys(value, ['owner', 'version'], 'observability policy');

  if (!Number.isInteger(value.version) || (value.version as number) < 1) {
    throw createValidationError('Observability policy version must be a positive integer');
  }

  return Object.freeze({
    owner: validateBoundedString(value.owner, 'Observability policy owner', 120),
    version: value.version as number,
  });
};

const validateTelemetryInput = (
  value: Readonly<Record<string, unknown>>,
): Readonly<IObservabilityTelemetryInput> => {
  validateUnknownKeys(
    value,
    ['durationMs', 'errorCode', 'event', 'kind', 'recordId', 'refs', 'subject'],
    'observability input',
  );

  if (
    typeof value.event !== 'string' ||
    !TELEMETRY_EVENTS.includes(value.event as TObservabilityTelemetryEvent)
  ) {
    throw createValidationError('Observability telemetry event is unsupported');
  }

  if (
    value.durationMs !== undefined &&
    (typeof value.durationMs !== 'number' ||
      !Number.isFinite(value.durationMs) ||
      value.durationMs < 0)
  ) {
    throw createValidationError('Observability durationMs must be a finite non-negative number');
  }

  return Object.freeze({
    event: value.event as TObservabilityTelemetryEvent,
    kind: 'telemetry',
    recordId: validateBoundedString(value.recordId, 'Observability recordId', 200),
    subject: validateSubject(value.subject),
    ...(value.durationMs === undefined ? {} : { durationMs: value.durationMs }),
    ...(value.errorCode === undefined
      ? {}
      : { errorCode: validateBoundedString(value.errorCode, 'Observability errorCode', 120) }),
    ...(value.refs === undefined
      ? {}
      : { refs: validateStringList(value.refs, 'Observability refs', { maxItems: 32 }) }),
  });
};

const validateDecisionInput = (
  value: Readonly<Record<string, unknown>>,
): Readonly<IObservabilityDecisionInput> => {
  validateUnknownKeys(
    value,
    [
      'confidence',
      'decision',
      'decisionKind',
      'evidenceRefs',
      'explanation',
      'kind',
      'policy',
      'reasonCodes',
      'recordId',
      'subject',
    ],
    'observability input',
  );

  if (
    typeof value.decisionKind !== 'string' ||
    !DECISION_KINDS.includes(value.decisionKind as TObservabilityDecisionKind)
  ) {
    throw createValidationError('Observability decision kind is unsupported');
  }

  if (
    value.confidence !== undefined &&
    (typeof value.confidence !== 'string' ||
      !CONFIDENCE_LEVELS.includes(value.confidence as TObservabilityConfidence))
  ) {
    throw createValidationError('Observability confidence is unsupported');
  }

  return Object.freeze({
    decision: validateBoundedString(value.decision, 'Observability decision', 240),
    decisionKind: value.decisionKind as TObservabilityDecisionKind,
    evidenceRefs: validateStringList(value.evidenceRefs, 'Observability evidenceRefs', {
      maxItems: 32,
    }),
    kind: 'decision',
    policy: validatePolicy(value.policy),
    reasonCodes: validateStringList(value.reasonCodes, 'Observability reasonCodes', {
      maxItems: 24,
      minItems: 1,
    }),
    recordId: validateBoundedString(value.recordId, 'Observability recordId', 200),
    subject: validateSubject(value.subject),
    ...(value.confidence === undefined
      ? {}
      : { confidence: value.confidence as TObservabilityConfidence }),
    ...(value.explanation === undefined
      ? {}
      : {
          explanation: validateBoundedString(
            value.explanation,
            'Observability explanation',
            500,
          ),
        }),
  });
};

export const validateObservabilityInput = (
  value: unknown,
): Readonly<TObservabilityInput> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Observability input must be an object');
  }

  if (value.kind === 'telemetry') {
    return validateTelemetryInput(value);
  }

  if (value.kind === 'decision') {
    return validateDecisionInput(value);
  }

  throw createValidationError('Observability input kind is unsupported');
};
