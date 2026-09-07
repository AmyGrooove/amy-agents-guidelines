import {
  chooseContextBudgetProfile,
  getContextBudgetLimits,
} from './context-budget.js';
import { compileContextSelection } from './context-compiler.js';
import { createContextExplorationCacheKey } from './context-exploration-cache.js';
import { fingerprintProjectIntelligenceKnowledge } from '../project-intelligence/project-intelligence-graph.js';
import { validateContextResolutionInput } from './validate-context-intelligence.js';

import type {
  IContextBudgetSummary,
  IContextModuleSelection,
  IContextSpecSelection,
  TContextEvidenceGap,
  TContextGraphState,
  TContextIntelligenceSelection,
  TContextModuleFreshness,
  TContextReasonCode,
} from './context-intelligence-contract.js';
import type {
  IModuleKnowledge,
  IProjectIntelligenceApi,
  IProjectIntelligenceImpactAnalysis,
} from '../project-intelligence/project-intelligence-contract.js';

export interface IResolveTaskContextOptions {
  cache?: Readonly<import('./context-exploration-cache.js').IContextExplorationCache>;
  projectIntelligence?: Readonly<IProjectIntelligenceApi>;
}

const normalizePathTarget = (target: string) => target.replaceAll('\\', '/');

const checkLooksLikeProjectPath = (target: string) => {
  const normalized = normalizePathTarget(target);

  return (
    normalized.includes('/') ||
    /\.(?:[cm]?[jt]sx?|css|html|json|md|scss|ya?ml)$/.test(normalized)
  );
};

const unique = (values: readonly string[]) => [...new Set(values)];

