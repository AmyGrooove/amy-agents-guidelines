import { isRecord } from '#shared/functions/checks/isRecord';

import { validateCompletionResult } from '#entities/executionResult';
import { AmyRuntimeError } from '#entities/runtime';
import { validateOutcomeAssessment } from '#entities/executionResult';
import { validateStrategyRoutingDecision } from '#entities/executionPlan';
import { validateTaskContract } from '#entities/task';
import { validateVerificationResult } from '#entities/verificationResult';
import {
  EVAL_SYSTEM_LIMITS,
  EVAL_SYSTEM_VERSIONS,
} from '../../../types/evalSystemContract.js';

import type {
  IEvalBudget,
  IEvalCase,
  IEvalCaseEvaluationInput,
  IEvalCaseResult,
  IEvalCheckResult,
  IEvalComparisonInput,
  IEvalComparisonResult,
  IEvalCorpus,
  IEvalObservation,
  IEvalRunInput,
  IEvalRunResult,
  IEvalScoringPolicy,
  IEvalUsage,
  IEvalVariant,
  TEvalCaseStatus,
  TEvalCheckStatus,
  TEvalCorpusKind,
  TEvalExpectation,
  TEvalExpectationKind,
  TEvalComparisonStatus,
  TEvalComparisonWinner,
  TEvalRunStatus,
} from '../../../types/evalSystemContract.js';

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
const EVAL_CHECK_STATUSES = new Set<TEvalCheckStatus>(['failed', 'passed']);
const EVAL_CASE_STATUSES = new Set<TEvalCaseStatus>(['error', 'failed', 'passed']);
const EVAL_RUN_STATUSES = new Set<TEvalRunStatus>(['budget-exhausted', 'completed']);
const EVAL_COMPARISON_STATUSES = new Set<TEvalComparisonStatus>(['completed', 'inconclusive']);
const EVAL_COMPARISON_WINNERS = new Set<TEvalComparisonWinner>(['baseline', 'candidate', 'inconclusive', 'tie']);


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

  if (!isRecord(value)) {
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
  if (!isRecord(value)) {
    throw createValidationError('Eval case scoring must be an object');
  }

  assertAllowedKeys(value, ['passThreshold'], 'Eval case scoring');

  return Object.freeze({
    passThreshold: validateNumber(value.passThreshold, 'Eval case passThreshold', 100),
  });
};

