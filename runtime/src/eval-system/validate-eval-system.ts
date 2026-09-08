import { validateCompletionResult } from '../completion/validate-completion.js';
import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { validateOutcomeAssessment } from '../outcome-intelligence/validate-outcome-intelligence.js';
import { validateStrategyRoutingDecision } from '../strategy-routing/validate-strategy-routing.js';
import { validateTaskContract } from '../task-intelligence/validate-task-intelligence.js';
import { validateVerificationResult } from '../verification/validate-verification.js';
import {
  EVAL_SYSTEM_LIMITS,
  EVAL_SYSTEM_VERSIONS,
} from './eval-system-contract.js';

import type {
  IEvalBudget,
  IEvalCase,
  IEvalCaseEvaluationInput,
  IEvalComparisonInput,
  IEvalCorpus,
  IEvalObservation,
  IEvalRunInput,
  IEvalScoringPolicy,
  IEvalUsage,
  IEvalVariant,
  TEvalCorpusKind,
  TEvalExpectation,
  TEvalExpectationKind,
} from './eval-system-contract.js';

const CORPUS_KINDS = new Set<TEvalCorpusKind>(['failure', 'real-task', 'regression']);
const EXPECTATION_KINDS = new Set<TEvalExpectationKind>([
  'completion-status',
  'failure-class',
  'outcome-status',
  'strategy-execution',
  'strategy-exploration',
  'strategy-fast-path',
  'strategy-planning',
  'strategy-review',
  'strategy-verification',
  'verification-status',
]);
const COMPLETION_STATUSES = new Set(['complete', 'failed', 'incomplete', 'unverified']);
const FAILURE_CLASSES = new Set([
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
const OUTCOME_STATUSES = new Set([
  'failure',
  'partial_success',
  'success',
  'unknown',
  'unverified',
]);
const STRATEGY_EXECUTIONS = new Set(['direct', 'worker']);
const STRATEGY_EXPLORATIONS = new Set(['none', 'scout', 'source-read']);
const STRATEGY_PLANNINGS = new Set(['decompose', 'none', 'plan']);
const STRATEGY_REVIEWS = new Set(['none', 'reviewer']);
const STRATEGY_VERIFICATIONS = new Set(['none', 'verifier']);
const VERIFICATION_STATUSES = new Set(['failed', 'passed', 'pending', 'unverified']);

const checkIsRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createValidationError = (message: string) =>
  new AmyRuntimeError({
    code: 'VALIDATION_FAILURE',
    details: { capabilityId: 'amy.eval-system' },
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
    value.length > EVAL_SYSTEM_LIMITS.maxStringLength
  ) {
    throw createValidationError(
      `${label} must be a non-empty string up to ${EVAL_SYSTEM_LIMITS.maxStringLength} characters`,
    );
  }

  return value.trim();
};

const validateStringList = (
  value: unknown,
  label: string,
  maxItems: number = EVAL_SYSTEM_LIMITS.maxListItems,
): readonly string[] => {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw createValidationError(`${label} must be an array with at most ${maxItems} items`);
  }

  const items = value.map((item, index) => validateString(item, `${label}[${index}]`));

  if (new Set(items).size !== items.length) {
    throw createValidationError(`${label} must not contain duplicates`);
  }

  return Object.freeze(items);
};

const validateNumber = (
  value: unknown,
  label: string,
  max: number,
  options: Readonly<{ integer?: boolean; min?: number }> = {},
): number => {
  const min = options.min ?? 0;

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (options.integer === true && !Number.isInteger(value))
  ) {
    throw createValidationError(`${label} must be between ${min} and ${max}`);
  }

  return value;
};

const validateExpectationExpected = (
  kind: TEvalExpectationKind,
  expected: unknown,
): boolean | string => {
  if (kind === 'strategy-fast-path') {
    if (typeof expected !== 'boolean') {
      throw createValidationError('Eval expectation strategy-fast-path expected must be boolean');
    }

    return expected;
  }

  if (typeof expected !== 'string') {
    throw createValidationError(`Eval expectation ${kind} expected must be a string`);
  }

  const allowed = (() => {
    switch (kind) {
      case 'completion-status': return COMPLETION_STATUSES;
      case 'failure-class': return FAILURE_CLASSES;
      case 'outcome-status': return OUTCOME_STATUSES;
      case 'strategy-execution': return STRATEGY_EXECUTIONS;
      case 'strategy-exploration': return STRATEGY_EXPLORATIONS;
      case 'strategy-planning': return STRATEGY_PLANNINGS;
      case 'strategy-review': return STRATEGY_REVIEWS;
      case 'strategy-verification': return STRATEGY_VERIFICATIONS;
      case 'verification-status': return VERIFICATION_STATUSES;
    }
  })();

  if (!allowed.has(expected)) {
    throw createValidationError(`Eval expectation ${kind} expected is unsupported`);
  }

  return expected;
};

