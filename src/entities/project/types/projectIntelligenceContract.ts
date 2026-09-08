export const PROJECT_INTELLIGENCE_VERSIONS = Object.freeze({
  api: 1,
  artifactSchema: 1,
  freshnessSchema: 1,
  graphSchema: 1,
});

export type TSpecWorthinessReason =
  | 'architectural-role'
  | 'critical-invariants'
  | 'domain-responsibility'
  | 'hard-to-recover'
  | 'high-change-risk'
  | 'many-consumers'
  | 'nontrivial-data-flow'
  | 'public-api'
  | 'reused';

export type TSpecWorthinessConfidence = 'high' | 'low' | 'medium';

export interface ISpecWorthinessDecision {
  readonly confidence: TSpecWorthinessConfidence;
  readonly isSpecWorthy: boolean;
  readonly reasons: readonly TSpecWorthinessReason[];
}

export interface IProjectKnowledge {
  readonly kind: 'project';
  readonly schemaVersion: number;

  readonly constraints?: readonly string[];
  readonly entryPoints?: readonly string[];
  readonly modules?: readonly string[];
  readonly purpose?: string;
  readonly sourceOfTruth?: readonly string[];
  readonly technologies?: readonly string[];
  readonly verification?: readonly string[];
}

export interface IArchitectureKnowledge {
  readonly kind: 'architecture';
  readonly schemaVersion: number;

  readonly boundaries?: readonly string[];
  readonly components?: readonly string[];
  readonly dataFlows?: readonly string[];
  readonly decisions?: readonly string[];
  readonly dependencyDirection?: readonly string[];
  readonly extensionModel?: readonly string[];
  readonly invariants?: readonly string[];
}

export interface IModuleKnowledge {
  readonly id: string;
  readonly kind: 'module';
  readonly schemaVersion: number;
  readonly sourceLocations: readonly string[];
  readonly specWorthy: Readonly<ISpecWorthinessDecision>;

  readonly consumers?: readonly string[];
  readonly dataFlow?: readonly string[];
  readonly decisions?: readonly string[];
  readonly dependencies?: readonly string[];
  readonly examples?: readonly string[];
  readonly extensionPoints?: readonly string[];
  readonly invariants?: readonly string[];
  readonly nonResponsibilities?: readonly string[];
  readonly publicContracts?: readonly string[];
  readonly purpose?: string;
  readonly responsibilities?: readonly string[];
  readonly sourceOfTruth?: readonly string[];
  readonly testing?: readonly string[];
}

export interface IProjectIntelligenceKnowledge {
  readonly architecture: Readonly<IArchitectureKnowledge>;
  readonly modules: readonly Readonly<IModuleKnowledge>[];
  readonly project: Readonly<IProjectKnowledge>;
}

export type TModuleCandidateSignal =
  | 'framework-convention'
  | 'package-boundary'
  | 'public-entrypoint'
  | 'source-boundary';

export interface IModuleCandidate {
  readonly id: string;
  readonly signals: readonly TModuleCandidateSignal[];
  readonly sourceLocations: readonly string[];
}

export interface IProjectDiscovery {
  readonly agentsInstructions: readonly string[];
  readonly configurations: readonly string[];
  readonly documentation: readonly string[];
  readonly manifests: readonly string[];
  readonly moduleCandidates: readonly Readonly<IModuleCandidate>[];
  readonly projectRoot: string;
}

export interface IProjectIntelligenceModuleIndex {
  readonly id: string;
  readonly path: string;
}

export interface IProjectIntelligenceIndex {
  readonly architecture: string;
  readonly modules: readonly Readonly<IProjectIntelligenceModuleIndex>[];
  readonly project: string;
  readonly schemaVersion: number;
}

export interface IProjectIntelligenceModuleSummary {
  readonly id: string;
}

export type TProjectIntelligenceOwner =
  | 'architecture'
  | `module:${string}`
  | 'project';

export type TProjectIntelligenceSourceRole =
  | 'architecture'
  | 'contract'
  | 'implementation'
  | 'unknown';

export type TProjectIntelligenceSourceKind =
  | 'directory'
  | 'file'
  | 'missing'
  | 'symlink';

export type TProjectIntelligenceGraphNodeKind =
  | 'architecture'
  | 'contract'
  | 'example'
  | 'module'
  | 'project'
  | 'reference'
  | 'source'
  | 'symbol'
  | 'test';

export type TProjectIntelligenceGraphRelation =
  | 'canonical_example'
  | 'consumed_by'
  | 'depends_on'
  | 'important_symbol'
  | 'owns'
  | 'public_api'
  | 'related_to'
  | 'tested_by';

export interface IProjectIntelligenceGraphNode {
  readonly id: string;
  readonly kind: TProjectIntelligenceGraphNodeKind;

  readonly label?: string;
  readonly moduleId?: string;
  readonly owner?: TProjectIntelligenceOwner;
  readonly path?: string;
  readonly semanticRole?: TProjectIntelligenceSourceRole;
}

export interface IProjectIntelligenceGraphEdge {
  readonly from: string;
  readonly relation: TProjectIntelligenceGraphRelation;
  readonly to: string;
}

