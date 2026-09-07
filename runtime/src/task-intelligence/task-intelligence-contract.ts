import type { TTaskAnalysis } from '../contracts/pipeline-contracts.js';

export const TASK_INTELLIGENCE_VERSIONS = Object.freeze({
  analysisSchema: 1,
  api: 1,
  classificationSchema: 1,
  taskContractSchema: 1,
});

export type TTaskConfidence = 'high' | 'low' | 'medium';
export type TTaskLevel = 'high' | 'low' | 'medium' | 'unknown';
export type TTaskScope =
  | 'local'
  | 'module'
  | 'multi-module'
  | 'repository'
  | 'unknown';

export type ITaskAffectedScope = Readonly<{
  kind: TTaskScope;
  targets?: readonly string[];
}>;

export type ITaskContract = Readonly<{
  goal: string;
  kind: 'task-contract';
  schemaVersion: number;

  acceptanceCriteria?: readonly string[];
  affectedScope?: Readonly<ITaskAffectedScope>;
  constraints?: readonly string[];
  nonGoals?: readonly string[];
  requirements?: readonly string[];
  uncertainties?: readonly string[];
  verificationExpectations?: readonly string[];
}>;

export type TTaskProjectFreshnessState = 'stale' | 'trusted' | 'unknown';
export type TTaskProjectGraphState = 'current' | 'missing' | 'stale';
export type TTaskProjectRisk = 'high' | 'low' | 'medium' | 'unknown';
export type TTaskProjectRiskReason =
  | 'critical-invariants'
  | 'graph-missing'
  | 'graph-stale'
  | 'high-change-risk'
  | 'many-consumers'
  | 'public-api';

export type ITaskProjectModuleEvidence = Readonly<{
  moduleId: string;

  freshnessState?: TTaskProjectFreshnessState;
  graphState?: TTaskProjectGraphState;
  risk?: TTaskProjectRisk;
  riskReasons?: readonly TTaskProjectRiskReason[];
}>;

export type ITaskProjectEvidence = Readonly<{
  kind: 'project-intelligence';
  modules: readonly Readonly<ITaskProjectModuleEvidence>[];
}>;

export type ITaskClassificationInput = Readonly<{
  contract: Readonly<ITaskContract>;
  projectEvidence?: Readonly<ITaskProjectEvidence>;
}>;

export type TTaskClassificationMode = 'project-assisted' | 'text-only';

export type TTaskClassificationReasonCode =
  | 'acceptance-criteria-many'
  | 'acceptance-criteria-present'
  | 'critical-invariants'
  | 'high-change-risk'
  | 'many-consumers'
  | 'project-evidence-stale'
  | 'project-risk-high'
  | 'project-risk-low'
  | 'project-risk-medium'
  | 'public-api-impact'
  | 'requirements-many'
  | 'requirements-present'
  | 'scope-local'
  | 'scope-module'
  | 'scope-multi-module'
  | 'scope-repository'
  | 'scope-unknown'
  | 'uncertainties-many'
  | 'uncertainties-none'
  | 'uncertainties-present'
  | 'verification-explicit'
  | 'verification-many'
  | 'verification-none';

export type TTaskClassificationEvidenceGap =
  | 'affected-scope'
  | 'novelty'
  | 'parallel-independence'
  | 'project-risk'
  | 'stale-project-evidence'
  | 'uncertainty'
  | 'verification';

export type ITaskClassificationDimensions = Readonly<{
  blastRadius: TTaskScope;
  complexity: TTaskLevel;
  coupling: TTaskLevel;
  expectedContextCost: TTaskLevel;
  novelty: TTaskLevel;
  parallelizability: TTaskLevel;
  risk: TTaskLevel;
  scope: TTaskScope;
  uncertainty: TTaskLevel;
  verificationCost: TTaskLevel;
}>;

export type ITaskClassification = Readonly<{
  confidence: TTaskConfidence;
  dimensions: Readonly<ITaskClassificationDimensions>;
  evidenceGaps: readonly TTaskClassificationEvidenceGap[];
  mode: TTaskClassificationMode;
  reasonCodes: readonly TTaskClassificationReasonCode[];
  schemaVersion: number;
}>;

export type ITaskAnalysisData = Readonly<{
  classification: Readonly<ITaskClassification>;
  contract: Readonly<ITaskContract>;
}>;

export type TTaskIntelligenceAnalysis = TTaskAnalysis<ITaskAnalysisData>;

export interface ITaskIntelligenceApi {
  classify(value: unknown): Readonly<TTaskIntelligenceAnalysis>;
  validateContract(value: unknown): Readonly<ITaskContract>;
}