export const validateEvalCase = (value: unknown): Readonly<IEvalCase> => {
  if (!isRecord(value)) {
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
  if (!isRecord(value)) {
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
  if (!isRecord(value)) {
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
  if (!isRecord(value)) {
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
  if (!isRecord(value)) {
    throw createValidationError('Eval case evaluation input must be an object');
  }

  assertAllowedKeys(value, ['case', 'observation'], 'Eval case evaluation input');

  return Object.freeze({
    case: validateEvalCase(value.case),
    observation: validateEvalObservation(value.observation),
  });
};

export const validateEvalBudget = (value: unknown): Readonly<IEvalBudget> => {
  if (!isRecord(value)) {
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
  if (!isRecord(value)) {
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
  if (!isRecord(value)) {
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
  if (!isRecord(value)) {
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


const validateEvalCheckResult = (
  value: unknown,
  index: number,
): Readonly<IEvalCheckResult> => {
  const label = `Eval case result checks[${index}]`;

  if (!isRecord(value)) {
    throw createValidationError(`${label} must be an object`);
  }

  assertAllowedKeys(
    value,
    ['actual', 'expectationId', 'expected', 'kind', 'required', 'status', 'weight'],
    label,
  );

  if (
    typeof value.kind !== 'string' ||
    !EXPECTATION_KINDS.has(value.kind as TEvalExpectationKind) ||
    typeof value.required !== 'boolean' ||
    typeof value.status !== 'string' ||
    !EVAL_CHECK_STATUSES.has(value.status as TEvalCheckStatus)
  ) {
    throw createValidationError(`${label} identity is invalid`);
  }

  const kind = value.kind as TEvalExpectationKind;
  const expected = validateExpectationExpected(kind, value.expected);
  let actual: boolean | string | undefined;

  if (value.actual !== undefined) {
    if (kind === 'strategy-fast-path') {
      if (typeof value.actual !== 'boolean') {
        throw createValidationError(`${label} actual must be boolean`);
      }
      actual = value.actual;
    } else {
      if (typeof value.actual !== 'string') {
        throw createValidationError(`${label} actual must be a string`);
      }
      actual = value.actual;
    }
  }

  return Object.freeze({
    ...(actual === undefined ? {} : { actual }),
    expectationId: validateString(value.expectationId, `${label} expectationId`),
    expected,
    kind,
    required: value.required,
    status: value.status as TEvalCheckStatus,
    weight: validateNumber(value.weight, `${label} weight`, EVAL_SYSTEM_LIMITS.maxWeight, {
      integer: true,
      min: 1,
    }),
  });
};

export const validateEvalCaseResult = (
  value: unknown,
): Readonly<IEvalCaseResult> => {
  if (!isRecord(value)) {
    throw createValidationError('Eval case result must be an object');
  }

  assertAllowedKeys(
    value,
    ['caseId', 'checks', 'error', 'kind', 'schemaVersion', 'score', 'status', 'usage'],
    'Eval case result',
  );

  if (
    value.kind !== 'eval-case-result' ||
    value.schemaVersion !== EVAL_SYSTEM_VERSIONS.resultSchema ||
    typeof value.status !== 'string' ||
    !EVAL_CASE_STATUSES.has(value.status as TEvalCaseStatus) ||
    !Array.isArray(value.checks) ||
    value.checks.length > EVAL_SYSTEM_LIMITS.maxExpectationsPerCase
  ) {
    throw createValidationError('Eval case result identity is invalid');
  }

  const status = value.status as TEvalCaseStatus;
  const checks = value.checks.map(validateEvalCheckResult);
  const expectationIds = checks.map(({ expectationId }) => expectationId);

  if (new Set(expectationIds).size !== expectationIds.length) {
    throw createValidationError('Eval case result expectation ids must be unique');
  }
  if (status !== 'error' && checks.length === 0) {
    throw createValidationError('Non-error eval case result must contain checks');
  }
  if (status === 'error') {
    if (value.error === undefined) {
      throw createValidationError('Error eval case result must contain error');
    }
  } else if (value.error !== undefined) {
    throw createValidationError('Non-error eval case result must not contain error');
  }

  return Object.freeze({
    caseId: validateString(value.caseId, 'Eval case result caseId'),
    checks: Object.freeze(checks),
    ...(value.error === undefined
      ? {}
      : { error: validateString(value.error, 'Eval case result error') }),
    kind: 'eval-case-result' as const,
    schemaVersion: EVAL_SYSTEM_VERSIONS.resultSchema,
    score: validateNumber(value.score, 'Eval case result score', 100),
    status,
    usage: validateEvalUsage(value.usage),
  });
};

const approximatelyEqual = (left: number, right: number) =>
  Math.abs(left - right) <= 0.000001;

const validateEvalRunUsage = (value: unknown): Readonly<IEvalUsage> => {
  if (!isRecord(value)) {
    throw createValidationError('Eval run usage must be an object');
  }

  assertAllowedKeys(value, ['costUnits', 'durationMs', 'tokens'], 'Eval run usage');

  return Object.freeze({
    costUnits: validateNumber(
      value.costUnits,
      'Eval run usage costUnits',
      EVAL_SYSTEM_LIMITS.maxBudgetCostUnits * 2,
    ),
    durationMs: validateNumber(
      value.durationMs,
      'Eval run usage durationMs',
      EVAL_SYSTEM_LIMITS.maxBudgetDurationMs * 2,
      { integer: true },
    ),
    tokens: validateNumber(
      value.tokens,
      'Eval run usage tokens',
      EVAL_SYSTEM_LIMITS.maxBudgetTokens * 2,
      { integer: true },
    ),
  });
};

export const validateEvalRunResult = (
  value: unknown,
): Readonly<IEvalRunResult> => {
  if (!isRecord(value)) {
    throw createValidationError('Eval run result must be an object');
  }

  assertAllowedKeys(
    value,
    [
      'caseResults',
      'corpusId',
      'executedCaseCount',
      'kind',
      'runId',
      'schemaVersion',
      'score',
      'skippedCaseIds',
      'status',
      'usage',
      'variantId',
    ],
    'Eval run result',
  );

  if (
    value.kind !== 'eval-run-result' ||
    value.schemaVersion !== EVAL_SYSTEM_VERSIONS.resultSchema ||
    typeof value.status !== 'string' ||
    !EVAL_RUN_STATUSES.has(value.status as TEvalRunStatus) ||
    !Array.isArray(value.caseResults) ||
    value.caseResults.length > EVAL_SYSTEM_LIMITS.maxCasesPerCorpus ||
    !Number.isInteger(value.executedCaseCount) ||
    (value.executedCaseCount as number) < 0
  ) {
    throw createValidationError('Eval run result identity is invalid');
  }

  const caseResults = value.caseResults.map(validateEvalCaseResult);

  if (value.executedCaseCount !== caseResults.length) {
    throw createValidationError('Eval run result executed case count does not match case results');
  }

  const skippedCaseIds = validateStringList(
    value.skippedCaseIds,
    'Eval run result skippedCaseIds',
    EVAL_SYSTEM_LIMITS.maxCasesPerCorpus,
  );
  const caseIds = caseResults.map(({ caseId }) => caseId);

  if (new Set(caseIds).size !== caseIds.length) {
    throw createValidationError('Eval run result case ids must be unique');
  }
  if (skippedCaseIds.some((caseId) => caseIds.includes(caseId))) {
    throw createValidationError('Eval run result executed and skipped case ids must not overlap');
  }
  if (value.status === 'completed' && skippedCaseIds.length > 0) {
    throw createValidationError('Completed eval run result must not contain skipped cases');
  }

  const score = validateNumber(value.score, 'Eval run result score', 100);
  const expectedScore = caseResults.length === 0
    ? 0
    : Math.round(
        (caseResults.reduce((total, result) => total + result.score, 0) /
          caseResults.length) *
          100,
      ) / 100;

  if (!approximatelyEqual(score, expectedScore)) {
    throw createValidationError('Eval run result score does not match case results');
  }

  const usage = validateEvalRunUsage(value.usage);
  const summedUsage = caseResults.reduce(
    (total, result) => ({
      costUnits: total.costUnits + result.usage.costUnits,
      durationMs: total.durationMs + result.usage.durationMs,
      tokens: total.tokens + result.usage.tokens,
    }),
    { costUnits: 0, durationMs: 0, tokens: 0 },
  );

  if (
    !approximatelyEqual(usage.costUnits, summedUsage.costUnits) ||
    usage.durationMs !== summedUsage.durationMs ||
    usage.tokens !== summedUsage.tokens
  ) {
    throw createValidationError('Eval run result usage does not match case results');
  }

  return Object.freeze({
    caseResults: Object.freeze(caseResults),
    corpusId: validateString(value.corpusId, 'Eval run result corpusId'),
    executedCaseCount: caseResults.length,
    kind: 'eval-run-result' as const,
    runId: validateString(value.runId, 'Eval run result runId'),
    schemaVersion: EVAL_SYSTEM_VERSIONS.resultSchema,
    score,
    skippedCaseIds,
    status: value.status as TEvalRunStatus,
    usage,
    variantId: validateString(value.variantId, 'Eval run result variantId'),
  });
};


export const validateEvalComparisonResult = (
  value: unknown,
): Readonly<IEvalComparisonResult> => {
  if (!isRecord(value)) {
    throw createValidationError('Eval comparison result must be an object');
  }

  assertAllowedKeys(
    value,
    [
      'baseline',
      'candidate',
      'comparisonId',
      'improvedCaseIds',
      'kind',
      'regressedCaseIds',
      'schemaVersion',
      'scoreDelta',
      'status',
      'winner',
    ],
    'Eval comparison result',
  );

  if (
    value.kind !== 'eval-comparison-result' ||
    value.schemaVersion !== EVAL_SYSTEM_VERSIONS.comparisonSchema ||
    typeof value.status !== 'string' ||
    !EVAL_COMPARISON_STATUSES.has(value.status as TEvalComparisonStatus) ||
    typeof value.winner !== 'string' ||
    !EVAL_COMPARISON_WINNERS.has(value.winner as TEvalComparisonWinner)
  ) {
    throw createValidationError('Eval comparison result identity is invalid');
  }

  const baseline = validateEvalRunResult(value.baseline);
  const candidate = validateEvalRunResult(value.candidate);
  const improvedCaseIds = validateStringList(
    value.improvedCaseIds,
    'Eval comparison result improvedCaseIds',
    EVAL_SYSTEM_LIMITS.maxCasesPerCorpus,
  );
  const regressedCaseIds = validateStringList(
    value.regressedCaseIds,
    'Eval comparison result regressedCaseIds',
    EVAL_SYSTEM_LIMITS.maxCasesPerCorpus,
  );

  if (baseline.corpusId !== candidate.corpusId) {
    throw createValidationError('Eval comparison result runs must use the same corpus');
  }
  if (baseline.variantId === candidate.variantId) {
    throw createValidationError('Eval comparison result variants must be distinct');
  }

  const completed = baseline.status === 'completed' && candidate.status === 'completed';
  if (completed) {
    const baselineCaseIds = baseline.caseResults.map(({ caseId }) => caseId).sort();
    const candidateCaseIds = candidate.caseResults.map(({ caseId }) => caseId).sort();
    if (JSON.stringify(baselineCaseIds) !== JSON.stringify(candidateCaseIds)) {
      throw createValidationError('Completed eval comparison runs must contain the same case ids');
    }
  }

  if (improvedCaseIds.some((caseId) => regressedCaseIds.includes(caseId))) {
    throw createValidationError('Eval comparison improved and regressed case ids must not overlap');
  }

  const baselineScores = new Map(baseline.caseResults.map(({ caseId, score }) => [caseId, score] as const));
  const candidateScores = new Map(candidate.caseResults.map(({ caseId, score }) => [caseId, score] as const));
  const expectedImproved: string[] = [];
  const expectedRegressed: string[] = [];

  for (const [caseId, baselineScore] of baselineScores) {
    const candidateScore = candidateScores.get(caseId);
    if (candidateScore === undefined) continue;
    if (candidateScore > baselineScore) expectedImproved.push(caseId);
    if (candidateScore < baselineScore) expectedRegressed.push(caseId);
  }

  const normalize = (items: readonly string[]) => [...items].sort();
  if (
    JSON.stringify(normalize(improvedCaseIds)) !== JSON.stringify(normalize(expectedImproved)) ||
    JSON.stringify(normalize(regressedCaseIds)) !== JSON.stringify(normalize(expectedRegressed))
  ) {
    throw createValidationError('Eval comparison case deltas do not match run results');
  }

  const scoreDelta = validateNumber(value.scoreDelta, 'Eval comparison result score delta', 100, { min: -100 });
  const expectedScoreDelta = Math.round((candidate.score - baseline.score) * 100) / 100;
  if (!approximatelyEqual(scoreDelta, expectedScoreDelta)) {
    throw createValidationError('Eval comparison result score delta does not match run results');
  }

  const expectedStatus: TEvalComparisonStatus = completed ? 'completed' : 'inconclusive';
  const expectedWinner: TEvalComparisonWinner = !completed
    ? 'inconclusive'
    : scoreDelta > 0
      ? 'candidate'
      : scoreDelta < 0
        ? 'baseline'
        : 'tie';

  if (value.status !== expectedStatus || value.winner !== expectedWinner) {
    throw createValidationError('Eval comparison result status or winner does not match run results');
  }

  return Object.freeze({
    baseline,
    candidate,
    comparisonId: validateString(value.comparisonId, 'Eval comparison result comparisonId'),
    improvedCaseIds,
    kind: 'eval-comparison-result' as const,
    regressedCaseIds,
    schemaVersion: EVAL_SYSTEM_VERSIONS.comparisonSchema,
    scoreDelta,
    status: expectedStatus,
    winner: expectedWinner,
  });
};