export interface IProjectIntelligenceGraph {
  readonly edges: readonly Readonly<IProjectIntelligenceGraphEdge>[];
  readonly knowledgeFingerprint: string;
  readonly nodes: readonly Readonly<IProjectIntelligenceGraphNode>[];
  readonly schemaVersion: number;
}

export type TProjectIntelligenceGraphState = 'current' | 'missing' | 'stale';

export type TProjectIntelligenceChangeRisk =
  | 'high'
  | 'low'
  | 'medium'
  | 'unknown';

export type TProjectIntelligenceRiskReason =
  | 'critical-invariants'
  | 'graph-missing'
  | 'graph-stale'
  | 'high-change-risk'
  | 'many-consumers'
  | 'public-api';

export interface IProjectIntelligenceImpactAnalysis {
  readonly canonicalExamples: readonly string[];
  readonly consumers: readonly string[];
  readonly dependencies: readonly string[];
  readonly graphState: TProjectIntelligenceGraphState;
  readonly moduleId: string;
  readonly ownedSources: readonly string[];
  readonly publicApi: readonly string[];
  readonly relatedModules: readonly string[];
  readonly risk: TProjectIntelligenceChangeRisk;
  readonly riskReasons: readonly TProjectIntelligenceRiskReason[];
  readonly tests: readonly string[];
}

export interface IProjectIntelligenceSourceFingerprint {
  readonly bytes: number;
  readonly fileCount: number;
  readonly fingerprint: string;
  readonly kind: TProjectIntelligenceSourceKind;
  readonly path: string;
  readonly role: TProjectIntelligenceSourceRole;
}

export interface IProjectIntelligenceFreshnessOwnerSnapshot {
  readonly knowledgeFingerprint: string;
  readonly owner: TProjectIntelligenceOwner;
  readonly sources: readonly Readonly<IProjectIntelligenceSourceFingerprint>[];
}

export interface IProjectIntelligenceFreshnessSnapshot {
  readonly owners: readonly Readonly<IProjectIntelligenceFreshnessOwnerSnapshot>[];
  readonly schemaVersion: number;
}

export type TProjectIntelligenceFreshnessState =
  | 'stale'
  | 'trusted'
  | 'unknown';

export type TProjectIntelligenceChangeKind =
  | 'architecture'
  | 'contract'
  | 'implementation'
  | 'none'
  | 'unknown';

export type TProjectIntelligenceFreshnessReason =
  | 'architecture-drift'
  | 'baseline-missing'
  | 'contract-drift'
  | 'implementation-drift'
  | 'knowledge-changed'
  | 'no-sources'
  | 'source-missing'
  | 'source-set-changed'
  | 'unknown-drift';

export interface IProjectIntelligenceChangedSource {
  readonly currentFingerprint?: string;
  readonly path: string;
  readonly previousFingerprint?: string;
  readonly role: TProjectIntelligenceSourceRole;
}

export interface IProjectIntelligenceFreshnessOwnerAssessment {
  readonly changeKind: TProjectIntelligenceChangeKind;
  readonly changedSources: readonly Readonly<IProjectIntelligenceChangedSource>[];
  readonly owner: TProjectIntelligenceOwner;
  readonly reasons: readonly TProjectIntelligenceFreshnessReason[];
  readonly state: TProjectIntelligenceFreshnessState;
}

export interface IProjectIntelligenceFreshnessAssessment {
  readonly owners: readonly Readonly<IProjectIntelligenceFreshnessOwnerAssessment>[];
  readonly state: TProjectIntelligenceFreshnessState;
}

export type TAgentsRouterSyncResult =
  | Readonly<{ status: 'created' | 'unchanged' | 'updated' }>
  | Readonly<{
      reason: 'malformed-managed-block' | 'missing-knowledge';
      status: 'refused';
    }>;

export interface IProjectIntelligenceApi {
  analyzeImpact(id: string): Promise<Readonly<IProjectIntelligenceImpactAnalysis>>;
  assessFreshness(
    owners?: readonly string[],
  ): Promise<Readonly<IProjectIntelligenceFreshnessAssessment>>;
  discover(): Promise<Readonly<IProjectDiscovery>>;
  getModule(id: string): Promise<Readonly<IModuleKnowledge> | undefined>;
  listModules(): Promise<readonly Readonly<IProjectIntelligenceModuleSummary>[]>;
  loadGraph(): Promise<Readonly<IProjectIntelligenceGraph> | undefined>;
  loadKnowledge(): Promise<Readonly<IProjectIntelligenceKnowledge> | undefined>;
  rebuildGraph(): Promise<Readonly<IProjectIntelligenceGraph>>;
  refreshFreshness(
    owners?: readonly string[],
  ): Promise<Readonly<IProjectIntelligenceFreshnessSnapshot>>;
  resolveSourceLocations(id?: string): Promise<readonly string[]>;
  saveGraph(value: unknown): Promise<Readonly<IProjectIntelligenceGraph>>;
  saveKnowledge(value: unknown): Promise<Readonly<IProjectIntelligenceKnowledge>>;
  syncAgentsRouter(): Promise<TAgentsRouterSyncResult>;
}
