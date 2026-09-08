import { EVAL_SYSTEM_VERSIONS } from './eval-system-contract.js';
import { validateEvalCaseEvaluationInput } from './validate-eval-system.js';

import type {
  IEvalCaseResult,
  IEvalCheckResult,
  IEvalObservation,
  TEvalExpectation,
} from './eval-system-contract.js';

const getActual = (
  expectation: Readonly<TEvalExpectation>,
  observation: Readonly<IEvalObservation>,
): boolean | string | undefined => {
  switch (expectation.kind) {
    case 'completion-status':
      return observation.completionResult?.data.status;
    case 'failure-class':
      return observation.outcomeAssessment?.failures
        .map(({ failureClass }) => failureClass)
        .join(',');
    case 'outcome-status':
      return observation.outcomeAssessment?.status;
    case 'strategy-execution':
      return observation.strategyDecision?.data.execution;
    case 'strategy-exploration':
      return observation.strategyDecision?.data.exploration;
    case 'strategy-fast-path':
      return observation.strategyDecision?.data.fastPath;
    case 'strategy-planning':
      return observation.strategyDecision?.data.planning;
    case 'strategy-review':
      return observation.strategyDecision?.data.review;
    case 'strategy-verification':
      return observation.strategyDecision?.data.verification;
    case 'verification-status':
      return observation.verificationResult?.data.status;
  }
};

const checkExpectation = (
  expectation: Readonly<TEvalExpectation>,
  observation: Readonly<IEvalObservation>,
): Readonly<IEvalCheckResult> => {
  const actual = getActual(expectation, observation);
  const passed = expectation.kind === 'failure-class'
    ? observation.outcomeAssessment?.failures.some(
        ({ failureClass }) => failureClass === expectation.expected,
      ) === true
    : actual === expectation.expected;

  return Object.freeze({
    ...(actual === undefined ? {} : { actual }),
    expectationId: expectation.id,
    expected: expectation.expected,
    kind: expectation.kind,
    required: expectation.required,
    status: passed ? ('passed' as const) : ('failed' as const),
    weight: expectation.weight,
  });
};

const getScore = (checks: readonly Readonly<IEvalCheckResult>[]) => {
  const totalWeight = checks.reduce((total, { weight }) => total + weight, 0);
  const passedWeight = checks.reduce(
    (total, { status, weight }) => total + (status === 'passed' ? weight : 0),
    0,
  );

  return Math.round((passedWeight / totalWeight) * 10_000) / 100;
};

export const evaluateEvalCase = (value: unknown): Readonly<IEvalCaseResult> => {
  const input = validateEvalCaseEvaluationInput(value);
  const checks = Object.freeze(
    input.case.expectations.map((expectation) =>
      checkExpectation(expectation, input.observation),
    ),
  );
  const score = getScore(checks);
  const requiredPassed = checks.every(
    ({ required, status }) => !required || status === 'passed',
  );

  return Object.freeze({
    caseId: input.case.caseId,
    checks,
    kind: 'eval-case-result' as const,
    schemaVersion: EVAL_SYSTEM_VERSIONS.resultSchema,
    score,
    status:
      requiredPassed && score >= input.case.scoring.passThreshold
        ? ('passed' as const)
        : ('failed' as const),
    usage: input.observation.usage,
  });
};
