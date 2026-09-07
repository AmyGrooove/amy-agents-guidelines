export const PROJECT_INTELLIGENCE_VERSIONS = Object.freeze({
  api: 1,
  artifactSchema: 1,
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

export type TAgentsRouterSyncResult =
  | Readonly<{ status: 'created' | 'unchanged' | 'updated' }>
  | Readonly<{
      reason: 'malformed-managed-block' | 'missing-knowledge';
      status: 'refused';
    }>;

export interface IProjectIntelligenceApi {
  discover(): Promise<Readonly<IProjectDiscovery>>;
  getModule(id: string): Promise<Readonly<IModuleKnowledge> | undefined>;
  listModules(): Promise<readonly Readonly<IProjectIntelligenceModuleSummary>[]>;
  loadKnowledge(): Promise<Readonly<IProjectIntelligenceKnowledge> | undefined>;
  resolveSourceLocations(id?: string): Promise<readonly string[]>;
  saveKnowledge(value: unknown): Promise<Readonly<IProjectIntelligenceKnowledge>>;
  syncAgentsRouter(): Promise<TAgentsRouterSyncResult>;
}