const validateExpectation = (
  value: unknown,
  index: number,
): Readonly<TEvalExpectation> => {
  const label = `Eval case expectations[${index}]`;

  if (!checkIsRecord(value)) {
    throw createValidationError(`${label} must be an object`);
  }

  assertAllowedKeys(value, ['expected', 'id', 'kind', 'required', 'weight'], label);

  if (
    typeof value.kind !== 'string' ||
    !EXPECTATION_KINDS.has(value.kind as TEvalExpectationKind) ||
    typeof value.required !== 'boolean'
  ) {
    throw createValidationError(`${label} identity is invalid`);
  }

  const kind = value.kind as TEvalExpectationKind;

  return Object.freeze({
    expected: validateExpectationExpected(kind, value.expected),
    id: validateString(value.id, `${label} id`),
    kind,
    required: value.required,
    weight: validateNumber(value.weight, `${label} weight`, EVAL_SYSTEM_LIMITS.maxWeight, {
      integer: true,
      min: 1,
    }),
  } as TEvalExpectation);
};

const validateScoring = (value: unknown): Readonly<IEvalScoringPolicy> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Eval case scoring must be an object');
  }

  assertAllowedKeys(value, ['passThreshold'], 'Eval case scoring');

  return Object.freeze({
    passThreshold: validateNumber(value.passThreshold, 'Eval case passThreshold', 100),
  });
};

export const validateEvalCase = (value: unknown): Readonly<IEvalCase> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Eval case must be an object');
  }

  assertAllowedKeys(
    value,
    [
      'caseId',
      'constraints',
      'environmentAssumptions',
      'expectations',
      'kind',
      'schemaVersion',
      'scoring',
      'task',
    ],
    'Eval case',
  );

  if (
    value.kind !== 'eval-case' ||
    value.schemaVersion !== EVAL_SYSTEM_VERSIONS.caseSchema ||
    !Array.isArray(value.expectations) ||
    value.expectations.length === 0 ||
    value.expectations.length > EVAL_SYSTEM_LIMITS.maxExpectationsPerCase
  ) {
    throw createValidationError('Eval case identity or expectation count is invalid');
  }

  const expectations = value.expectations.map(validateExpectation);
  const expectationIds = expectations.map(({ id }) => id);

  if (new Set(expectationIds).size !== expectationIds.length) {
    throw createValidationError('Eval case expectation ids must be unique');
  }

  return Object.freeze({
    caseId: validateString(value.caseId, 'Eval case caseId'),
    constraints: validateStringList(value.constraints, 'Eval case constraints'),
    environmentAssumptions: validateStringList(
      value.environmentAssumptions,
      'Eval case environmentAssumptions',
    ),
    expectations: Object.freeze(expectations),
    kind: 'eval-case' as const,
    schemaVersion: EVAL_SYSTEM_VERSIONS.caseSchema,
    scoring: validateScoring(value.scoring),
    task: validateTaskContract(value.task),
  });
};

export const validateEvalCorpus = (value: unknown): Readonly<IEvalCorpus> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Eval corpus must be an object');
  }

  assertAllowedKeys(
    value,
    ['cases', 'corpusId', 'corpusKind', 'kind', 'schemaVersion', 'version'],
    'Eval corpus',
  );

  if (
    value.kind !== 'eval-corpus' ||
    value.schemaVersion !== EVAL_SYSTEM_VERSIONS.corpusSchema ||
    typeof value.corpusKind !== 'string' ||
    !CORPUS_KINDS.has(value.corpusKind as TEvalCorpusKind) ||
    !Number.isInteger(value.version) ||
    (value.version as number) < 1 ||
    !Array.isArray(value.cases) ||
    value.cases.length === 0 ||
    value.cases.length > EVAL_SYSTEM_LIMITS.maxCasesPerCorpus
  ) {
    throw createValidationError('Eval corpus identity or case count is invalid');
  }

  const cases = value.cases.map(validateEvalCase);
  const caseIds = cases.map(({ caseId }) => caseId);

  if (new Set(caseIds).size !== caseIds.length) {
    throw createValidationError('Eval corpus case ids must be unique');
  }

  return Object.freeze({
    cases: Object.freeze(cases),
    corpusId: validateString(value.corpusId, 'Eval corpus corpusId'),
    corpusKind: value.corpusKind as TEvalCorpusKind,
    kind: 'eval-corpus' as const,
    schemaVersion: EVAL_SYSTEM_VERSIONS.corpusSchema,
    version: value.version as number,
  });
};

export const validateEvalUsage = (value: unknown): Readonly<IEvalUsage> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Eval usage must be an object');
  }

  assertAllowedKeys(value, ['costUnits', 'durationMs', 'tokens'], 'Eval usage');

  return Object.freeze({
    costUnits: validateNumber(
      value.costUnits,
      'Eval usage costUnits',
      EVAL_SYSTEM_LIMITS.maxBudgetCostUnits,
    ),
    durationMs: validateNumber(
      value.durationMs,
      'Eval usage durationMs',
      EVAL_SYSTEM_LIMITS.maxBudgetDurationMs,
      { integer: true },
    ),
    tokens: validateNumber(
      value.tokens,
      'Eval usage tokens',
      EVAL_SYSTEM_LIMITS.maxBudgetTokens,
      { integer: true },
    ),
  });
};

