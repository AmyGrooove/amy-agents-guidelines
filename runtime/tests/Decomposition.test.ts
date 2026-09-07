import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AmyRuntimeError,
  DECOMPOSITION_VERSIONS,
  createDecompositionCapability,
  planDecomposition,
} from '../dist/index.js';

const createTaskAnalysis = (
  overrides: Partial<{
    coupling: 'high' | 'low' | 'medium' | 'unknown';
    parallelizability: 'high' | 'low' | 'medium' | 'unknown';
    scope: 'local' | 'module' | 'multi-module' | 'repository' | 'unknown';
    uncertainty: 'high' | 'low' | 'medium' | 'unknown';
  }> = {},
) => ({
  data: {
    classification: {
      confidence: 'high',
      dimensions: {
        blastRadius: 'multi-module',
        complexity: 'high',
        coupling: overrides.coupling ?? 'medium',
        expectedContextCost: 'high',
        novelty: 'medium',
        parallelizability: overrides.parallelizability ?? 'high',
        risk: 'medium',
        scope: overrides.scope ?? 'multi-module',
        uncertainty: overrides.uncertainty ?? 'medium',
        verificationCost: 'medium',
      },
      evidenceGaps: [],
      mode: 'text-only',
      reasonCodes: ['scope-multi-module'],
      schemaVersion: 1,
    },
    contract: {
      acceptanceCriteria: ['Runtime API remains backward compatible.'],
      affectedScope: {
        kind: overrides.scope ?? 'multi-module',
        targets: ['runtime/src/a', 'runtime/src/b'],
      },
      constraints: ['Keep optional capabilities optional.'],
      goal: 'Implement a bounded multi-module change.',
      kind: 'task-contract',
      requirements: ['Change module A.', 'Change module B.'],
      schemaVersion: 1,
      uncertainties: [],
      verificationExpectations: ['Run tests.'],
    },
  },
  kind: 'task-analysis',
  schemaVersion: 1,
});

const createStrategyDecision = (planning: 'decompose' | 'none' | 'plan' = 'decompose') => ({
  data: {
    confidence: 'high',
    escalation: 'none',
    execution: planning === 'decompose' ? 'worker' : 'direct',
    exploration: 'none',
    fastPath: false,
    planning,
    policyVersion: 1,
    reasonCodes: planning === 'decompose'
      ? ['decomposition-recommended', 'worker-recommended']
      : ['direct-execution'],
    review: 'none',
    verification: 'none',
  },
  kind: 'execution-strategy',
  schemaVersion: 1,
});

const createProposal = () => ({
  kind: 'decomposition-proposal',
  proposalId: 'task-42:plan-1',
  schemaVersion: 1,
  nodes: [
    {
      contextRefs: ['spec:shared', 'module:a'],
      dependencies: [],
      goal: 'Implement module A.',
      id: 'a',
      outputs: ['artifact:a'],
      ownerRole: 'worker',
      readTargets: ['runtime/src/a'],
      writeTargets: ['runtime/src/a'],
    },
    {
      contextRefs: ['spec:shared', 'module:b'],
      dependencies: [],
      goal: 'Implement module B.',
      id: 'b',
      outputs: ['artifact:b'],
      ownerRole: 'worker',
      readTargets: ['runtime/src/b'],
      writeTargets: ['runtime/src/b'],
    },
    {
      contextRefs: ['spec:shared'],
      dependencies: ['a', 'b'],
      goal: 'Integrate module changes.',
      id: 'integrate',
      outputs: ['artifact:integrated'],
      ownerRole: 'worker',
      readTargets: ['runtime/src/a', 'runtime/src/b'],
      writeTargets: ['runtime/src/index.ts'],
    },
  ],
});

const createWorkerHandoff = () => ({
  acceptanceCriteria: ['Child results are integrated.'],
  constraints: ['Stay inside delegated scope.'],
  expectedOutputs: ['implementation-result'],
  goal: 'Own the parent implementation subtask.',
  handoffId: 'worker-parent',
  inputs: [{ kind: 'task-analysis', ref: 'task-analysis:42' }],
  kind: 'agent-handoff',
  nonGoals: [],
  requirements: ['Implement the parent subtask.'],
  schemaVersion: 1,
  scope: {
    readTargets: ['runtime/src'],
    writeTargets: ['runtime/src'],
  },
  source: { kind: 'orchestrator' },
  targetRole: 'worker',
});

