import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AmyRuntimeError } from '../dist/index.js';

interface ITaskIntelligenceModule {
  TASK_INTELLIGENCE_VERSIONS: {
    analysisSchema: number;
    api: number;
    classificationSchema: number;
    taskContractSchema: number;
  };
  classifyTask(value: unknown): {
    data: {
      classification: {
        confidence: string;
        dimensions: {
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
        };
        evidenceGaps: readonly string[];
        mode: string;
        reasonCodes: readonly string[];
        schemaVersion: number;
      };
      contract: ReturnType<typeof createLocalContract>;
    };
    kind: string;
    schemaVersion: number;
  };
  createTaskIntelligenceCapability(): {
    api: {
      classify(value: unknown): unknown;
      validateContract(value: unknown): unknown;
    };
    descriptor: {
      capabilityContract: number;
      dependencies?: unknown;
      id: string;
      runtimeApi: number;
      version: string;
    };
  };
  validateTaskIntelligenceAnalysis(value: unknown): ReturnType<ITaskIntelligenceModule['classifyTask']>;
  validateTaskContract(value: unknown): {
    affectedScope?: { kind: string; targets?: readonly string[] };
    goal: string;
    kind: string;
    schemaVersion: number;
  };
}

const loadTaskIntelligenceModule = async () =>
  import('../dist/index.js') as Promise<unknown> as Promise<ITaskIntelligenceModule>;

const createLocalContract = () => ({
  acceptanceCriteria: ['Button is disabled for pointer and keyboard input'],
  affectedScope: {
    kind: 'local',
    targets: ['src/components/Button.tsx'],
  },
  constraints: [],
  goal: 'Add a disabled state to Button.',
  kind: 'task-contract',
  nonGoals: [],
  requirements: ['Expose a disabled prop'],
  schemaVersion: 1,
  uncertainties: [],
  verificationExpectations: ['Run relevant unit tests'],
});