export const validateEvalObservation = (
  value: unknown,
): Readonly<IEvalObservation> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Eval observation must be an object');
  }

  assertAllowedKeys(
    value,
    [
      'completionResult',
      'evidenceRefs',
      'kind',
      'outcomeAssessment',
      'schemaVersion',
      'strategyDecision',
      'usage',
      'verificationResult',
    ],
    'Eval observation',
  );

  if (
    value.kind !== 'eval-observation' ||
    value.schemaVersion !== EVAL_SYSTEM_VERSIONS.observationSchema
  ) {
    throw createValidationError('Eval observation identity is invalid');
  }

  return Object.freeze({
    ...(value.completionResult === undefined
      ? {}
      : { completionResult: validateCompletionResult(value.completionResult) }),
    evidenceRefs: validateStringList(value.evidenceRefs, 'Eval observation evidenceRefs', 128),
    kind: 'eval-observation' as const,
    ...(value.outcomeAssessment === undefined
      ? {}
      : { outcomeAssessment: validateOutcomeAssessment(value.outcomeAssessment) }),
    schemaVersion: EVAL_SYSTEM_VERSIONS.observationSchema,
    ...(value.strategyDecision === undefined
      ? {}
      : { strategyDecision: validateStrategyRoutingDecision(value.strategyDecision) }),
    usage: validateEvalUsage(value.usage),
    ...(value.verificationResult === undefined
      ? {}
      : { verificationResult: validateVerificationResult(value.verificationResult) }),
  });
};

export const validateEvalCaseEvaluationInput = (
  value: unknown,
): Readonly<IEvalCaseEvaluationInput> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Eval case evaluation input must be an object');
  }

  assertAllowedKeys(value, ['case', 'observation'], 'Eval case evaluation input');

  return Object.freeze({
    case: validateEvalCase(value.case),
    observation: validateEvalObservation(value.observation),
  });
};

export const validateEvalBudget = (value: unknown): Readonly<IEvalBudget> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Eval budget must be an object');
  }

  assertAllowedKeys(
    value,
    ['maxCases', 'maxCostUnits', 'maxDurationMs', 'maxTokens'],
    'Eval budget',
  );

  return Object.freeze({
    maxCases: validateNumber(
      value.maxCases,
      'Eval budget maxCases',
      EVAL_SYSTEM_LIMITS.maxBudgetCases,
      { integer: true },
    ),
    maxCostUnits: validateNumber(
      value.maxCostUnits,
      'Eval budget maxCostUnits',
      EVAL_SYSTEM_LIMITS.maxBudgetCostUnits,
    ),
    maxDurationMs: validateNumber(
      value.maxDurationMs,
      'Eval budget maxDurationMs',
      EVAL_SYSTEM_LIMITS.maxBudgetDurationMs,
      { integer: true },
    ),
    maxTokens: validateNumber(
      value.maxTokens,
      'Eval budget maxTokens',
      EVAL_SYSTEM_LIMITS.maxBudgetTokens,
      { integer: true },
    ),
  });
};

export const validateEvalVariant = (value: unknown): Readonly<IEvalVariant> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Eval variant must be an object');
  }

  assertAllowedKeys(value, ['configurationRef', 'variantId'], 'Eval variant');

  return Object.freeze({
    ...(value.configurationRef === undefined
      ? {}
      : { configurationRef: validateString(value.configurationRef, 'Eval variant configurationRef') }),
    variantId: validateString(value.variantId, 'Eval variant variantId'),
  });
};

export const validateEvalRunInput = (value: unknown): Readonly<IEvalRunInput> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Eval run input must be an object');
  }

  assertAllowedKeys(value, ['budget', 'corpus', 'runId', 'variant'], 'Eval run input');

  return Object.freeze({
    budget: validateEvalBudget(value.budget),
    corpus: validateEvalCorpus(value.corpus),
    runId: validateString(value.runId, 'Eval run runId'),
    variant: validateEvalVariant(value.variant),
  });
};

export const validateEvalComparisonInput = (
  value: unknown,
): Readonly<IEvalComparisonInput> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Eval comparison input must be an object');
  }

  assertAllowedKeys(
    value,
    ['baseline', 'budget', 'candidate', 'comparisonId', 'corpus'],
    'Eval comparison input',
  );

  const baseline = validateEvalVariant(value.baseline);
  const candidate = validateEvalVariant(value.candidate);

  if (baseline.variantId === candidate.variantId) {
    throw createValidationError('Eval comparison variants must be distinct');
  }

  return Object.freeze({
    baseline,
    budget: validateEvalBudget(value.budget),
    candidate,
    comparisonId: validateString(value.comparisonId, 'Eval comparison comparisonId'),
    corpus: validateEvalCorpus(value.corpus),
  });
};
