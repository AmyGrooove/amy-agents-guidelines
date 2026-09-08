import type { TCompletionResult, TCompletionStatus } from '../completion/completion-contract.js';
import type { IOutcomeAssessment, TOutcomeFailureClass, TOutcomeStatus } from '../outcome-intelligence/outcome-intelligence-contract.js';
import type {
  TStrategyExecution,
  TStrategyExploration,
  TStrategyPlanning,
  TStrategyReview,
  TStrategyRoutingDecision,
  TStrategyVerification,
} from '../strategy-routing/strategy-routing-contract.js';
import type { ITaskContract } from '../task-intelligence/task-intelligence-contract.js';
import type { TVerificationResult, TVerificationStatus } from '../verification/verification-contract.js';

export const EVAL_SYSTEM_VERSIONS = Object.freeze({
  api: 1,
  caseSchema: 1,
  comparisonSchema: 1,
  corpusSchema: 1,
  observationSchema: 1,
  resultSchema: 1,
  scoringPolicy: 1,
});

export const EVAL_SYSTEM_LIMITS = Object.freeze({
  maxBudgetCases: 200,
  maxBudgetCostUnits: 1_000_000,
  maxBudgetDurationMs: 86_400_000,
  maxBudgetTokens: 100_000_000,
  maxCasesPerCorpus: 200,
  maxExpectationsPerCase: 32,
  maxListItems: 32,
  maxStringLength: 1_000,
  maxWeight: 100,
});

export type TEvalCorpusKind = 'failure' | 'real-task' | 'regression';
export type TEvalExpectationKind =
  | 'completion-status'
  | 'failure-class'
  | 'outcome-status'
  | 'strategy-execution'
  | 'strategy-exploration'
  | 'strategy-fast-path'
  | 'strategy-planning'
  | 'strategy-review'
  | 'strategy-verification'
  | 'verification-status';
export type TEvalCheckStatus = 'failed' | 'passed';
export type TEvalCaseStatus = 'error' | 'failed' | 'passed';
export type TEvalRunStatus = 'budget-exhausted' | 'completed';
export type TEvalComparisonStatus = 'completed' | 'inconclusive';
export type TEvalComparisonWinner = 'baseline' | 'candidate' | 'inconclusive' | 'tie';

interface IEvalExpectationBase {
  id: string;
  required: boolean;
  weight: number;
}

export type TEvalExpectation =
  | (IEvalExpectationBase & Readonly<{ expected: TCompletionStatus; kind: 'completion-status' }>)
  | (IEvalExpectationBase & Readonly<{ expected: TOutcomeFailureClass; kind: 'failure-class' }>)
  | (IEvalExpectationBase & Readonly<{ expected: TOutcomeStatus; kind: 'outcome-status' }>)
  | (IEvalExpectationBase & Readonly<{ expected: TStrategyExecution; kind: 'strategy-execution' }>)
  | (IEvalExpectationBase & Readonly<{ expected: TStrategyExploration; kind: 'strategy-exploration' }>)
  | (IEvalExpectationBase & Readonly<{ expected: boolean; kind: 'strategy-fast-path' }>)
  | (IEvalExpectationBase & Readonly<{ expected: TStrategyPlanning; kind: 'strategy-planning' }>)
  | (IEvalExpectationBase & Readonly<{ expected: TStrategyReview; kind: 'strategy-review' }>)
  | (IEvalExpectationBase & Readonly<{ expected: TStrategyVerification; kind: 'strategy-verification' }>)
  | (IEvalExpectationBase & Readonly<{ expected: TVerificationStatus; kind: 'verification-status' }>);

export interface IEvalScoringPolicy {
  passThreshold: number;
}

export interface IEvalCase {
  caseId: string;
  constraints: readonly string[];
  environmentAssumptions: readonly string[];
  expectations: readonly Readonly<TEvalExpectation>[];
  kind: 'eval-case';
  schemaVersion: number;
  scoring: Readonly<IEvalScoringPolicy>;
  task: Readonly<ITaskContract>;
}

