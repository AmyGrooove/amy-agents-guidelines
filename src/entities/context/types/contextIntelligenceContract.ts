import type { TContextSelection } from './pipelineContract.js';
import type { TTaskIntelligenceAnalysis } from '#entities/task';

export const CONTEXT_INTELLIGENCE_VERSIONS = Object.freeze({
  api: 1,
  packetSchema: 1,
  resolutionSchema: 1,
});

export type TContextBudgetProfile = 'large' | 'small' | 'standard';
export type TContextConfidence = 'high' | 'low' | 'medium';
export type TContextExploration = 'none' | 'scout' | 'source-read';
export type TContextModuleFreshness = 'stale' | 'trusted' | 'unknown';
export type TContextModuleRelevance = 'primary' | 'supporting';
export type TContextGraphState = 'current' | 'missing' | 'stale';

export type TContextReasonCode =
  | 'budget-truncated'
  | 'explicit-file-target'
  | 'freshness-stale'
  | 'freshness-unknown'
  | 'graph-missing'
  | 'graph-stale'
  | 'module-id-match'
  | 'project-intelligence-unavailable'
  | 'project-knowledge-missing'
  | 'scout-recommended'
  | 'source-confirmation-required'
  | 'source-path-match'
  | 'trusted-spec-sufficient'
  | 'unresolved-scope-target';

export type TContextEvidenceGap =
  | 'freshness'
  | 'project-intelligence'
  | 'project-knowledge'
  | 'project-relationships'
  | 'scope-target';

export type IContextBudgetLimits = Readonly<{
  maxFiles: number;
  maxModules: number;
  maxSpecItems: number;
}>;

export type IContextBudgetUsage = Readonly<{
  files: number;
  modules: number;
  specItems: number;
}>;

export type IContextBudgetSummary = Readonly<{
  limits: Readonly<IContextBudgetLimits>;
  profile: TContextBudgetProfile;
  truncated: boolean;
  usage: Readonly<IContextBudgetUsage>;
}>;

export type IContextModuleSelection = Readonly<{
  freshness: TContextModuleFreshness;
  graphState: TContextGraphState;
  id: string;
  relevance: TContextModuleRelevance;
  sourceLocations: readonly string[];
}>;

export type IContextSpecSelection = Readonly<{
  moduleId: string;

  decisions?: readonly string[];
  dependencies?: readonly string[];
  examples?: readonly string[];
  invariants?: readonly string[];
  publicContracts?: readonly string[];
  purpose?: string;
  responsibilities?: readonly string[];
  testing?: readonly string[];
}>;

export type IContextPacket = Readonly<{
  acceptanceCriteria: readonly string[];
  architectureDecisions: readonly string[];
  canonicalExamples: readonly string[];
  constraints: readonly string[];
  dependencies: readonly string[];
  goal: string;
  invariants: readonly string[];
  likelyAffectedFiles: readonly string[];
  modules: readonly Readonly<IContextModuleSelection>[];
  nonGoals: readonly string[];
  requirements: readonly string[];
  schemaVersion: number;
  specs: readonly Readonly<IContextSpecSelection>[];
  verification: readonly string[];
}>;

export type IContextResolution = Readonly<{
  budget: Readonly<IContextBudgetSummary>;
  confidence: TContextConfidence;
  evidenceGaps: readonly TContextEvidenceGap[];
  exploration: TContextExploration;
  reasonCodes: readonly TContextReasonCode[];
  schemaVersion: number;
  sourceReads: readonly string[];
}>;

export type IContextSelectionData = Readonly<{
  packet: Readonly<IContextPacket>;
  resolution: Readonly<IContextResolution>;
}>;

export type TContextIntelligenceSelection = TContextSelection<IContextSelectionData>;

export type IContextResolutionInput = Readonly<{
  budgetProfile?: TContextBudgetProfile;
  taskAnalysis: Readonly<TTaskIntelligenceAnalysis>;
}>;

export interface IContextIntelligenceApi {
  resolve(value: unknown): Promise<Readonly<TContextIntelligenceSelection>>;
}
