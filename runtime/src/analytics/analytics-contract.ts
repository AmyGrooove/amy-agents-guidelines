import type { IEvalRunResult } from '../eval-system/eval-system-contract.js';
import type { IObservabilityPolicyRef } from '../observability/observability-contract.js';
import type {
  IOutcomeAssessment,
  TOutcomeFailureClass,
} from '../outcome-intelligence/outcome-intelligence-contract.js';
import type { TStrategyRoutingDecision } from '../strategy-routing/strategy-routing-contract.js';
import type { TTaskIntelligenceAnalysis } from '../task-intelligence/task-intelligence-contract.js';

export const ANALYTICS_VERSIONS = Object.freeze({
  api: 1,
  archetypePolicy: 1,
  archetypeSchema: 1,
  inputSchema: 1,
  metricPolicy: 1,
  reportSchema: 1,
});

export const ANALYTICS_LIMITS = Object.freeze({
  maxEvalRunSamples: 1_000,
  maxPolicyRefsPerSample: 32,
  maxSegments: 32,
  maxStringLength: 1_000,
  maxTaskSamples: 10_000,
  minArchetypeSampleSize: 3,
});

export type TAnalyticsConfidence = 'high' | 'insufficient' | 'low' | 'medium';
export type TTaskArchetype =
  | 'api-propagation'
  | 'bug-investigation'
  | 'exploration'
  | 'feature-modification'
  | 'other'
  | 'refactor'
  | 'testing';
export type TTaskArchetypeReasonCode =
  | 'api-signal'
  | 'bug-signal'
  | 'exploration-signal'
  | 'feature-signal'
  | 'fallback-other'
  | 'refactor-signal'
  | 'testing-signal';
export type TTaskArchetypeDiscoveryStatus = 'insufficient-sample' | 'ready';

export type TAnalyticsMetricId =
  | 'eval.avg-score'
  | 'eval.case-pass-rate'
  | 'outcome.failure-rate'
  | 'outcome.partial-success-rate'
  | 'outcome.success-rate'
  | 'outcome.unknown-rate'
  | 'outcome.unverified-rate'
  | 'recovery.avg-escalations'
  | 'recovery.avg-retries'
  | 'strategy.fast-path-rate'
  | 'strategy.reviewer-rate'
  | 'strategy.scout-rate'
  | 'strategy.verifier-rate'
  | 'task.count'
  | 'usage.avg-cost-units'
  | 'usage.avg-duration-ms'
  | 'usage.avg-tokens';
export type TAnalyticsMetricUnit =
  | 'cost-units'
  | 'count'
  | 'milliseconds'
  | 'ratio'
  | 'score'
  | 'tokens';

export interface IAnalyticsUsage {
  costUnits?: number;
  durationMs?: number;
  tokens?: number;
}

export interface IAnalyticsTaskSample {
  observedAt: string;
  policyRefs: readonly Readonly<IObservabilityPolicyRef>[];
  sampleId: string;
  taskAnalysis: Readonly<TTaskIntelligenceAnalysis>;

  outcomeAssessment?: Readonly<IOutcomeAssessment>;
  strategyDecision?: Readonly<TStrategyRoutingDecision>;
  usage?: Readonly<IAnalyticsUsage>;
}

export interface IAnalyticsEvalRunSample {
  observedAt: string;
  policyRefs: readonly Readonly<IObservabilityPolicyRef>[];
  run: Readonly<IEvalRunResult>;
  sampleId: string;
}

export interface IAnalyticsWindow {
  fromInclusive?: string;
  toExclusive?: string;
}

export interface IAnalyticsSegmentDefinition {
  segmentId: string;

  archetypes?: readonly TTaskArchetype[];
  policyRefs?: readonly Readonly<IObservabilityPolicyRef>[];
}

export interface IAnalyticsInput {
  evalRunSamples: readonly Readonly<IAnalyticsEvalRunSample>[];
  reportId: string;
  segments: readonly Readonly<IAnalyticsSegmentDefinition>[];
  taskSamples: readonly Readonly<IAnalyticsTaskSample>[];

  window?: Readonly<IAnalyticsWindow>;
}

export interface ITaskArchetypeAssignment {
  archetype: TTaskArchetype;
  confidence: Exclude<TAnalyticsConfidence, 'high' | 'insufficient'>;
  reasonCodes: readonly TTaskArchetypeReasonCode[];
  sampleId: string;
}

export interface ITaskArchetypeSummary {
  archetype: TTaskArchetype;
  confidence: TAnalyticsConfidence;
  count: number;
  share: number;
}

export interface ITaskArchetypeDiscovery {
  assignments: readonly Readonly<ITaskArchetypeAssignment>[];
  kind: 'task-archetype-discovery';
  sampleSize: number;
  schemaVersion: number;
  status: TTaskArchetypeDiscoveryStatus;
  summaries: readonly Readonly<ITaskArchetypeSummary>[];
}

export interface ITaskArchetypeDiscoveryInput {
  taskSamples: readonly Readonly<IAnalyticsTaskSample>[];
}

export interface IAnalyticsMetric {
  confidence: TAnalyticsConfidence;
  id: TAnalyticsMetricId;
  sampleSize: number;
  unit: TAnalyticsMetricUnit;
  value: number | null;
}

export interface IAnalyticsFailureClassSummary {
  confidence: TAnalyticsConfidence;
  count: number;
  failureClass: TOutcomeFailureClass;
  share: number;
}

export interface IAnalyticsFinding {
  causalClaim: false;
  confidence: TAnalyticsConfidence;
  findingId: string;
  metricIds: readonly TAnalyticsMetricId[];
  observation: string;
  sampleSize: number;

  hypothesis?: string;
  recommendation?: string;
}

export interface IAnalyticsSegmentReport {
  archetypes: readonly Readonly<ITaskArchetypeSummary>[];
  evalRunCount: number;
  failureClasses: readonly Readonly<IAnalyticsFailureClassSummary>[];
  findings: readonly Readonly<IAnalyticsFinding>[];
  metrics: readonly Readonly<IAnalyticsMetric>[];
  sampleSize: number;
  segmentId: string;
}

export interface IAnalyticsReport {
  kind: 'analytics-report';
  overall: Readonly<IAnalyticsSegmentReport>;
  reportId: string;
  schemaVersion: number;
  segments: readonly Readonly<IAnalyticsSegmentReport>[];
  window?: Readonly<IAnalyticsWindow>;
}

export interface IAnalyticsApi {
  analyze(value: unknown): Readonly<IAnalyticsReport>;
  discoverArchetypes(value: unknown): Readonly<ITaskArchetypeDiscovery>;
  validateInput(value: unknown): Readonly<IAnalyticsInput>;
}
