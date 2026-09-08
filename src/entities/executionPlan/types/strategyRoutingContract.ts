import type { TAgentRole } from '#entities/agentRole';
import type { TComputeProfile, IComputeRoutingDecision } from '#entities/computeProfile';
import type { IContextResolution } from '#entities/context';
import type { TExecutionStrategy } from './pipelineContract.js';
import type { TTaskConfidence, TTaskIntelligenceAnalysis } from '#entities/task';

export const STRATEGY_ROUTING_VERSIONS = Object.freeze({
  api: 1,
  decisionSchema: 1,
  policy: 1,
});

export type TStrategyExploration =
  | 'none'
  | 'source-read'
  | Extract<TAgentRole, 'scout'>;
export type TStrategyPlanning = 'decompose' | 'none' | 'plan';
export type TStrategyExecution = 'direct' | Extract<TAgentRole, 'worker'>;
export type TStrategyVerification = 'none' | Extract<TAgentRole, 'verifier'>;
export type TStrategyReview = 'none' | Extract<TAgentRole, 'reviewer'>;
export type TStrategyEscalation = 'compute' | 'none';

export type TStrategyReasonCode =
  | 'compute-profile-provided'
  | 'compute-unavailable'
  | 'context-scout-required'
  | 'context-source-read-required'
  | 'decomposition-recommended'
  | 'direct-execution'
  | 'fast-path'
  | 'low-task-confidence'
  | 'planning-recommended'
  | 'reviewer-risk-justified'
  | 'verifier-risk-justified'
  | 'worker-recommended';

export type IStrategyRoutingInput = Readonly<{
  taskAnalysis: Readonly<TTaskIntelligenceAnalysis>;

  computeDecision?: Readonly<IComputeRoutingDecision>;
  contextResolution?: Readonly<IContextResolution>;
}>;

export type IStrategyRoutingData = Readonly<{
  confidence: TTaskConfidence;
  escalation: TStrategyEscalation;
  execution: TStrategyExecution;
  exploration: TStrategyExploration;
  fastPath: boolean;
  planning: TStrategyPlanning;
  policyVersion: number;
  reasonCodes: readonly TStrategyReasonCode[];
  review: TStrategyReview;
  verification: TStrategyVerification;

  computeProfile?: TComputeProfile;
}>;

export type TStrategyRoutingDecision = TExecutionStrategy<IStrategyRoutingData>;

export interface IStrategyRoutingApi {
  route(value: unknown): Readonly<TStrategyRoutingDecision>;
}
