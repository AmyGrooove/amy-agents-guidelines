import { EVAL_SYSTEM_VERSIONS } from '../types/evalSystemContract.js';
import { evaluateEvalCase } from '../functions/evaluateEvalCase/core/evaluateEvalCase.js';
import {
  validateEvalComparisonInput,
  validateEvalObservation,
  validateEvalRunInput,
} from '../functions/validateEvalSystem/core/validateEvalSystem.js';

import type {
  IEvalBudget,
  IEvalCase,
  IEvalCaseResult,
  IEvalComparisonResult,
  IEvalCorpus,
  IEvalRunInput,
  IEvalRunResult,
  IEvalUsage,
  IEvalVariant,
  TEvalExecutor,
} from '../types/evalSystemContract.js';

const ZERO_USAGE: Readonly<IEvalUsage> = Object.freeze({
  costUnits: 0,
  durationMs: 0,
  tokens: 0,
});

const addUsage = (
  left: Readonly<IEvalUsage>,
  right: Readonly<IEvalUsage>,
): Readonly<IEvalUsage> => Object.freeze({
  costUnits: left.costUnits + right.costUnits,
  durationMs: left.durationMs + right.durationMs,
  tokens: left.tokens + right.tokens,
});

const checkBudgetReached = (
  usage: Readonly<IEvalUsage>,
  executedCases: number,
  budget: Readonly<IEvalBudget>,
) =>
  executedCases >= budget.maxCases ||
  usage.costUnits >= budget.maxCostUnits ||
  usage.durationMs >= budget.maxDurationMs ||
  usage.tokens >= budget.maxTokens;

const checkBudgetExceeded = (
  usage: Readonly<IEvalUsage>,
  executedCases: number,
  budget: Readonly<IEvalBudget>,
) =>
  executedCases > budget.maxCases ||
  usage.costUnits > budget.maxCostUnits ||
  usage.durationMs > budget.maxDurationMs ||
  usage.tokens > budget.maxTokens;

const createErrorCaseResult = (
  evalCase: Readonly<IEvalCase>,
  error: unknown,
): Readonly<IEvalCaseResult> => Object.freeze({
  caseId: evalCase.caseId,
  checks: Object.freeze([]),
  error: error instanceof Error ? error.message : String(error),
  kind: 'eval-case-result' as const,
  schemaVersion: EVAL_SYSTEM_VERSIONS.resultSchema,
  score: 0,
  status: 'error' as const,
  usage: ZERO_USAGE,
});

const getRunScore = (caseResults: readonly Readonly<IEvalCaseResult>[]) => {
  if (caseResults.length === 0) return 0;

  return Math.round(
    (caseResults.reduce((total, { score }) => total + score, 0) /
      caseResults.length) *
      100,
  ) / 100;
};

const runValidatedCorpus = async (
  input: Readonly<IEvalRunInput>,
  executor: TEvalExecutor,
): Promise<Readonly<IEvalRunResult>> => {
  if (typeof executor !== 'function') {
    throw new TypeError('Eval executor must be a function');
  }

  const caseResults: IEvalCaseResult[] = [];
  let usage = ZERO_USAGE;
  let nextCaseIndex = 0;
  let budgetExhausted = false;

  for (; nextCaseIndex < input.corpus.cases.length; nextCaseIndex += 1) {
    if (checkBudgetReached(usage, caseResults.length, input.budget)) {
      budgetExhausted = true;
      break;
    }

    const evalCase = input.corpus.cases[nextCaseIndex];
    if (!evalCase) continue;

    let result: Readonly<IEvalCaseResult>;

    try {
      const observation = validateEvalObservation(
        await executor({
          case: evalCase,
          corpus: input.corpus,
          variant: input.variant,
        }),
      );
      result = evaluateEvalCase({ case: evalCase, observation });
      usage = addUsage(usage, result.usage);
    } catch (error) {
      result = createErrorCaseResult(evalCase, error);
    }

    caseResults.push(result);

    if (checkBudgetExceeded(usage, caseResults.length, input.budget)) {
      budgetExhausted = true;
      nextCaseIndex += 1;
      break;
    }
  }

  const skippedCaseIds = input.corpus.cases
    .slice(nextCaseIndex)
    .map(({ caseId }) => caseId);

  if (skippedCaseIds.length > 0) {
    budgetExhausted = true;
  }

  return Object.freeze({
    caseResults: Object.freeze(caseResults),
    corpusId: input.corpus.corpusId,
    executedCaseCount: caseResults.length,
    kind: 'eval-run-result' as const,
    runId: input.runId,
    schemaVersion: EVAL_SYSTEM_VERSIONS.resultSchema,
    score: getRunScore(caseResults),
    skippedCaseIds: Object.freeze(skippedCaseIds),
    status: budgetExhausted ? ('budget-exhausted' as const) : ('completed' as const),
    usage,
    variantId: input.variant.variantId,
  });
};

export const Evaluation = async (
  value: unknown,
  executor: TEvalExecutor,
): Promise<Readonly<IEvalRunResult>> =>
  runValidatedCorpus(validateEvalRunInput(value), executor);

const getCaseScores = (run: Readonly<IEvalRunResult>) =>
  new Map(run.caseResults.map(({ caseId, score }) => [caseId, score] as const));

export const compareEvalVariants = async (
  value: unknown,
  executor: TEvalExecutor,
): Promise<Readonly<IEvalComparisonResult>> => {
  const input = validateEvalComparisonInput(value);
  const createRunInput = (
    variant: Readonly<IEvalVariant>,
    suffix: 'baseline' | 'candidate',
  ): Readonly<IEvalRunInput> => Object.freeze({
    budget: input.budget,
    corpus: input.corpus,
    runId: `${input.comparisonId}:${suffix}`,
    variant,
  });
  const baseline = await runValidatedCorpus(
    createRunInput(input.baseline, 'baseline'),
    executor,
  );
  const candidate = await runValidatedCorpus(
    createRunInput(input.candidate, 'candidate'),
    executor,
  );
  const baselineScores = getCaseScores(baseline);
  const candidateScores = getCaseScores(candidate);
  const improvedCaseIds: string[] = [];
  const regressedCaseIds: string[] = [];

  for (const { caseId } of input.corpus.cases) {
    const baselineScore = baselineScores.get(caseId);
    const candidateScore = candidateScores.get(caseId);

    if (baselineScore === undefined || candidateScore === undefined) continue;
    if (candidateScore > baselineScore) improvedCaseIds.push(caseId);
    if (candidateScore < baselineScore) regressedCaseIds.push(caseId);
  }

  const completed = baseline.status === 'completed' && candidate.status === 'completed';
  const scoreDelta = Math.round((candidate.score - baseline.score) * 100) / 100;
  const winner = !completed
    ? ('inconclusive' as const)
    : scoreDelta > 0
      ? ('candidate' as const)
      : scoreDelta < 0
        ? ('baseline' as const)
        : ('tie' as const);

  return Object.freeze({
    baseline,
    candidate,
    comparisonId: input.comparisonId,
    improvedCaseIds: Object.freeze(improvedCaseIds),
    kind: 'eval-comparison-result' as const,
    regressedCaseIds: Object.freeze(regressedCaseIds),
    schemaVersion: EVAL_SYSTEM_VERSIONS.comparisonSchema,
    scoreDelta,
    status: completed ? ('completed' as const) : ('inconclusive' as const),
    winner,
  });
};

export { Evaluation as runEvalCorpus };