export interface IEvalCorpus {
  cases: readonly Readonly<IEvalCase>[];
  corpusId: string;
  corpusKind: TEvalCorpusKind;
  kind: 'eval-corpus';
  schemaVersion: number;
  version: number;
}

export interface IEvalUsage {
  costUnits: number;
  durationMs: number;
  tokens: number;
}

export interface IEvalBudget {
  maxCases: number;
  maxCostUnits: number;
  maxDurationMs: number;
  maxTokens: number;
}

export interface IEvalObservation {
  evidenceRefs: readonly string[];
  kind: 'eval-observation';
  schemaVersion: number;
  usage: Readonly<IEvalUsage>;

  completionResult?: Readonly<TCompletionResult>;
  outcomeAssessment?: Readonly<IOutcomeAssessment>;
  strategyDecision?: Readonly<TStrategyRoutingDecision>;
  verificationResult?: Readonly<TVerificationResult>;
}

export interface IEvalVariant {
  variantId: string;
  configurationRef?: string;
}

export interface IEvalCaseEvaluationInput {
  case: Readonly<IEvalCase>;
  observation: Readonly<IEvalObservation>;
}

export interface IEvalCheckResult {
  expectationId: string;
  kind: TEvalExpectationKind;
  required: boolean;
  status: TEvalCheckStatus;
  weight: number;

  actual?: boolean | string;
  expected: boolean | string;
}

export interface IEvalCaseResult {
  caseId: string;
  checks: readonly Readonly<IEvalCheckResult>[];
  kind: 'eval-case-result';
  schemaVersion: number;
  score: number;
  status: TEvalCaseStatus;
  usage: Readonly<IEvalUsage>;

  error?: string;
}

export interface IEvalRunInput {
  budget: Readonly<IEvalBudget>;
  corpus: Readonly<IEvalCorpus>;
  runId: string;
  variant: Readonly<IEvalVariant>;
}

export interface IEvalExecutorInput {
  case: Readonly<IEvalCase>;
  corpus: Readonly<IEvalCorpus>;
  variant: Readonly<IEvalVariant>;
}

export type TEvalExecutor = (
  input: Readonly<IEvalExecutorInput>,
) => Promise<unknown>;

export interface IEvalRunResult {
  caseResults: readonly Readonly<IEvalCaseResult>[];
  corpusId: string;
  executedCaseCount: number;
  kind: 'eval-run-result';
  runId: string;
  schemaVersion: number;
  score: number;
  skippedCaseIds: readonly string[];
  status: TEvalRunStatus;
  usage: Readonly<IEvalUsage>;
  variantId: string;
}

export interface IEvalComparisonInput {
  baseline: Readonly<IEvalVariant>;
  budget: Readonly<IEvalBudget>;
  candidate: Readonly<IEvalVariant>;
  comparisonId: string;
  corpus: Readonly<IEvalCorpus>;
}

export interface IEvalComparisonResult {
  baseline: Readonly<IEvalRunResult>;
  candidate: Readonly<IEvalRunResult>;
  comparisonId: string;
  improvedCaseIds: readonly string[];
  kind: 'eval-comparison-result';
  regressedCaseIds: readonly string[];
  schemaVersion: number;
  scoreDelta: number;
  status: TEvalComparisonStatus;
  winner: TEvalComparisonWinner;
}

export interface IEvalSystemApi {
  compareVariants(
    value: unknown,
    executor: TEvalExecutor,
  ): Promise<Readonly<IEvalComparisonResult>>;
  evaluateCase(value: unknown): Readonly<IEvalCaseResult>;
  runCorpus(
    value: unknown,
    executor: TEvalExecutor,
  ): Promise<Readonly<IEvalRunResult>>;
  validateCorpus(value: unknown): Readonly<IEvalCorpus>;
}
