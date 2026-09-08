import type { TQualityResult } from '#entities/verificationResult';
import type { TTaskIntelligenceAnalysis } from '#entities/task';
import type {
  IMechanicalVerificationCheck,
  TVerificationReasonCode,
  TVerificationResult,
  TVerificationStatus,
} from '#entities/verificationResult';

export const COMPLETION_VERSIONS = Object.freeze({
  api: 1,
  evidenceSchema: 1,
  policy: 1,
  resultSchema: 1,
});

export const DEFAULT_COMPLETION_POLICY = Object.freeze({
  maxGuardRetries: 2,
  maxGuardRetriesHardCap: 5,
});

export type TCompletionWorkStatus =
  | 'completed'
  | 'failed'
  | 'incomplete'
  | 'unverified';
export type TCompletionIntegrationStatus = TCompletionWorkStatus | 'not-required';
export type TCompletionStatus = 'complete' | 'failed' | 'incomplete' | 'unverified';
export type TCompletionConfidence = 'high' | 'low' | 'medium';
export type TCompletionGuardDecision =
  | 'complete'
  | 'retry'
  | 'stop-failed'
  | 'stop-incomplete'
  | 'stop-unverified';
export type TCompletionReasonCode =
  | 'completion-evidence-sufficient'
  | 'execution-completed'
  | 'execution-failed'
  | 'execution-incomplete'
  | 'execution-unverified'
  | 'guard-retry-allowed'
  | 'guard-retry-exhausted'
  | 'integration-completed'
  | 'integration-failed'
  | 'integration-incomplete'
  | 'integration-not-required'
  | 'integration-unverified'
  | 'unresolved-issues'
  | 'verification-failed'
  | 'verification-passed'
  | 'verification-pending'
  | 'verification-unverified';

export type ICompletionExecutionEvidence = Readonly<{
  evidenceRefs: readonly string[];
  status: TCompletionWorkStatus;
  unresolvedIssues: readonly string[];

  reason?: string;
}>;

export type ICompletionIntegrationEvidence = Readonly<{
  evidenceRefs: readonly string[];
  status: TCompletionIntegrationStatus;

  reason?: string;
}>;

export type ICompletionGuardInput = Readonly<{
  maxRetries?: number;
  retryCount?: number;
}>;

export type ICompletionInput = Readonly<{
  completionId: string;
  execution: Readonly<ICompletionExecutionEvidence>;
  integration: Readonly<ICompletionIntegrationEvidence>;
  taskAnalysis: Readonly<TTaskIntelligenceAnalysis>;
  verificationResult: Readonly<TVerificationResult>;

  guard?: Readonly<ICompletionGuardInput>;
}>;

export type ICompletionVerificationEvidence = Readonly<{
  reasonCodes: readonly TVerificationReasonCode[];
  status: TVerificationStatus;
  verificationId: string;
}>;

export type ICompletionEvidence = Readonly<{
  acceptanceCriteria: readonly string[];
  checks: readonly Readonly<IMechanicalVerificationCheck>[];
  evidenceGaps: readonly string[];
  execution: Readonly<ICompletionExecutionEvidence>;
  integration: Readonly<ICompletionIntegrationEvidence>;
  kind: 'completion-evidence';
  requirements: readonly string[];
  schemaVersion: number;
  skippedChecks: readonly Readonly<IMechanicalVerificationCheck>[];
  unresolvedIssues: readonly string[];
  verification: Readonly<ICompletionVerificationEvidence>;
}>;

export type ICompletionGuardResult = Readonly<{
  decision: TCompletionGuardDecision;
  maxRetries: number;
  retriesRemaining: number;
  retryCount: number;
}>;

export type ICompletionResultData = Readonly<{
  completionId: string;
  confidence: TCompletionConfidence;
  evidence: Readonly<ICompletionEvidence>;
  guard: Readonly<ICompletionGuardResult>;
  policyVersion: number;
  reasonCodes: readonly TCompletionReasonCode[];
  status: TCompletionStatus;
}>;

export type TCompletionResult = TQualityResult<ICompletionResultData>;

export interface ICompletionApi {
  complete(value: unknown): Readonly<TCompletionResult>;
}