describe('TaskIntelligence', () => {
  it('экспортирует независимую versioned capability без Project Intelligence dependency', async () => {
    const module = await loadTaskIntelligenceModule();

    assert.deepEqual(module.TASK_INTELLIGENCE_VERSIONS, {
      analysisSchema: 1,
      api: 1,
      classificationSchema: 1,
      taskContractSchema: 1,
    });

    const capability = module.createTaskIntelligenceCapability();

    assert.equal(capability.descriptor.id, 'amy.task-intelligence');
    assert.equal(capability.descriptor.version, '1.0.0');
    assert.equal(capability.descriptor.dependencies, undefined);
    assert.equal(typeof capability.api.validateContract, 'function');
    assert.equal(typeof capability.api.classify, 'function');
  });

  it('валидирует canonical Task Contract и отклоняет выдуманные поля', async () => {
    const module = await loadTaskIntelligenceModule();
    const contract = module.validateTaskContract(createLocalContract());

    assert.deepEqual(contract, createLocalContract());

    assert.throws(
      () =>
        module.validateTaskContract({
          ...createLocalContract(),
          priorityScore: 0.97,
        }),
      (error: unknown) =>
        error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );

    assert.throws(
      () =>
        module.validateTaskContract({
          ...createLocalContract(),
          affectedScope: {
            kind: 'multi-module',
            targets: ['runtime', 'runtime'],
          },
        }),
      (error: unknown) =>
        error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });

  it('делает дешёвую text-only классификацию без repository research', async () => {
    const module = await loadTaskIntelligenceModule();
    const analysis = module.classifyTask({
      contract: createLocalContract(),
    });

    assert.deepEqual(analysis, {
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
          },
          evidenceGaps: ['novelty', 'project-risk'],
          mode: 'text-only',
          reasonCodes: [
            'acceptance-criteria-present',
            'requirements-present',
            'scope-local',
            'uncertainties-none',
            'verification-explicit',
          ],
          schemaVersion: 1,
        },
        contract: createLocalContract(),
      },
      kind: 'task-analysis',
      schemaVersion: 1,
    });
  });

  it('уточняет risk и blast radius только из явно переданного Project Intelligence evidence', async () => {
    const module = await loadTaskIntelligenceModule();
    const analysis = module.classifyTask({
      contract: {
        acceptanceCriteria: ['API stays compatible', 'Tests pass', 'Build passes'],
        affectedScope: {
          kind: 'multi-module',
          targets: ['runtime.capabilities', 'runtime.config'],
        },
        constraints: ['Preserve backward compatibility'],
        goal: 'Change capability configuration across Runtime modules.',
        kind: 'task-contract',
        nonGoals: [],
        requirements: [
          'Extend capability config',
          'Update validation',
          'Update consumers',
          'Keep optional capabilities fail-open',
        ],
        schemaVersion: 1,
        uncertainties: ['Whether all consumers use the same config path', 'Whether old config files exist'],
        verificationExpectations: ['Run tests', 'Run typecheck', 'Run build'],
      },
      projectEvidence: {
        kind: 'project-intelligence',
        modules: [
          {
            freshnessState: 'stale',
            graphState: 'current',
            moduleId: 'runtime.capabilities',
            risk: 'high',
            riskReasons: ['public-api', 'many-consumers'],
          },
          {
            freshnessState: 'trusted',
            graphState: 'current',
            moduleId: 'runtime.config',
            risk: 'low',
            riskReasons: [],
          },
        ],
      },
    });

    const classification = analysis.data.classification;

    assert.equal(analysis.kind, 'task-analysis');
    assert.equal(classification.mode, 'project-assisted');
    assert.equal(classification.confidence, 'medium');
    assert.deepEqual(classification.dimensions, {
      blastRadius: 'repository',
      complexity: 'high',
      coupling: 'high',
      expectedContextCost: 'high',
      novelty: 'unknown',
      parallelizability: 'unknown',
      risk: 'high',
      scope: 'multi-module',
      uncertainty: 'high',
      verificationCost: 'high',
    });
    assert.deepEqual(classification.evidenceGaps, [
      'novelty',
      'parallel-independence',
      'stale-project-evidence',
    ]);
    assert.deepEqual(classification.reasonCodes, [
      'acceptance-criteria-many',
      'many-consumers',
      'project-evidence-stale',
      'project-risk-high',
      'public-api-impact',
      'requirements-many',
      'scope-multi-module',
      'uncertainties-many',
      'verification-many',
    ]);
  });

  it('валидирует Task Analysis как canonical pipeline input для следующих этапов', async () => {
    const module = await loadTaskIntelligenceModule();
    const analysis = module.classifyTask({ contract: createLocalContract() });

    assert.deepEqual(module.validateTaskIntelligenceAnalysis(analysis), analysis);
    assert.throws(
      () =>
        module.validateTaskIntelligenceAnalysis({
          ...analysis,
          data: {
            ...analysis.data,
            classification: {
              ...analysis.data.classification,
              confidence: 'certain',
            },
          },
        }),
      (error: unknown) =>
        error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });

  it('оставляет неизвестными характеристики, для которых Task Contract не даёт evidence', async () => {
    const module = await loadTaskIntelligenceModule();
    const analysis = module.classifyTask({
      contract: {
        goal: 'Investigate the issue.',
        kind: 'task-contract',
        schemaVersion: 1,
      },
    });

    const classification = analysis.data.classification;

    assert.equal(analysis.kind, 'task-analysis');
    assert.equal(classification.confidence, 'low');
    assert.deepEqual(classification.dimensions, {
      blastRadius: 'unknown',
      complexity: 'low',
      coupling: 'unknown',
      expectedContextCost: 'unknown',
      novelty: 'unknown',
      parallelizability: 'unknown',
      risk: 'unknown',
      scope: 'unknown',
      uncertainty: 'unknown',
      verificationCost: 'unknown',
    });
    assert.deepEqual(classification.evidenceGaps, [
      'affected-scope',
      'novelty',
      'parallel-independence',
      'project-risk',
      'uncertainty',
      'verification',
    ]);
  });
});
