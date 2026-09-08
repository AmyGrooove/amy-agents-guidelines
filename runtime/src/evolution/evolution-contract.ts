import type {
  IAnalyticsInput,
  TAnalyticsConfidence,
  TAnalyticsRoutingHealthDimension,
} from '../analytics/analytics-contract.js';
import type { IEvalComparisonResult } from '../eval-system/eval-system-contract.js';
import type { TStrategyRoutingDecision } from '../strategy-routing/strategy-routing-contract.js';

export const EVOLUTION_VERSIONS = Object.freeze({
  api: 1,
  counterfactualPolicy: 1,
  counterfactualSchema: 1,
  decisionSchema: 1,
  proposalPolicy: 1,
  proposalSchema: 1,
  shadowSchema: 1,
});

export const EVOLUTION_LIMITS = Object.freeze({
  maxEvidenceRefs: 64,
  maxHypotheses: 128,
  maxListItems: 64,
  maxSampleSize: 10_000,
  maxStringLength: 1_000,
  minComparableSampleSize: 5,
  minRelativeCostReduction: 0.2,
  reliabilityTolerance: 0.05,
});

export type TEvolutionTarget =
  | 'agent'
  | 'compute-profile'
  | 'context-policy'
  | 'project-intelligence'
  | 'routing'
  | 'skill'
  | 'verification';

export type TEvolutionCounterfactualDimension = Exclude<
  TAnalyticsRoutingHealthDimension,
  'verifier'
>;

export type TEvolutionCostMetric = 'cost-units' | 'duration-ms' | 'tokens';
export type TEvolutionCounterfactualReasonCode =
  | 'lower-cost-comparable-reliability';
export type TEvolutionRecommendation =
  | 'collect-more-evidence'
  | 'do-not-adopt'
  | 'request-user-decision'
  | 'run-eval';
export type TEvolutionProposalReasonCode =
  | 'eval-candidate-regressed'
  | 'eval-candidate-safe'
  | 'eval-inconclusive'
  | 'eval-missing'
  | 'evidence-insufficient';
export type TEvolutionUserDecision = 'approved' | 'deferred' | 'rejected';
export type TShadowStrategyDimension =
  | 'compute-profile'
  | 'escalation'
  | 'execution'
  | 'exploration'
  | 'fast-path'
  | 'planning'
  | 'review'
  | 'verification';

export interface ICounterfactualAnalysisInput {
  analysisId: string;
  analyticsInput: Readonly<IAnalyticsInput>;
}

export interface ICounterfactualHypothesis {
  alternativeChoice: string;
  alternativeCost: number;
  alternativeFailureRate: number;
  alternativeSuccessRate: number;
  causalClaim: false;
  cohortId: string;
  confidence: TAnalyticsConfidence;
  costMetric: TEvolutionCostMetric;
  dimension: TEvolutionCounterfactualDimension;
  estimatedRelativeCostReduction: number;
  hypothesisId: string;
  observedChoice: string;
  observedCost: number;
  observedFailureRate: number;
  observedSuccessRate: number;
  reasonCodes: readonly TEvolutionCounterfactualReasonCode[];
  sampleSize: number;
}

export interface ICounterfactualAnalysis {
  analysisId: string;
  causalClaim: false;
  hypotheses: readonly Readonly<ICounterfactualHypothesis>[];
  kind: 'counterfactual-analysis';
  schemaVersion: number;
  sourceReportId: string;
}

export interface IShadowStrategyInput {
  candidateDecision: Readonly<TStrategyRoutingDecision>;
  candidateRef: string;
  evidenceRefs: readonly string[];
  productionDecision: Readonly<TStrategyRoutingDecision>;
  shadowId: string;
}

export interface IShadowStrategyDifference {
  candidateValue: boolean | string | null;
  dimension: TShadowStrategyDimension;
  productionValue: boolean | string | null;
}

export interface IShadowStrategyComparison {
  candidateDecision: Readonly<TStrategyRoutingDecision>;
  candidateRef: string;
  causalClaim: false;
  differences: readonly Readonly<IShadowStrategyDifference>[];
  evidenceRefs: readonly string[];
  executionPerformed: false;
  kind: 'shadow-strategy-comparison';
  productionDecision: Readonly<TStrategyRoutingDecision>;
  productionMutation: false;
  schemaVersion: number;
  shadowId: string;
}

export interface IImprovementProposalInput {
  confidence: TAnalyticsConfidence;
  evidenceRefs: readonly string[];
  expectedBenefit: string;
  hypothesis: string;
  observation: string;
  proposalId: string;
  proposedChange: string;
  risks: readonly string[];
  sampleSize: number;
  target: TEvolutionTarget;

  counterfactualAnalysis?: Readonly<ICounterfactualAnalysis>;
  evalResult?: Readonly<IEvalComparisonResult>;
  shadowComparison?: Readonly<IShadowStrategyComparison>;
}

export interface IImprovementProposal extends IImprovementProposalInput {
  automaticApplication: false;
  causalClaim: false;
  kind: 'improvement-proposal';
  reasonCodes: readonly TEvolutionProposalReasonCode[];
  recommendation: TEvolutionRecommendation;
  schemaVersion: number;
  userDecisionRequired: true;
}

export interface IImprovementDecisionInput {
  decidedBy: 'user';
  decision: TEvolutionUserDecision;
  proposal: Readonly<IImprovementProposal>;

  note?: string;
}

export interface IImprovementDecision {
  automaticApplication: false;
  decidedBy: 'user';
  decision: TEvolutionUserDecision;
  kind: 'improvement-decision';
  proposalId: string;
  schemaVersion: number;

  note?: string;
}

export interface IEvolutionApi {
  analyzeCounterfactuals(value: unknown): Readonly<ICounterfactualAnalysis>;
  compareShadowStrategy(value: unknown): Readonly<IShadowStrategyComparison>;
  createProposal(value: unknown): Readonly<IImprovementProposal>;
  recordDecision(value: unknown): Readonly<IImprovementDecision>;
}
