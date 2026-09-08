import type { IAgentHandoff, TAgentRole } from '#entities/agentRole';
import type { TExecutionPlan } from './pipelineContract.js';
import type { TStrategyRoutingDecision } from './strategyRoutingContract.js';
import type { TTaskConfidence, TTaskIntelligenceAnalysis } from '#entities/task';

export const DECOMPOSITION_VERSIONS = Object.freeze({
  api: 1,
  planSchema: 1,
  policy: 1,
  proposalSchema: 1,
});

export const DEFAULT_DECOMPOSITION_POLICY = Object.freeze({
  maxDelegationDepth: 2,
  maxNodes: 3,
});

export type TDecompositionNodeRole = Extract<TAgentRole, 'scout' | 'worker'>;
export type TDecompositionDecision = 'blocked' | 'not-needed' | 'planned' | 'proposal-required';
export type TDecompositionTrigger = 'strategy' | 'worker';
export type TDagNodeReadiness = 'blocked' | 'ready';
export type TDagFailurePolicy = 'block-dependents';
export type TDagCancellationPolicy = 'cascade-dependents';
export type TDagReplanningPolicy = 'allowed';
export type TParallelismMode = 'parallel' | 'sequential';

export type TDecompositionReasonCode =
  | 'delegation-depth-limit'
  | 'decomposition-planned'
  | 'node-limit-exceeded'
  | 'semantic-proposal-required'
  | 'single-node-no-decomposition'
  | 'strategy-decomposition-not-requested'
  | 'worker-decomposition-requested';

export type TParallelismReasonCode =
  | 'coordination-cost-high'
  | 'dependency-ordering'
  | 'dependency-uncertainty'
  | 'duplicated-context'
  | 'independent-work-available'
  | 'integration-cost-high'
  | 'parallelism-not-beneficial'
  | 'parallelism-recommended'
  | 'write-conflict';

export type IDecompositionPolicyConfig = Readonly<{
  maxDelegationDepth: number;
  maxNodes: number;
}>;

export type IDecompositionNodeProposal = Readonly<{
  contextRefs?: readonly string[];
  dependencies: readonly string[];
  goal: string;
  id: string;
  outputs: readonly string[];
  ownerRole: TDecompositionNodeRole;
  readTargets: readonly string[];
  writeTargets: readonly string[];
}>;

export type IDecompositionProposal = Readonly<{
  kind: 'decomposition-proposal';
  nodes: readonly Readonly<IDecompositionNodeProposal>[];
  proposalId: string;
  schemaVersion: number;
}>;

export type IStrategyDecompositionSource = Readonly<{
  kind: 'strategy';
  strategyDecision: Readonly<TStrategyRoutingDecision>;
}>;

export type IWorkerDecompositionSource = Readonly<{
  depth: number;
  handoff: Readonly<IAgentHandoff>;
  kind: 'worker';
}>;

export type TDecompositionSource =
  | IStrategyDecompositionSource
  | IWorkerDecompositionSource;

export type IDecompositionInput = Readonly<{
  source: Readonly<TDecompositionSource>;
  taskAnalysis: Readonly<TTaskIntelligenceAnalysis>;

  proposal?: Readonly<IDecompositionProposal>;
}>;

export type IDecompositionDagNode = Readonly<{
  contextRefs: readonly string[];
  dependencies: readonly string[];
  goal: string;
  id: string;
  outputs: readonly string[];
  ownerRole: TDecompositionNodeRole;
  readTargets: readonly string[];
  readiness: TDagNodeReadiness;
  writeTargets: readonly string[];
}>;

export type IDecompositionDag = Readonly<{
  id: string;
  nodes: readonly Readonly<IDecompositionDagNode>[];
}>;

export type IDecompositionLifecyclePolicy = Readonly<{
  cancellation: TDagCancellationPolicy;
  failure: TDagFailurePolicy;
  replanning: TDagReplanningPolicy;
}>;

export type IParallelismDecision = Readonly<{
  confidence: TTaskConfidence;
  maxConcurrency: number;
  mode: TParallelismMode;
  reasonCodes: readonly TParallelismReasonCode[];
}>;

export type IDecompositionLimits = Readonly<{
  effectiveMaxNodes: number;
  maxDelegationDepth: number;
  maxNodes: number;
}>;

export type IDecompositionPlanData = Readonly<{
  confidence: TTaskConfidence;
  decision: TDecompositionDecision;
  delegationDepth: number;
  lifecyclePolicy: Readonly<IDecompositionLifecyclePolicy>;
  limits: Readonly<IDecompositionLimits>;
  parallelism: Readonly<IParallelismDecision>;
  policyVersion: number;
  reasonCodes: readonly TDecompositionReasonCode[];
  trigger: TDecompositionTrigger;

  dag?: Readonly<IDecompositionDag>;
}>;

export type TDecompositionPlan = TExecutionPlan<IDecompositionPlanData>;

export interface IDecompositionApi {
  plan(value: unknown): Readonly<TDecompositionPlan>;
}
