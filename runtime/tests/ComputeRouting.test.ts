import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AmyRuntimeError } from '../dist/index.js';

interface IComputeRoutingModule {
  COMPUTE_ROUTING_VERSIONS: {
    api: number;
    decisionSchema: number;
  };
  createComputeRoutingCapability(options?: {
    config?: unknown;
  }): {
    api: {
      route(value: unknown): unknown;
    };
    descriptor: {
      capabilityContract: number;
      dependencies?: unknown;
      id: string;
      runtimeApi: number;
      version: string;
    };
  };
  routeCompute(value: unknown, options?: { config?: unknown }): {
    assignment: {
      model?: string;
      reasoningEffort?: string;
      status: string;
    };
    confidence: string;
    profile: string;
    reasonCodes: readonly string[];
    schemaVersion: number;
    target: { id?: string; kind: string };
  };
}

const loadComputeRoutingModule = async () =>
  import('../dist/index.js') as Promise<unknown> as Promise<IComputeRoutingModule>;

const createTaskAnalysis = (
  dimensions: Partial<{
    blastRadius: string;
    complexity: string;
    coupling: string;
    expectedContextCost: string;
    novelty: string;
    parallelizability: string;
    risk: string;
    scope: string;
    uncertainty: string;
    verificationCost: string;
  }> = {},
) => ({
  data: {
    classification: {
      confidence: 'medium',
      dimensions: {
        blastRadius: 'local',
        complexity: 'low',
        coupling: 'low',
        expectedContextCost: 'low',
        novelty: 'unknown',
        parallelizability: 'low',
        risk: 'unknown',
        scope: 'local',
        uncertainty: 'low',
        verificationCost: 'low',
        ...dimensions,
      },
      evidenceGaps: ['novelty', 'project-risk'],
      mode: 'text-only',
      reasonCodes: ['scope-local'],
      schemaVersion: 1,
    },
    contract: {
      affectedScope: { kind: 'local', targets: ['src/Button.tsx'] },
      goal: 'Add disabled state.',
      kind: 'task-contract',
      schemaVersion: 1,
      uncertainties: [],
      verificationExpectations: ['Run tests'],
    },
  },
  kind: 'task-analysis',
  schemaVersion: 1,
});