describe('Decomposition', () => {
  it('экспортирует independent deterministic capability и bounded default policy', () => {
    assert.deepEqual(DECOMPOSITION_VERSIONS, {
      api: 1,
      planSchema: 1,
      policy: 1,
      proposalSchema: 1,
    });

    const capability = createDecompositionCapability();

    assert.equal(capability.descriptor.id, 'amy.decomposition');
    assert.equal(capability.descriptor.version, '1.0.0');
    assert.equal(capability.descriptor.dependencies, undefined);
    assert.equal(typeof capability.api.plan, 'function');
  });

  it('не декомпозирует задачу без Stage 8 signal и не требует semantic proposal', () => {
    const plan = planDecomposition({
      source: {
        kind: 'strategy',
        strategyDecision: createStrategyDecision('none'),
      },
      taskAnalysis: createTaskAnalysis(),
    });

    assert.equal(plan.kind, 'execution-plan');
    assert.equal(plan.data.decision, 'not-needed');
    assert.equal(plan.data.dag, undefined);
    assert.equal(plan.data.parallelism.maxConcurrency, 0);
    assert.deepEqual(plan.data.reasonCodes, ['strategy-decomposition-not-requested']);
  });

  it('не выдумывает semantic subtasks и явно запрашивает proposal для decompose signal', () => {
    const plan = planDecomposition({
      source: {
        kind: 'strategy',
        strategyDecision: createStrategyDecision(),
      },
      taskAnalysis: createTaskAnalysis(),
    });

    assert.equal(plan.data.decision, 'proposal-required');
    assert.equal(plan.data.dag, undefined);
    assert.ok(plan.data.reasonCodes.includes('semantic-proposal-required'));
  });

  it('строит canonical DAG с ownership, readiness, lifecycle policy и useful parallelism', () => {
    const plan = planDecomposition({
      proposal: createProposal(),
      source: {
        kind: 'strategy',
        strategyDecision: createStrategyDecision(),
      },
      taskAnalysis: createTaskAnalysis(),
    });

    assert.equal(plan.data.decision, 'planned');
    assert.equal(plan.data.delegationDepth, 1);
    assert.deepEqual(plan.data.limits, {
      effectiveMaxNodes: 3,
      maxDelegationDepth: 2,
      maxNodes: 3,
    });
    assert.deepEqual(plan.data.lifecyclePolicy, {
      cancellation: 'cascade-dependents',
      failure: 'block-dependents',
      replanning: 'allowed',
    });
    assert.deepEqual(plan.data.dag, {
      id: 'task-42:plan-1',
      nodes: [
        {
          contextRefs: ['module:a', 'spec:shared'],
          dependencies: [],
          goal: 'Implement module A.',
          id: 'a',
          outputs: ['artifact:a'],
          ownerRole: 'worker',
          readTargets: ['runtime/src/a'],
          readiness: 'ready',
          writeTargets: ['runtime/src/a'],
        },
        {
          contextRefs: ['module:b', 'spec:shared'],
          dependencies: [],
          goal: 'Implement module B.',
          id: 'b',
          outputs: ['artifact:b'],
          ownerRole: 'worker',
          readTargets: ['runtime/src/b'],
          readiness: 'ready',
          writeTargets: ['runtime/src/b'],
        },
        {
          contextRefs: ['spec:shared'],
          dependencies: ['a', 'b'],
          goal: 'Integrate module changes.',
          id: 'integrate',
          outputs: ['artifact:integrated'],
          ownerRole: 'worker',
          readTargets: ['runtime/src/a', 'runtime/src/b'],
          readiness: 'blocked',
          writeTargets: ['runtime/src/index.ts'],
        },
      ],
    });
    assert.deepEqual(plan.data.parallelism, {
      confidence: 'medium',
      maxConcurrency: 2,
      mode: 'parallel',
      reasonCodes: [
        'duplicated-context',
        'independent-work-available',
        'parallelism-recommended',
      ],
    });
  });

  it('учитывает coordination и integration cost proxy при high coupling', () => {
    const plan = planDecomposition({
      proposal: createProposal(),
      source: {
        kind: 'strategy',
        strategyDecision: createStrategyDecision(),
      },
      taskAnalysis: createTaskAnalysis({ coupling: 'high' }),
    });

    assert.equal(plan.data.parallelism.mode, 'sequential');
    assert.ok(plan.data.parallelism.reasonCodes.includes('coordination-cost-high'));
    assert.ok(plan.data.parallelism.reasonCodes.includes('integration-cost-high'));
  });

  it('сохраняет DAG, но отключает parallelism при write conflict', () => {
    const proposal = createProposal();
    const plan = planDecomposition({
      proposal: {
        ...proposal,
        nodes: proposal.nodes.map((node) =>
          node.id === 'b'
            ? { ...node, writeTargets: ['runtime/src/a'] }
            : node,
        ),
      },
      source: {
        kind: 'strategy',
        strategyDecision: createStrategyDecision(),
      },
      taskAnalysis: createTaskAnalysis(),
    });

    assert.equal(plan.data.decision, 'planned');
    assert.deepEqual(plan.data.parallelism, {
      confidence: 'high',
      maxConcurrency: 1,
      mode: 'sequential',
      reasonCodes: ['write-conflict'],
    });
  });

  it('разрешает Worker обнаружить decomposition после старта, но пересекает global cap с role-local delegation policy', () => {
    const capability = createDecompositionCapability({
      policy: { maxDelegationDepth: 2, maxNodes: 3 },
    });
    const proposal = createProposal();
    const plan = capability.api.plan({
      proposal: {
        ...proposal,
        nodes: proposal.nodes.slice(0, 2),
      },
      source: {
        depth: 1,
        handoff: createWorkerHandoff(),
        kind: 'worker',
      },
      taskAnalysis: createTaskAnalysis(),
    });

    assert.equal(plan.data.decision, 'planned');
    assert.equal(plan.data.delegationDepth, 2);
    assert.deepEqual(plan.data.limits, {
      effectiveMaxNodes: 2,
      maxDelegationDepth: 2,
      maxNodes: 3,
    });

    const blocked = capability.api.plan({
      proposal: {
        ...proposal,
        nodes: proposal.nodes.slice(0, 2),
      },
      source: {
        depth: 2,
        handoff: createWorkerHandoff(),
        kind: 'worker',
      },
      taskAnalysis: createTaskAnalysis(),
    });

    assert.equal(blocked.data.decision, 'blocked');
    assert.ok(blocked.data.reasonCodes.includes('delegation-depth-limit'));
  });

  it('блокирует proposal сверх hard cap вместо agent explosion', () => {
    const proposal = createProposal();
    const plan = createDecompositionCapability({
      policy: { maxDelegationDepth: 2, maxNodes: 2 },
    }).api.plan({
      proposal,
      source: {
        kind: 'strategy',
        strategyDecision: createStrategyDecision(),
      },
      taskAnalysis: createTaskAnalysis(),
    });

    assert.equal(plan.data.decision, 'blocked');
    assert.equal(plan.data.dag, undefined);
    assert.ok(plan.data.reasonCodes.includes('node-limit-exceeded'));
  });

  it('отклоняет malformed DAG proposal: unknown dependency, cycle и recovery-only role', () => {
    const common = {
      source: {
        kind: 'strategy' as const,
        strategyDecision: createStrategyDecision(),
      },
      taskAnalysis: createTaskAnalysis(),
    };
    const proposal = createProposal();

    assert.throws(
      () => planDecomposition({
        ...common,
        proposal: {
          ...proposal,
          nodes: proposal.nodes.map((node) =>
            node.id === 'integrate'
              ? { ...node, dependencies: ['missing'] }
              : node,
          ),
        },
      }),
      (error: unknown) => error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );

    assert.throws(
      () => planDecomposition({
        ...common,
        proposal: {
          ...proposal,
          nodes: proposal.nodes.map((node) => {
            if (node.id === 'a') return { ...node, dependencies: ['integrate'] };
            return node;
          }),
        },
      }),
      (error: unknown) => error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );

    assert.throws(
      () => planDecomposition({
        ...common,
        proposal: {
          ...proposal,
          nodes: proposal.nodes.map((node) =>
            node.id === 'a'
              ? { ...node, ownerRole: 'debugger' }
              : node,
          ),
        },
      }),
      (error: unknown) => error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });
});
