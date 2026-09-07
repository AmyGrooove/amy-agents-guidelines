import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AmyRuntimeError,
  STRATEGY_ROUTING_VERSIONS,
  createStrategyRoutingCapability,
  routeStrategy,
  validateStrategyRoutingInput,
} from '../dist/index.js';

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
  options: {
    confidence?: 'high' | 'low' | 'medium';
    evidenceGaps?: readonly string[];
    reasonCodes?: readonly string[];
  } = {},
) => ({
  data: {
    classification: {
      confidence: options.confidence ?? 'high',
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
      evidenceGaps: options.evidenceGaps ?? ['novelty', 'project-risk'],
      mode: 'text-only',
      reasonCodes: options.reasonCodes ?? ['scope-local'],
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

const createContextResolution = (
  overrides: Partial<{
    confidence: 'high' | 'low' | 'medium';
    evidenceGaps: readonly string[];
    exploration: 'none' | 'scout' | 'source-read';
    reasonCodes: readonly string[];
    sourceReads: readonly string[];
  }> = {},
) => ({
  budget: {
    limits: { maxFiles: 8, maxModules: 4, maxSpecItems: 6 },
    profile: 'small',
    truncated: false,
    usage: { files: 1, modules: 0, specItems: 0 },
  },
  confidence: overrides.confidence ?? 'high',
  evidenceGaps: overrides.evidenceGaps ?? [],
  exploration: overrides.exploration ?? 'source-read',
  reasonCodes: overrides.reasonCodes ?? ['explicit-file-target'],
  schemaVersion: 1,
  sourceReads: overrides.sourceReads ?? ['src/Button.tsx'],
});

const createComputeDecision = (
  overrides: Partial<{
    confidence: 'high' | 'low' | 'medium';
    profile: 'ADVANCED' | 'DEEP' | 'EXPERT' | 'FAST' | 'STANDARD';
    status: 'escalated' | 'fallback' | 'mapped' | 'unavailable' | 'unmapped';
  }> = {},
) => ({
  assignment: { status: overrides.status ?? 'unmapped' },
  confidence: overrides.confidence ?? 'high',
  profile: overrides.profile ?? 'FAST',
  reasonCodes: ['lightweight-task'],
  schemaVersion: 1,
  target: { kind: 'task' },
});

describe('StrategyRouting', () => {
  it('экспортирует независимую deterministic capability и versioned policy', () => {
    assert.deepEqual(STRATEGY_ROUTING_VERSIONS, {
      api: 1,
      decisionSchema: 1,
      policy: 1,
    });

    const capability = createStrategyRoutingCapability();

    assert.equal(capability.descriptor.id, 'amy.strategy-routing');
    assert.equal(capability.descriptor.version, '1.0.0');
    assert.equal(capability.descriptor.dependencies, undefined);
    assert.equal(typeof capability.api.route, 'function');
  });

  it('оставляет тривиальную local задачу на Fast Path даже при targeted source read', () => {
    const decision = routeStrategy({
      computeDecision: createComputeDecision(),
      contextResolution: createContextResolution(),
      taskAnalysis: createTaskAnalysis(),
    });

    assert.deepEqual(decision, {
      data: {
        computeProfile: 'FAST',
        confidence: 'high',
        escalation: 'none',
        execution: 'direct',
        exploration: 'source-read',
        fastPath: true,
        planning: 'none',
        policyVersion: 1,
        reasonCodes: [
          'compute-profile-provided',
          'context-source-read-required',
          'direct-execution',
          'fast-path',
        ],
        review: 'none',
        verification: 'none',
      },
      kind: 'execution-strategy',
      schemaVersion: 1,
    });
  });

  it('активирует Scout только при concrete context signal и не навязывает Worker', () => {
    const decision = routeStrategy({
      contextResolution: createContextResolution({
        confidence: 'low',
        evidenceGaps: ['scope-target'],
        exploration: 'scout',
        reasonCodes: ['scout-recommended', 'unresolved-scope-target'],
        sourceReads: [],
      }),
      taskAnalysis: createTaskAnalysis(),
    });

    assert.equal(decision.data.fastPath, false);
    assert.equal(decision.data.exploration, 'scout');
    assert.equal(decision.data.execution, 'direct');
    assert.equal(decision.data.confidence, 'low');
    assert.ok(decision.data.reasonCodes.includes('context-scout-required'));
    assert.equal(decision.data.reasonCodes.includes('worker-recommended'), false);
  });

  it('выбирает decomposition, Worker, Verifier и Reviewer только для сложной risk-heavy задачи', () => {
    const decision = routeStrategy({
      computeDecision: createComputeDecision({ profile: 'DEEP' }),
      contextResolution: createContextResolution({
        exploration: 'none',
        reasonCodes: ['trusted-spec-sufficient'],
        sourceReads: [],
      }),
      taskAnalysis: createTaskAnalysis(
        {
          blastRadius: 'repository',
          complexity: 'high',
          coupling: 'high',
          expectedContextCost: 'high',
          parallelizability: 'medium',
          risk: 'high',
          scope: 'multi-module',
          uncertainty: 'medium',
          verificationCost: 'high',
        },
        {
          evidenceGaps: [],
          reasonCodes: ['public-api-impact', 'scope-multi-module'],
        },
      ),
    });

    assert.equal(decision.data.fastPath, false);
    assert.equal(decision.data.planning, 'decompose');
    assert.equal(decision.data.execution, 'worker');
    assert.equal(decision.data.verification, 'verifier');
    assert.equal(decision.data.review, 'reviewer');
    assert.equal(decision.data.computeProfile, 'DEEP');
    assert.deepEqual(decision.data.reasonCodes, [
      'compute-profile-provided',
      'decomposition-recommended',
      'reviewer-risk-justified',
      'verifier-risk-justified',
      'worker-recommended',
    ]);
  });

  it('не трактует исчерпанный Compute Router fallback как успех', () => {
    const decision = routeStrategy({
      computeDecision: createComputeDecision({
        profile: 'EXPERT',
        status: 'unavailable',
      }),
      taskAnalysis: createTaskAnalysis(),
    });

    assert.equal(decision.data.fastPath, false);
    assert.equal(decision.data.escalation, 'compute');
    assert.equal(decision.data.confidence, 'low');
    assert.ok(decision.data.reasonCodes.includes('compute-unavailable'));
  });

  it('использует low-confidence Task Analysis для bounded Scout fallback только без Context Resolution', () => {
    const decision = routeStrategy({
      taskAnalysis: createTaskAnalysis({}, {
        confidence: 'low',
        evidenceGaps: ['affected-scope', 'project-risk'],
      }),
    });

    assert.equal(decision.data.exploration, 'scout');
    assert.equal(decision.data.confidence, 'low');
    assert.ok(decision.data.reasonCodes.includes('low-task-confidence'));
  });

  it('принимает canonical task target id и всё равно отвергает DAG-node decision', () => {
    const computeDecision = {
      ...createComputeDecision(),
      target: { id: 'task-42', kind: 'task' },
    };

    const decision = routeStrategy({
      computeDecision,
      taskAnalysis: createTaskAnalysis(),
    });

    assert.equal(decision.data.computeProfile, 'FAST');
  });

  it('валидирует только canonical task-level routing evidence и отклоняет неизвестные поля', () => {
    const valid = validateStrategyRoutingInput({
      contextResolution: createContextResolution(),
      taskAnalysis: createTaskAnalysis(),
    });

    assert.equal(valid.contextResolution?.schemaVersion, 1);

    assert.throws(
      () =>
        routeStrategy({
          taskAnalysis: createTaskAnalysis(),
          orchestratorPrompt: 'do everything',
        }),
      (error: unknown) =>
        error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );

    assert.throws(
      () =>
        routeStrategy({
          computeDecision: {
            ...createComputeDecision(),
            target: { id: 'verify-1', kind: 'dag-node' },
          },
          taskAnalysis: createTaskAnalysis(),
        }),
      (error: unknown) =>
        error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });
});