describe('ComputeRouting', () => {
  it('экспортирует независимую deterministic capability без Agent Roles dependency', async () => {
    const module = await loadComputeRoutingModule();

    assert.deepEqual(module.COMPUTE_ROUTING_VERSIONS, {
      api: 1,
      decisionSchema: 1,
    });

    const capability = module.createComputeRoutingCapability();

    assert.equal(capability.descriptor.id, 'amy.compute-routing');
    assert.equal(capability.descriptor.version, '1.0.0');
    assert.equal(capability.descriptor.dependencies, undefined);
    assert.equal(typeof capability.api.route, 'function');
  });

  it('выбирает минимальный достаточный logical profile без обязательной concrete model', async () => {
    const module = await loadComputeRoutingModule();
    const decision = module.routeCompute({
      taskAnalysis: createTaskAnalysis(),
    });

    assert.deepEqual(decision, {
      assignment: { status: 'unmapped' },
      confidence: 'medium',
      profile: 'FAST',
      reasonCodes: ['lightweight-task'],
      schemaVersion: 1,
      target: { kind: 'task' },
    });
  });

  it('повышает compute для тяжёлой задачи и не смешивает profile с role', async () => {
    const module = await loadComputeRoutingModule();
    const decision = module.routeCompute({
      target: { id: 'node-verify-api', kind: 'dag-node' },
      taskAnalysis: createTaskAnalysis({
        blastRadius: 'repository',
        complexity: 'high',
        coupling: 'high',
        expectedContextCost: 'high',
        risk: 'high',
        scope: 'multi-module',
        uncertainty: 'high',
        verificationCost: 'high',
      }),
    });

    assert.equal(decision.profile, 'DEEP');
    assert.deepEqual(decision.target, {
      id: 'node-verify-api',
      kind: 'dag-node',
    });
    assert.ok(decision.reasonCodes.includes('heavy-task'));
    assert.equal('role' in decision, false);
  });

  it('использует configured default profile только когда task signals не задают более точный минимум', async () => {
    const module = await loadComputeRoutingModule();
    const decision = module.routeCompute(
      {
        taskAnalysis: createTaskAnalysis({
          blastRadius: 'module',
          complexity: 'medium',
          coupling: 'medium',
          scope: 'module',
          uncertainty: 'medium',
          verificationCost: 'medium',
        }),
      },
      { config: { defaultProfile: 'ADVANCED' } },
    );

    assert.equal(decision.profile, 'ADVANCED');
    assert.ok(decision.reasonCodes.includes('default-profile'));
  });

  it('поддерживает явные upgrade и downgrade в ограниченной escalation ladder', async () => {
    const module = await loadComputeRoutingModule();
    const upgraded = module.routeCompute({
      currentProfile: 'STANDARD',
      mode: 'upgrade',
      taskAnalysis: createTaskAnalysis(),
    });
    const downgraded = module.routeCompute({
      currentProfile: 'DEEP',
      mode: 'downgrade',
      taskAnalysis: createTaskAnalysis(),
    });

    assert.equal(upgraded.profile, 'ADVANCED');
    assert.ok(upgraded.reasonCodes.includes('profile-upgraded'));
    assert.equal(downgraded.profile, 'ADVANCED');
    assert.ok(downgraded.reasonCodes.includes('profile-downgraded'));
  });

  it('использует configured model fallback, затем повышает profile только при недоступности required compute', async () => {
    const module = await loadComputeRoutingModule();
    const config = {
      defaultProfile: 'STANDARD',
      profiles: {
        ADVANCED: {
          fallbackModels: ['advanced-backup'],
          model: 'advanced-primary',
          reasoningEffort: 'high',
        },
        DEEP: {
          model: 'deep-model',
          reasoningEffort: 'xhigh',
        },
      },
    };
    const analysis = createTaskAnalysis({
      complexity: 'high',
      scope: 'module',
      uncertainty: 'medium',
    });
    const fallbackDecision = module.routeCompute(
      {
        taskAnalysis: analysis,
        unavailableModels: ['advanced-primary'],
      },
      { config },
    );
    const escalatedDecision = module.routeCompute(
      {
        taskAnalysis: analysis,
        unavailableModels: ['advanced-primary', 'advanced-backup'],
      },
      { config },
    );

    assert.deepEqual(fallbackDecision.assignment, {
      model: 'advanced-backup',
      reasoningEffort: 'high',
      status: 'fallback',
    });
    assert.equal(fallbackDecision.profile, 'ADVANCED');
    assert.ok(fallbackDecision.reasonCodes.includes('model-fallback'));

    assert.deepEqual(escalatedDecision.assignment, {
      model: 'deep-model',
      reasoningEffort: 'xhigh',
      status: 'escalated',
    });
    assert.equal(escalatedDecision.profile, 'DEEP');
    assert.ok(escalatedDecision.reasonCodes.includes('model-unavailable'));
    assert.ok(escalatedDecision.reasonCodes.includes('profile-escalated'));
  });

  it('возвращает unavailable вместо опасного автоматического downgrade, если ladder исчерпан', async () => {
    const module = await loadComputeRoutingModule();
    const decision = module.routeCompute(
      {
        requestedProfile: 'EXPERT',
        taskAnalysis: createTaskAnalysis(),
        unavailableModels: ['expert-model'],
      },
      {
        config: {
          profiles: {
            EXPERT: { model: 'expert-model', reasoningEffort: 'xhigh' },
          },
        },
      },
    );

    assert.equal(decision.profile, 'EXPERT');
    assert.deepEqual(decision.assignment, { status: 'unavailable' });
    assert.ok(decision.reasonCodes.includes('model-unavailable'));
  });

  it('отклоняет fallback/reasoning binding без primary model', async () => {
    const module = await loadComputeRoutingModule();

    assert.throws(
      () =>
        module.routeCompute(
          { taskAnalysis: createTaskAnalysis() },
          {
            config: {
              profiles: {
                FAST: { fallbackModels: ['backup-only'] },
              },
            },
          },
        ),
      (error: unknown) =>
        error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });

  it('валидирует routing input и отклоняет неизвестные поля', async () => {
    const module = await loadComputeRoutingModule();

    assert.throws(
      () =>
        module.routeCompute({
          taskAnalysis: createTaskAnalysis(),
          role: 'worker',
        }),
      (error: unknown) =>
        error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });
});
