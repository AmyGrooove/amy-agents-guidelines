import { getAgentRole } from '#entities/agentRole';
import {
  DECOMPOSITION_VERSIONS,
  DEFAULT_DECOMPOSITION_POLICY,
} from '#entities/executionPlan';
import {
  validateDecompositionInput,
  validateDecompositionPolicy,
} from '#entities/executionPlan';

import type { TTaskConfidence } from '#entities/task';
import type {
  IDecompositionDag,
  IDecompositionDagNode,
  IDecompositionInput,
  IDecompositionLifecyclePolicy,
  IDecompositionLimits,
  IDecompositionPlanData,
  IDecompositionPolicyConfig,
  IParallelismDecision,
  TDecompositionPlan,
  TDecompositionReasonCode,
  TParallelismReasonCode,
} from '#entities/executionPlan';

export interface IPlanDecompositionOptions {
  policy?: Readonly<IDecompositionPolicyConfig>;
}

const LIFECYCLE_POLICY: Readonly<IDecompositionLifecyclePolicy> = Object.freeze({
  cancellation: 'cascade-dependents',
  failure: 'block-dependents',
  replanning: 'allowed',
});

const emptyParallelism = (): Readonly<IParallelismDecision> => Object.freeze({
  confidence: 'high',
  maxConcurrency: 0,
  mode: 'sequential',
  reasonCodes: Object.freeze(['parallelism-not-beneficial'] as const),
});

const intersects = (left: readonly string[], right: readonly string[]) => {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
};

const hasPath = (
  byId: ReadonlyMap<string, Readonly<IDecompositionDagNode>>,
  from: string,
  to: string,
): boolean => {
  const node = byId.get(to);
  if (!node) return false;
  if (node.dependencies.includes(from)) return true;
  return node.dependencies.some((dependency) => hasPath(byId, from, dependency));
};

const getIndependentPairs = (dag: Readonly<IDecompositionDag>) => {
  const byId = new Map(dag.nodes.map((node) => [node.id, node] as const));
  const pairs: Array<readonly [Readonly<IDecompositionDagNode>, Readonly<IDecompositionDagNode>]> = [];

  dag.nodes.forEach((left, leftIndex) => {
    dag.nodes.slice(leftIndex + 1).forEach((right) => {
      if (!hasPath(byId, left.id, right.id) && !hasPath(byId, right.id, left.id)) {
        pairs.push([left, right] as const);
      }
    });
  });

  return pairs;
};

const deriveParallelism = (
  input: Readonly<IDecompositionInput>,
  dag: Readonly<IDecompositionDag>,
): Readonly<IParallelismDecision> => {
  const dimensions = input.taskAnalysis.data.classification.dimensions;
  const independentPairs = getIndependentPairs(dag);
  const conflictPairs = independentPairs.filter(([left, right]) =>
    intersects(left.writeTargets, right.writeTargets),
  );

  if (conflictPairs.length > 0) {
    return Object.freeze({
      confidence: 'high' as const,
      maxConcurrency: 1,
      mode: 'sequential' as const,
      reasonCodes: Object.freeze(['write-conflict'] as const),
    });
  }

  const reasonCodes = new Set<TParallelismReasonCode>();
  const independent = independentPairs.length > 0;
  const parallelSupported = dimensions.parallelizability === 'high' || dimensions.parallelizability === 'medium';

  if (independent) reasonCodes.add('independent-work-available');
  if (dimensions.uncertainty === 'high') reasonCodes.add('dependency-uncertainty');
  if (dimensions.coupling === 'high') {
    reasonCodes.add('coordination-cost-high');
    reasonCodes.add('integration-cost-high');
  }

  const duplicatedContext = independentPairs.some(([left, right]) =>
    intersects(left.contextRefs, right.contextRefs),
  );
  if (duplicatedContext) reasonCodes.add('duplicated-context');

  if (
    !independent ||
    !parallelSupported ||
    dimensions.uncertainty === 'high' ||
    dimensions.coupling === 'high'
  ) {
    if (!independent) reasonCodes.add('dependency-ordering');
    reasonCodes.add('parallelism-not-beneficial');

    return Object.freeze({
      confidence: dimensions.uncertainty === 'high' ? 'medium' as const : 'high' as const,
      maxConcurrency: 1,
      mode: 'sequential' as const,
      reasonCodes: Object.freeze([...reasonCodes].sort()),
    });
  }

  reasonCodes.add('parallelism-recommended');
  const rootCandidates = dag.nodes.filter(({ dependencies }) => dependencies.length === 0);
  const maxConcurrency = Math.max(2, Math.min(rootCandidates.length, dag.nodes.length));
  const confidence: TTaskConfidence = duplicatedContext ? 'medium' : 'high';

  return Object.freeze({
    confidence,
    maxConcurrency,
    mode: 'parallel' as const,
    reasonCodes: Object.freeze([...reasonCodes].sort()),
  });
};

