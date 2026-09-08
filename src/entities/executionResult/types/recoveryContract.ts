import type { TCompletionResult } from './completionContract.js';
import type { TExecutionPlan } from '#entities/executionPlan';

export const RECOVERY_VERSIONS = Object.freeze({
  api: 1,
  diagnosisSchema: 1,
  planSchema: 1,
  policy: 1,
});

export const DEFAULT_RECOVERY_POLICY = Object.freeze({
  maxEscalations: 1,
});

export const RECOVERY_LIMITS = Object.freeze({
  maxEscalationsHardCap: 3,
});

export type TRecoveryFailureClass =
  | 'architecture-uncertainty'
  | 'context-understanding'
  | 'implementation'
  | 'integration'
  | 'tool'
  | 'verification';

export type TRecoveryAction =
  | 'compute-escalate'
  | 'context-expand'
  | 'debugger'
  | 'retry'
  | 'stop';

export type TRecoveryBranchKind =
  | 'dag-node'
  | 'integration'
  | 'task'
  | 'verification';

export type TRecoveryReasonCode =
  | 'completion-already-complete'
  | 'completion-guard-terminal'
  | 'compute-escalation-required'
  | 'context-expansion-required'
  | 'debugger-required'
  | 'direct-retry-not-authorized'
  | 'escalation-budget-exhausted'
  | 'failure-diagnosed'
  | 'failure-evidence-preserved'
  | 'retry-budget-available'
  | 'scoped-retry'
  | 'verification-required';

export type IRecoveryPolicyConfig = Readonly<{
  maxEscalations: number;
}>;

export type IRecoveryBranch = Readonly<{
  id: string;
  kind: TRecoveryBranchKind;
}>;

export type IRecoveryFailureSignal = Readonly<{
  branch: Readonly<IRecoveryBranch>;
  directRetryAllowed: boolean;
  evidenceRefs: readonly string[];
  failureClass: TRecoveryFailureClass;
  summary: string;
}>;

export type IRecoveryFact = Readonly<{
  ref: string;
  summary: string;
}>;

export type IRecoveryInput = Readonly<{
  completionResult: Readonly<TCompletionResult>;
  failure: Readonly<IRecoveryFailureSignal>;
  recoveryId: string;

  escalationCount?: number;
  preservedFacts?: readonly Readonly<IRecoveryFact>[];
}>;

export type IRecoveryDiagnosis = Readonly<{
  branch: Readonly<IRecoveryBranch>;
  directRetryAllowed: boolean;
  evidenceRefs: readonly string[];
  failureClass: TRecoveryFailureClass;
  kind: 'recovery-diagnosis';
  schemaVersion: number;
  summary: string;
}>;

export type IRecoveryAttemptState = Readonly<{
  escalationCount: number;
  escalationsRemaining: number;
  retriesRemaining: number;
  retryCount: number;

  nextEscalationCount?: number;
  nextRetryCount?: number;
}>;

export type IRecoveryPlanData = Readonly<{
  action: TRecoveryAction;
  attempt: Readonly<IRecoveryAttemptState>;
  diagnosis: Readonly<IRecoveryDiagnosis>;
  policyVersion: number;
  preservedFacts: readonly Readonly<IRecoveryFact>[];
  reasonCodes: readonly TRecoveryReasonCode[];
  recoveryId: string;
  requiresVerification: boolean;
}>;

export type TRecoveryPlan = TExecutionPlan<IRecoveryPlanData>;

export interface IRecoveryApi {
  recover(value: unknown): Readonly<TRecoveryPlan>;
}
