import type { IAgentHandoff, IAgentHandoffResult } from '../agent-roles/agent-role-contract.js';
import type { TQualityResult } from '../contracts/pipeline-contracts.js';
import type { TStrategyRoutingDecision } from '../strategy-routing/strategy-routing-contract.js';
import type { TTaskIntelligenceAnalysis } from '../task-intelligence/task-intelligence-contract.js';

export const VERIFICATION_VERSIONS = Object.freeze({
  api: 1,
  policy: 1,
  reportSchema: 1,
  resultSchema: 1,
});

export type TMechanicalCheckKind =
  | 'build'
  | 'lint'
  | 'project-command'
  | 'test'
  | 'typecheck';
export type TMechanicalCheckStatus = 'failed' | 'passed' | 'skipped' | 'unavailable';
export type TVerificationStageStatus =
  | 'failed'
  | 'not-required'
  | 'passed'
  | 'pending'
  | 'unverified';
export type TVerificationStatus = Exclude<TVerificationStageStatus, 'not-required'>;
export type TVerificationCriterionKind = 'acceptance-criterion' | 'goal' | 'requirement';
export type TVerificationCriterionStatus = 'met' | 'not-met' | 'unknown';
export type TReviewFindingSeverity = 'advisory' | 'required';

export type TVerificationReasonCode =
  | 'mechanical-check-failed'
  | 'mechanical-check-gap'
  | 'mechanical-checks-passed'
  | 'mechanical-not-requested'
  | 'review-finding-required'
  | 'review-not-required'
  | 'review-passed'
  | 'review-pending'
  | 'review-unverified'
  | 'semantic-criterion-failed'
  | 'semantic-criterion-gap'
  | 'semantic-not-required'
  | 'semantic-passed'
  | 'semantic-pending'
  | 'semantic-unverified';

export type IVerificationArtifactRefs = Readonly<{
  implementationResultRef: string;
  taskAnalysisRef: string;

  contextPacketRef?: string;
}>;

export type IMechanicalVerificationCheck = Readonly<{
  evidenceRefs: readonly string[];
  id: string;
  kind: TMechanicalCheckKind;
  label: string;
  status: TMechanicalCheckStatus;

  reason?: string;
}>;

export type IVerifierCriterionResult = Readonly<{
  evidenceRefs: readonly string[];
  kind: TVerificationCriterionKind;
  status: TVerificationCriterionStatus;
  subject: string;
}>;

export type IVerifierReport = Readonly<{
  criteria: readonly Readonly<IVerifierCriterionResult>[];
  kind: 'verifier-report';
  result: Readonly<IAgentHandoffResult>;
  schemaVersion: number;
}>;

export type IReviewFinding = Readonly<{
  evidenceRefs: readonly string[];
  severity: TReviewFindingSeverity;
  summary: string;
}>;

export type IReviewerReport = Readonly<{
  findings: readonly Readonly<IReviewFinding>[];
  kind: 'reviewer-report';
  result: Readonly<IAgentHandoffResult>;
  schemaVersion: number;
}>;

export type IVerificationInput = Readonly<{
  artifacts: Readonly<IVerificationArtifactRefs>;
  mechanicalChecks: readonly Readonly<IMechanicalVerificationCheck>[];
  strategyDecision: Readonly<TStrategyRoutingDecision>;
  taskAnalysis: Readonly<TTaskIntelligenceAnalysis>;
  verificationId: string;

  reviewerReport?: Readonly<IReviewerReport>;
  verifierReport?: Readonly<IVerifierReport>;
}>;

export type IMechanicalVerificationResult = Readonly<{
  checks: readonly Readonly<IMechanicalVerificationCheck>[];
  reasonCodes: readonly TVerificationReasonCode[];
  status: TVerificationStageStatus;
}>;

export type ISemanticVerificationResult = Readonly<{
  criteria: readonly Readonly<IVerifierCriterionResult>[];
  reasonCodes: readonly TVerificationReasonCode[];
  status: TVerificationStageStatus;

  handoff?: Readonly<IAgentHandoff>;
}>;

export type IReviewVerificationResult = Readonly<{
  findings: readonly Readonly<IReviewFinding>[];
  reasonCodes: readonly TVerificationReasonCode[];
  status: TVerificationStageStatus;

  handoff?: Readonly<IAgentHandoff>;
}>;

export type IVerificationResultData = Readonly<{
  mechanical: Readonly<IMechanicalVerificationResult>;
  policyVersion: number;
  reasonCodes: readonly TVerificationReasonCode[];
  review: Readonly<IReviewVerificationResult>;
  semantic: Readonly<ISemanticVerificationResult>;
  status: TVerificationStatus;
  verificationId: string;
}>;

export type TVerificationResult = TQualityResult<IVerificationResultData>;

export interface IVerificationApi {
  verify(value: unknown): Readonly<TVerificationResult>;
}