const checkPathMatchesModule = (
  target: string,
  module: Readonly<IModuleKnowledge>,
) => {
  const normalizedTarget = normalizePathTarget(target).replace(/^\.\//, '');

  return module.sourceLocations.some((location) => {
    const normalizedLocation = normalizePathTarget(location).replace(/\/$/, '');

    return (
      normalizedTarget === normalizedLocation ||
      normalizedTarget.startsWith(`${normalizedLocation}/`)
    );
  });
};

const createFallbackSelection = (
  input: ReturnType<typeof validateContextResolutionInput>,
  projectState: 'missing' | 'unavailable',
) => {
  const { classification, contract } = input.taskAnalysis.data;
  const profile = chooseContextBudgetProfile(
    classification.dimensions.expectedContextCost,
    input.budgetProfile,
  );
  const limits = getContextBudgetLimits(profile);
  const explicitFiles = unique(
    (contract.affectedScope?.targets ?? [])
      .filter(checkLooksLikeProjectPath)
      .map(normalizePathTarget),
  );
  const likelyAffectedFiles = explicitFiles.slice(0, limits.maxFiles);
  const truncated = explicitFiles.length > likelyAffectedFiles.length;
  const reasons = new Set<TContextReasonCode>([
    projectState === 'missing'
      ? 'project-knowledge-missing'
      : 'project-intelligence-unavailable',
  ]);

  if (explicitFiles.length > 0) {
    reasons.add('explicit-file-target');
    reasons.add('source-confirmation-required');
  } else {
    reasons.add('scout-recommended');
  }

  if (truncated) {
    reasons.add('budget-truncated');
  }

  const evidenceGap: TContextEvidenceGap =
    projectState === 'missing' ? 'project-knowledge' : 'project-intelligence';
  const budget: Readonly<IContextBudgetSummary> = Object.freeze({
    limits,
    profile,
    truncated,
    usage: Object.freeze({
      files: likelyAffectedFiles.length,
      modules: 0,
      specItems: 0,
    }),
  });

  return compileContextSelection({
    budget,
    confidence: explicitFiles.length > 0 ? 'medium' : 'low',
    contract,
    evidenceGaps: [evidenceGap],
    exploration: explicitFiles.length > 0 ? 'source-read' : 'scout',
    likelyAffectedFiles,
    reasonCodes: [...reasons],
    sourceReads: likelyAffectedFiles,
  });
};

const createBudgetedArchitectureSelection = (
  decisions: readonly string[] | undefined,
  invariants: readonly string[] | undefined,
  maxItems: number,
) => {
  const availableDecisions = decisions ?? [];
  const availableInvariants = invariants ?? [];
  const selectedDecisions = availableDecisions.slice(0, maxItems);
  const remaining = Math.max(0, maxItems - selectedDecisions.length);
  const selectedInvariants = availableInvariants.slice(0, remaining);
  const used = selectedDecisions.length + selectedInvariants.length;

  return Object.freeze({
    decisions: Object.freeze(selectedDecisions),
    invariants: Object.freeze(selectedInvariants),
    truncated: availableDecisions.length + availableInvariants.length > used,
    used,
  });
};

const createBudgetedSpecSelections = (
  modules: readonly Readonly<IModuleKnowledge>[],
  maxItems: number,
) => {
  let remaining = maxItems;
  let totalAvailable = 0;
  const specs: Readonly<IContextSpecSelection>[] = [];

  const takeValues = (values: readonly string[] | undefined) => {
    totalAvailable += values?.length ?? 0;

    if (!values || remaining === 0) {
      return undefined;
    }

    const selected = values.slice(0, remaining);
    remaining -= selected.length;

    return selected.length > 0 ? Object.freeze(selected) : undefined;
  };

  modules.forEach((module) => {
    const spec: {
      moduleId: string;
      purpose?: string;
      invariants?: readonly string[];
      publicContracts?: readonly string[];
      decisions?: readonly string[];
      dependencies?: readonly string[];
      testing?: readonly string[];
      examples?: readonly string[];
      responsibilities?: readonly string[];
    } = { moduleId: module.id };

    if (module.purpose) {
      totalAvailable += 1;
      if (remaining > 0) {
        spec.purpose = module.purpose;
        remaining -= 1;
      }
    }

    const invariants = takeValues(module.invariants);
    const publicContracts = takeValues(module.publicContracts);
    const decisions = takeValues(module.decisions);
    const dependencies = takeValues(module.dependencies);
    const testing = takeValues(module.testing);
    const examples = takeValues(module.examples);
    const responsibilities = takeValues(module.responsibilities);

    if (invariants) spec.invariants = invariants;
    if (publicContracts) spec.publicContracts = publicContracts;
    if (decisions) spec.decisions = decisions;
    if (dependencies) spec.dependencies = dependencies;
    if (testing) spec.testing = testing;
    if (examples) spec.examples = examples;
    if (responsibilities) spec.responsibilities = responsibilities;

    specs.push(Object.freeze(spec));
  });

  return Object.freeze({
    specs: Object.freeze(specs),
    truncated: totalAvailable > maxItems,
    used: maxItems - remaining,
  });
};

const getOwnerState = (
  owners: ReadonlyMap<string, TContextModuleFreshness>,
  owner: string,
): TContextModuleFreshness => owners.get(owner) ?? 'unknown';

export const resolveTaskContext = async (
  value: unknown,
  options: IResolveTaskContextOptions = {},
): Promise<Readonly<TContextIntelligenceSelection>> => {
  const input = validateContextResolutionInput(value);
  const projectIntelligence = options.projectIntelligence;

  if (!projectIntelligence) {
    return createFallbackSelection(input, 'unavailable');
  }

  const knowledge = await projectIntelligence.loadKnowledge();

  if (!knowledge) {
    return createFallbackSelection(input, 'missing');
  }

  const { classification, contract } = input.taskAnalysis.data;
  const profile = chooseContextBudgetProfile(
    classification.dimensions.expectedContextCost,
    input.budgetProfile,
  );
  const limits = getContextBudgetLimits(profile);
  const targets = contract.affectedScope?.targets ?? [];
  const explicitFiles = unique(
    targets.filter(checkLooksLikeProjectPath).map(normalizePathTarget),
  );
  const reasons = new Set<TContextReasonCode>();
  const gaps = new Set<TContextEvidenceGap>();
  const primaryModules = knowledge.modules.filter((module) => {
    if (targets.includes(module.id)) {
      reasons.add('module-id-match');
      return true;
    }

    if (targets.some((target) => checkPathMatchesModule(target, module))) {
      reasons.add('source-path-match');
      return true;
    }

    return false;
  });
  const selectedModules = primaryModules.slice(0, limits.maxModules);
  let truncated = primaryModules.length > selectedModules.length;

  if (explicitFiles.length > 0) {
    reasons.add('explicit-file-target');
  }

  if (selectedModules.length === 0) {
    const unresolvedSemanticTargets = targets.filter(
      (target) => !checkLooksLikeProjectPath(target),
    );

    if (unresolvedSemanticTargets.length > 0) {
      reasons.add('unresolved-scope-target');
      gaps.add('scope-target');
      reasons.add('scout-recommended');
    } else if (explicitFiles.length === 0) {
      reasons.add('scout-recommended');
    }

    const likelyAffectedFiles = explicitFiles.slice(0, limits.maxFiles);
    truncated ||= explicitFiles.length > likelyAffectedFiles.length;
    if (truncated) {
      reasons.add('budget-truncated');
    }

    const needsScout = unresolvedSemanticTargets.length > 0 || explicitFiles.length === 0;

    return compileContextSelection({
      budget: Object.freeze({
        limits,
        profile,
        truncated,
        usage: Object.freeze({
          files: likelyAffectedFiles.length,
          modules: 0,
          specItems: 0,
        }),
      }),
      confidence: needsScout ? 'low' : 'medium',
      contract,
      evidenceGaps: [...gaps],
      exploration: needsScout ? 'scout' : 'source-read',
      likelyAffectedFiles,
      reasonCodes: [...reasons],
      sourceReads: likelyAffectedFiles,
    });
  }

  const hasArchitectureContext =
    (knowledge.architecture.decisions?.length ?? 0) > 0 ||
    (knowledge.architecture.invariants?.length ?? 0) > 0;
  const owners = [
    ...(hasArchitectureContext ? ['architecture'] : []),
    ...selectedModules.map(({ id }) => `module:${id}`),
  ];
  const freshness = await projectIntelligence.assessFreshness(owners);
  const ownerStates = new Map(
    freshness.owners.map(({ owner, state }) => [owner, state] as const),
  );
  const graph = options.cache ? await projectIntelligence.loadGraph() : undefined;
  const graphIsCurrent =
    graph?.knowledgeFingerprint === fingerprintProjectIntelligenceKnowledge(knowledge);
  const allCacheOwnersTrusted = owners.every(
    (owner) => getOwnerState(ownerStates, owner) === 'trusted',
  );
  const cacheKey =
    options.cache && graph && graphIsCurrent && allCacheOwnersTrusted
      ? createContextExplorationCacheKey(input, knowledge, graph)
      : undefined;

  if (cacheKey && options.cache) {
    const cached = await options.cache.get(cacheKey);

    if (cached) {
      return cached;
    }
  }

  const impacts = await Promise.all(
    selectedModules.map(({ id }) => projectIntelligence.analyzeImpact(id)),
  );
  const impactByModule = new Map(
    impacts.map((impact) => [impact.moduleId, impact] as const),
  );
  const moduleSelections: Readonly<IContextModuleSelection>[] = selectedModules.map(
    (module) => {
      const impact = impactByModule.get(module.id);

      return Object.freeze({
        freshness: getOwnerState(ownerStates, `module:${module.id}`),
        graphState: (impact?.graphState ?? 'missing') as TContextGraphState,
        id: module.id,
        relevance: 'primary',
        sourceLocations: Object.freeze([...module.sourceLocations]),
      });
    },
  );

  const trustedModules = selectedModules.filter(
    ({ id }) => getOwnerState(ownerStates, `module:${id}`) === 'trusted',
  );
  const architectureTrusted =
    !hasArchitectureContext || getOwnerState(ownerStates, 'architecture') === 'trusted';
  const architectureBudget = createBudgetedArchitectureSelection(
    architectureTrusted ? knowledge.architecture.decisions : undefined,
    architectureTrusted ? knowledge.architecture.invariants : undefined,
    limits.maxSpecItems,
  );
  const specBudget = createBudgetedSpecSelections(
    trustedModules,
    Math.max(0, limits.maxSpecItems - architectureBudget.used),
  );
  const specs = specBudget.specs;
  const architectureDecisions = architectureBudget.decisions;
  const architectureInvariants = architectureBudget.invariants;
  const specItems = architectureBudget.used + specBudget.used;
  const graphStates = moduleSelections.map(({ graphState }) => graphState);
  const staleModules = moduleSelections.filter(({ freshness }) => freshness === 'stale');
  const unknownModules = moduleSelections.filter(({ freshness }) => freshness === 'unknown');

  if (staleModules.length > 0) {
    reasons.add('freshness-stale');
    gaps.add('freshness');
  }
  if (unknownModules.length > 0 || !architectureTrusted) {
    reasons.add('freshness-unknown');
    gaps.add('freshness');
  }
  if (graphStates.includes('missing')) {
    reasons.add('graph-missing');
    gaps.add('project-relationships');
  }
  if (graphStates.includes('stale')) {
    reasons.add('graph-stale');
    gaps.add('project-relationships');
  }

  const impactFiles = impacts.flatMap((impact) => [
    ...impact.tests,
    ...impact.ownedSources,
    ...impact.canonicalExamples,
  ]);
  const allLikelyFiles = unique([...explicitFiles, ...impactFiles]);
  const likelyAffectedFiles = allLikelyFiles.slice(0, limits.maxFiles);
  truncated ||= allLikelyFiles.length > likelyAffectedFiles.length;
  truncated ||= architectureBudget.truncated || specBudget.truncated;

  const requiresSourceConfirmation =
    explicitFiles.length > 0 ||
    staleModules.length > 0 ||
    unknownModules.length > 0 ||
    graphStates.some((state) => state !== 'current') ||
    !architectureTrusted;

  if (requiresSourceConfirmation) {
    reasons.add('source-confirmation-required');
  } else {
    reasons.add('trusted-spec-sufficient');
  }
  if (truncated) {
    reasons.add('budget-truncated');
  }

  const sourceReads = requiresSourceConfirmation
    ? unique([
        ...explicitFiles,
        ...moduleSelections.flatMap(({ sourceLocations }) => sourceLocations),
        ...impactFiles,
      ]).slice(0, limits.maxFiles)
    : [];
  const dependencies = unique([
    ...specs.flatMap(({ dependencies }) => dependencies ?? []),
    ...impacts.flatMap(({ dependencies }) => dependencies),
  ]);
  const canonicalExamples = unique([
    ...specs.flatMap(({ examples }) => examples ?? []),
    ...impacts.flatMap(({ canonicalExamples }) => canonicalExamples),
  ]);
  const invariants = unique([
    ...architectureInvariants,
    ...specs.flatMap(({ invariants }) => invariants ?? []),
  ]);
  const verification = unique([
    ...specs.flatMap(({ testing }) => testing ?? []),
    ...impacts.flatMap(({ tests }) => tests),
  ]);
  const allTrusted = moduleSelections.every(
    ({ freshness, graphState }) => freshness === 'trusted' && graphState === 'current',
  );
  const confidence = allTrusted && architectureTrusted ? 'high' : 'medium';

  const selection = compileContextSelection({
    architectureDecisions,
    budget: Object.freeze({
      limits,
      profile,
      truncated,
      usage: Object.freeze({
        files: likelyAffectedFiles.length,
        modules: moduleSelections.length,
        specItems,
      }),
    }),
    canonicalExamples,
    confidence,
    contract,
    dependencies,
    evidenceGaps: [...gaps],
    exploration: requiresSourceConfirmation ? 'source-read' : 'none',
    invariants,
    likelyAffectedFiles,
    modules: moduleSelections,
    reasonCodes: [...reasons],
    sourceReads,
    specs,
    verification,
  });

  if (cacheKey && options.cache && selection.data.resolution.exploration === 'none') {
    await options.cache.set(cacheKey, selection);
  }

  return selection;
};