const createDag = (
  input: Readonly<IDecompositionInput>,
): Readonly<IDecompositionDag> | undefined => {
  if (!input.proposal) return undefined;

  return Object.freeze({
    id: input.proposal.proposalId,
    nodes: Object.freeze(input.proposal.nodes.map<Readonly<IDecompositionDagNode>>((node) =>
      Object.freeze({
        contextRefs: node.contextRefs ?? Object.freeze([]),
        dependencies: node.dependencies,
        goal: node.goal,
        id: node.id,
        outputs: node.outputs,
        ownerRole: node.ownerRole,
        readTargets: node.readTargets,
        readiness: node.dependencies.length === 0 ? 'ready' as const : 'blocked' as const,
        writeTargets: node.writeTargets,
      }),
    )),
  });
};

const createPlan = (
  data: IDecompositionPlanData,
): Readonly<TDecompositionPlan> => Object.freeze({
  data: Object.freeze(data),
  kind: 'execution-plan' as const,
  schemaVersion: DECOMPOSITION_VERSIONS.planSchema,
});

const deriveLimits = (
  input: Readonly<IDecompositionInput>,
  policy: Readonly<IDecompositionPolicyConfig>,
): Readonly<IDecompositionLimits> => {
  const roleLimit = input.source.kind === 'worker'
    ? getAgentRole('worker').childDelegation.maxChildren
    : policy.maxNodes;

  return Object.freeze({
    effectiveMaxNodes: Math.min(policy.maxNodes, roleLimit),
    maxDelegationDepth: policy.maxDelegationDepth,
    maxNodes: policy.maxNodes,
  });
};

export const Decomposition = (
  value: unknown,
  options: IPlanDecompositionOptions = {},
): Readonly<TDecompositionPlan> => {
  const input = validateDecompositionInput(value);
  const policy = validateDecompositionPolicy(options.policy ?? DEFAULT_DECOMPOSITION_POLICY);
  const limits = deriveLimits(input, policy);
  const trigger = input.source.kind;
  const delegationDepth = input.source.kind === 'worker' ? input.source.depth + 1 : 1;
  const reasons = new Set<TDecompositionReasonCode>();
  const confidence = input.taskAnalysis.data.classification.confidence;

  if (input.source.kind === 'strategy' && input.source.strategyDecision.data.planning !== 'decompose') {
    reasons.add('strategy-decomposition-not-requested');
    return createPlan({
      confidence,
      decision: 'not-needed',
      delegationDepth,
      lifecyclePolicy: LIFECYCLE_POLICY,
      limits,
      parallelism: emptyParallelism(),
      policyVersion: DECOMPOSITION_VERSIONS.policy,
      reasonCodes: Object.freeze([...reasons]),
      trigger,
    });
  }

  if (input.source.kind === 'worker') {
    reasons.add('worker-decomposition-requested');
  }

  if (delegationDepth > policy.maxDelegationDepth) {
    reasons.add('delegation-depth-limit');
    return createPlan({
      confidence,
      decision: 'blocked',
      delegationDepth,
      lifecyclePolicy: LIFECYCLE_POLICY,
      limits,
      parallelism: emptyParallelism(),
      policyVersion: DECOMPOSITION_VERSIONS.policy,
      reasonCodes: Object.freeze([...reasons].sort()),
      trigger,
    });
  }

  if (!input.proposal) {
    reasons.add('semantic-proposal-required');
    return createPlan({
      confidence,
      decision: 'proposal-required',
      delegationDepth,
      lifecyclePolicy: LIFECYCLE_POLICY,
      limits,
      parallelism: emptyParallelism(),
      policyVersion: DECOMPOSITION_VERSIONS.policy,
      reasonCodes: Object.freeze([...reasons].sort()),
      trigger,
    });
  }

  if (input.proposal.nodes.length > limits.effectiveMaxNodes) {
    reasons.add('node-limit-exceeded');
    return createPlan({
      confidence,
      decision: 'blocked',
      delegationDepth,
      lifecyclePolicy: LIFECYCLE_POLICY,
      limits,
      parallelism: emptyParallelism(),
      policyVersion: DECOMPOSITION_VERSIONS.policy,
      reasonCodes: Object.freeze([...reasons].sort()),
      trigger,
    });
  }

  if (input.proposal.nodes.length < 2) {
    reasons.add('single-node-no-decomposition');
    return createPlan({
      confidence,
      decision: 'not-needed',
      delegationDepth,
      lifecyclePolicy: LIFECYCLE_POLICY,
      limits,
      parallelism: emptyParallelism(),
      policyVersion: DECOMPOSITION_VERSIONS.policy,
      reasonCodes: Object.freeze([...reasons].sort()),
      trigger,
    });
  }

  const dag = createDag(input);
  if (!dag) {
    throw new Error('Validated decomposition proposal unexpectedly missing');
  }

  reasons.add('decomposition-planned');

  return createPlan({
    confidence,
    dag,
    decision: 'planned',
    delegationDepth,
    lifecyclePolicy: LIFECYCLE_POLICY,
    limits,
    parallelism: deriveParallelism(input, dag),
    policyVersion: DECOMPOSITION_VERSIONS.policy,
    reasonCodes: Object.freeze([...reasons].sort()),
    trigger,
  });
};

export { Decomposition as planDecomposition };
