import type { TCompletionResult } from './completionContract.js';
import type { TRecoveryPlan } from './recoveryContract.js';

export const OUTCOME_INTELLIGENCE_VERSIONS = Object.freeze({
  api: 1,
  detectorPolicy: 1,
  detectorSchema: 1,
  failureSchema: 1,
  outcomeSchema: 1,
  signalSchema: 1,
});

export type TOutcomeStatus =
  | 'failure'
  | 'partial_success'
  | 'success'
  | 'unknown'
  | 'unverified';

export type TOutcomeConfidence = 'high' | 'low' | 'medium';

export type TOutcomeFailureClass =
  | 'classification'
  | 'context'
  | 'decomposition'
  | 'documentation'
  | 'implementation'
  | 'integration'
  | 'planning'
  | 'routing'
  | 'runtime'
  | 'tool'
  | 'unknown'
  | 'verification';

export type TOutcomeFailureSource = 'completion' | 'post-task' | 'recovery';
export type TPostTaskSignalImpact = 'failure' | 'partial';
export type TPostTaskSignalKind =
  | 'follow-up-bug'
  | 'later-rewrite'
  | 'revert'
  | 'user-correction';

export type TOutcomeReasonCode =
  | 'completion-evidence-missing'
  | 'completion-failed'
  | 'completion-incomplete'
  | 'completion-succeeded'
  | 'completion-unverified'
  | 'failure-classified'
  | 'post-task-failure-signal'
  | 'post-task-partial-signal'
  | 'recovery-observed';

export type TUserCorrectionClassification =
  | 'ambiguous'
  | 'correction'
  | 'new-task';
export type TUserCorrectionReasonCode =
  | 'conflicting-follow-up-signals'
  | 'correction-marker'
  | 'new-task-marker'
  | 'no-strong-follow-up-signal';

export interface IOutcomePostTaskSignal {
  evidenceRefs: readonly string[];
  kind: TPostTaskSignalKind;
  summary: string;

  failureClass?: TOutcomeFailureClass;
  impact?: TPostTaskSignalImpact;
}

export interface IOutcomeInput {
  outcomeId: string;
  taskId: string;

  completionResult?: Readonly<TCompletionResult>;
  postTaskSignals?: readonly Readonly<IOutcomePostTaskSignal>[];
  recoveryPlans?: readonly Readonly<TRecoveryPlan>[];
}

export interface IOutcomeAttempts {
  escalationCount: number;
  retryCount: number;
}

export interface IOutcomeFailure {
  evidenceRefs: readonly string[];
  failureClass: TOutcomeFailureClass;
  failureId: string;
  kind: 'failure-intelligence';
  schemaVersion: number;
  source: TOutcomeFailureSource;
  summary: string;
}

export interface IOutcomeAssessment {
  attempts: Readonly<IOutcomeAttempts>;
  confidence: TOutcomeConfidence;
  evidenceRefs: readonly string[];
  failures: readonly Readonly<IOutcomeFailure>[];
  kind: 'outcome-assessment';
  outcomeId: string;
  reasonCodes: readonly TOutcomeReasonCode[];
  schemaVersion: number;
  status: TOutcomeStatus;
  taskId: string;
  unresolvedIssues: readonly string[];
}

export interface IUserCorrectionDetectionInput {
  message: string;
  messageRef: string;
}

export interface IUserCorrectionDetection {
  classification: TUserCorrectionClassification;
  confidence: TOutcomeConfidence;
  kind: 'user-correction-detection';
  policyVersion: number;
  reasonCodes: readonly TUserCorrectionReasonCode[];
  schemaVersion: number;

  signal?: Readonly<IOutcomePostTaskSignal>;
}

export type TOutcomeRecordStatus = 'degraded' | 'dropped' | 'emitted';

export interface IOutcomeRecordReceipt {
  assessment: Readonly<IOutcomeAssessment>;
  deliveredCount: number;
  deliveryFailures: readonly string[];
  status: TOutcomeRecordStatus;
}

export interface IOutcomeIntelligenceApi {
  assess(value: unknown): Readonly<IOutcomeAssessment>;
  detectUserCorrection(value: unknown): Readonly<IUserCorrectionDetection>;
}
