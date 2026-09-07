import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

interface IContextIntelligenceModule {
  CONTEXT_INTELLIGENCE_VERSIONS: {
    api: number;
    packetSchema: number;
    resolutionSchema: number;
  };
  classifyTask(value: unknown): unknown;
  fingerprintProjectIntelligenceKnowledge(value: any): string;
  createContextIntelligenceCapability(options?: { projectIntelligence?: any }): {
    api: {
      resolve(value: unknown): Promise<unknown>;
    };
    descriptor: {
      capabilityContract: number;
      dependencies?: {
        optional?: readonly { id: string; versionMajor: number }[];
      };
      id: string;
      runtimeApi: number;
      version: string;
    };
  };
}

const loadContextIntelligenceModule = async () =>
  import('../dist/index.js') as Promise<unknown> as Promise<IContextIntelligenceModule>;


const createLocalContract = () => ({
  acceptanceCriteria: ['Pointer and keyboard interaction are disabled'],
  affectedScope: {
    kind: 'local',
    targets: ['src/components/Button.tsx'],
  },
  constraints: ['Preserve the public API'],
  goal: 'Add a disabled state to Button.',
  kind: 'task-contract',
  nonGoals: [],
  requirements: ['Expose a disabled prop'],
  schemaVersion: 1,
  uncertainties: [],
  verificationExpectations: ['Run relevant unit tests'],
});

describe('ContextIntelligence', () => {
  it('экспортирует независимую versioned capability с optional Project Intelligence dependency', async () => {
    const module = await loadContextIntelligenceModule();

    assert.deepEqual(module.CONTEXT_INTELLIGENCE_VERSIONS, {
      api: 1,
      packetSchema: 1,
      resolutionSchema: 1,
    });

    const capability = module.createContextIntelligenceCapability();

    assert.equal(capability.descriptor.id, 'amy.context-intelligence');
    assert.equal(capability.descriptor.version, '1.0.0');
    assert.deepEqual(capability.descriptor.dependencies, {
      optional: [{ id: 'amy.project-intelligence', versionMajor: 1 }],
    });
    assert.equal(typeof capability.api.resolve, 'function');
  });

  it('компилирует self-contained local context без repository scan, когда Project Intelligence недоступен', async () => {
    const module = await loadContextIntelligenceModule();
    const taskAnalysis = module.classifyTask({ contract: createLocalContract() });
    const selection = await module.createContextIntelligenceCapability().api.resolve({
      taskAnalysis,
    }) as any;

    assert.equal(selection.kind, 'context-selection');
    assert.equal(selection.schemaVersion, 1);
    assert.deepEqual(selection.data.packet, {
      acceptanceCriteria: ['Pointer and keyboard interaction are disabled'],
      architectureDecisions: [],
      canonicalExamples: [],
      constraints: ['Preserve the public API'],
      dependencies: [],
      goal: 'Add a disabled state to Button.',
      invariants: [],
      likelyAffectedFiles: ['src/components/Button.tsx'],
      modules: [],
      nonGoals: [],
      requirements: ['Expose a disabled prop'],
      schemaVersion: 1,
      specs: [],
      verification: ['Run relevant unit tests'],
    });
    assert.deepEqual(selection.data.resolution, {
      budget: {
        limits: { maxFiles: 4, maxModules: 1, maxSpecItems: 12 },
        profile: 'small',
        truncated: false,
        usage: { files: 1, modules: 0, specItems: 0 },
      },
      confidence: 'medium',
      evidenceGaps: ['project-intelligence'],
      exploration: 'source-read',
      reasonCodes: [
        'explicit-file-target',
        'project-intelligence-unavailable',
        'source-confirmation-required',
      ],
      schemaVersion: 1,
      sourceReads: ['src/components/Button.tsx'],
    });
  });


  it('выбирает trusted module spec и graph impact без автоматического discovery/refresh', async () => {
    const module = await loadContextIntelligenceModule();
    const taskAnalysis = module.classifyTask({
      contract: {
        acceptanceCriteria: ['Disabled state preserves existing Button API'],
        affectedScope: { kind: 'module', targets: ['ui.button'] },
        constraints: ['Preserve backward compatibility'],
        goal: 'Change Button behavior.',
        kind: 'task-contract',
        requirements: ['Update Button behavior'],
        schemaVersion: 1,
        uncertainties: [],
        verificationExpectations: ['Run Button tests'],
      },
    });
    let forbiddenCalls = 0;
    const projectIntelligence = {
      analyzeImpact: async (id: string) => ({
        canonicalExamples: ['src/components/Button/Button.stories.tsx'],
        consumers: [],
        dependencies: ['ui.theme'],
        graphState: 'current',
        moduleId: id,
        ownedSources: ['src/components/Button/Button.tsx'],
        publicApi: ['ButtonProps'],
        relatedModules: [],
        risk: 'medium',
        riskReasons: ['public-api'],
        tests: ['src/components/Button/Button.test.tsx'],
      }),
      assessFreshness: async (owners?: readonly string[]) => ({
        owners: (owners ?? []).map((owner) => ({
          changeKind: 'none',
          changedSources: [],
          owner,
          reasons: [],
          state: 'trusted',
        })),
        state: 'trusted',
      }),
      discover: async () => { forbiddenCalls += 1; return {}; },
      getModule: async () => undefined,
      listModules: async () => [],
      loadGraph: async () => undefined,
      loadKnowledge: async () => ({
        architecture: {
          decisions: ['Components keep stable public contracts'],
          invariants: ['UI state must remain keyboard accessible'],
          kind: 'architecture',
          schemaVersion: 1,
        },
        modules: [{
          decisions: ['disabled is represented by a prop'],
          dependencies: ['ui.theme'],
          examples: ['src/components/Button/Button.stories.tsx'],
          id: 'ui.button',
          invariants: ['disabled blocks interaction'],
          kind: 'module',
          publicContracts: ['ButtonProps'],
          purpose: 'Reusable Button UI component',
          responsibilities: ['Render and handle Button interaction'],
          schemaVersion: 1,
          sourceLocations: ['src/components/Button'],
          specWorthy: {
            confidence: 'high',
            isSpecWorthy: true,
            reasons: ['public-api'],
          },
          testing: ['src/components/Button/Button.test.tsx'],
        }],
        project: { kind: 'project', schemaVersion: 1 },
      }),
      rebuildGraph: async () => { forbiddenCalls += 1; return {}; },
      refreshFreshness: async () => { forbiddenCalls += 1; return {}; },
      resolveSourceLocations: async () => [],
      saveGraph: async () => ({}),
      saveKnowledge: async () => ({}),
      syncAgentsRouter: async () => ({ status: 'unchanged' }),
    };

    const selection = await module.createContextIntelligenceCapability({
      projectIntelligence,
    }).api.resolve({ taskAnalysis }) as any;

    assert.equal(forbiddenCalls, 0);
    assert.deepEqual(selection.data.packet.modules, [{
      freshness: 'trusted',
      graphState: 'current',
      id: 'ui.button',
      relevance: 'primary',
      sourceLocations: ['src/components/Button'],
    }]);
    assert.equal(selection.data.packet.specs[0].moduleId, 'ui.button');
    assert.equal(selection.data.packet.specs[0].purpose, 'Reusable Button UI component');
    assert.deepEqual(selection.data.packet.dependencies, ['ui.theme']);
    assert.deepEqual(selection.data.packet.invariants, [
      'UI state must remain keyboard accessible',
      'disabled blocks interaction',
    ]);
    assert.deepEqual(selection.data.packet.architectureDecisions, [
      'Components keep stable public contracts',
    ]);
    assert.deepEqual(selection.data.packet.canonicalExamples, [
      'src/components/Button/Button.stories.tsx',
    ]);
    assert.deepEqual(selection.data.packet.likelyAffectedFiles, [
      'src/components/Button/Button.test.tsx',
      'src/components/Button/Button.tsx',
      'src/components/Button/Button.stories.tsx',
    ]);
    assert.equal(selection.data.resolution.confidence, 'high');
    assert.equal(selection.data.resolution.exploration, 'none');
    assert.deepEqual(selection.data.resolution.sourceReads, []);
    assert.ok(selection.data.resolution.reasonCodes.includes('module-id-match'));
    assert.ok(selection.data.resolution.reasonCodes.includes('trusted-spec-sufficient'));
  });


  it('переиспользует только trusted context cache и повторно проверяет freshness перед hit', async () => {
    const module = await loadContextIntelligenceModule();
    const taskAnalysis = module.classifyTask({
      contract: {
        affectedScope: { kind: 'module', targets: ['runtime.context'] },
        goal: 'Change context selection.',
        kind: 'task-contract',
        schemaVersion: 1,
        uncertainties: [],
        verificationExpectations: ['Run tests'],
      },
    });
    const knowledge = {
      architecture: { kind: 'architecture', schemaVersion: 1 },
      modules: [{
        id: 'runtime.context',
        kind: 'module',
        purpose: 'Context selection',
        schemaVersion: 1,
        sourceLocations: ['runtime/src/context-intelligence'],
        specWorthy: {
          confidence: 'high',
          isSpecWorthy: true,
          reasons: ['architectural-role'],
        },
      }],
      project: { kind: 'project', schemaVersion: 1 },
    };
    let impactCalls = 0;
    let freshnessCalls = 0;
    const projectIntelligence = {
      analyzeImpact: async (id: string) => {
        impactCalls += 1;
        return {
          canonicalExamples: [],
          consumers: [],
          dependencies: [],
          graphState: 'current',
          moduleId: id,
          ownedSources: ['runtime/src/context-intelligence/context-resolver.ts'],
          publicApi: [],
          relatedModules: [],
          risk: 'low',
          riskReasons: [],
          tests: ['runtime/tests/ContextIntelligence.test.ts'],
        };
      },
      assessFreshness: async (owners?: readonly string[]) => {
        freshnessCalls += 1;
        return {
          owners: (owners ?? []).map((owner) => ({
            changeKind: 'none',
            changedSources: [],
            owner,
            reasons: [],
            state: 'trusted',
          })),
          state: 'trusted',
        };
      },
      discover: async () => ({}),
      getModule: async () => undefined,
      listModules: async () => [],
      loadGraph: async () => ({
        edges: [],
        knowledgeFingerprint: module.fingerprintProjectIntelligenceKnowledge(knowledge),
        nodes: [],
        schemaVersion: 1,
      }),
      loadKnowledge: async () => knowledge,
      rebuildGraph: async () => ({}),
      refreshFreshness: async () => ({}),
      resolveSourceLocations: async () => [],
      saveGraph: async () => ({}),
      saveKnowledge: async () => ({}),
      syncAgentsRouter: async () => ({ status: 'unchanged' }),
    };
    const capability = module.createContextIntelligenceCapability({
      projectIntelligence,
    });

    const first = await capability.api.resolve({ taskAnalysis });
    const second = await capability.api.resolve({ taskAnalysis });

    assert.deepEqual(second, first);
    assert.equal(impactCalls, 1);
    assert.equal(freshnessCalls, 2);
  });



  it('ограничивает semantic spec items фактическим context budget, а не только помечает truncation', async () => {
    const module = await loadContextIntelligenceModule();
    const taskAnalysis = module.classifyTask({
      contract: {
        affectedScope: { kind: 'module', targets: ['dense.module'] },
        goal: 'Change dense module.',
        kind: 'task-contract',
        schemaVersion: 1,
        uncertainties: [],
        verificationExpectations: ['Run tests'],
      },
    });
    const denseModule = {
      decisions: ['d1', 'd2', 'd3', 'd4'],
      dependencies: ['dep1', 'dep2', 'dep3'],
      examples: ['e1', 'e2'],
      id: 'dense.module',
      invariants: ['i1', 'i2', 'i3', 'i4'],
      kind: 'module',
      publicContracts: ['p1', 'p2', 'p3', 'p4'],
      purpose: 'Dense module',
      responsibilities: ['r1', 'r2', 'r3'],
      schemaVersion: 1,
      sourceLocations: ['src/dense'],
      specWorthy: {
        confidence: 'high',
        isSpecWorthy: true,
        reasons: ['public-api'],
      },
      testing: ['t1', 't2'],
    };
    const projectIntelligence = {
      analyzeImpact: async (id: string) => ({
        canonicalExamples: [], consumers: [], dependencies: [], graphState: 'current',
        moduleId: id, ownedSources: ['src/dense/index.ts'], publicApi: [],
        relatedModules: [], risk: 'low', riskReasons: [], tests: [],
      }),
      assessFreshness: async (owners?: readonly string[]) => ({
        owners: (owners ?? []).map((owner) => ({
          changeKind: 'none', changedSources: [], owner, reasons: [], state: 'trusted',
        })),
        state: 'trusted',
      }),
      discover: async () => ({}), getModule: async () => undefined, listModules: async () => [],
      loadGraph: async () => undefined,
      loadKnowledge: async () => ({
        architecture: { kind: 'architecture', schemaVersion: 1 },
        modules: [denseModule],
        project: { kind: 'project', schemaVersion: 1 },
      }),
      rebuildGraph: async () => ({}), refreshFreshness: async () => ({}),
      resolveSourceLocations: async () => [], saveGraph: async () => ({}),
      saveKnowledge: async () => ({}), syncAgentsRouter: async () => ({ status: 'unchanged' }),
    };

    const selection = await module.createContextIntelligenceCapability({
      projectIntelligence,
    }).api.resolve({ budgetProfile: 'small', taskAnalysis }) as any;
    const spec = selection.data.packet.specs[0];
    const actualSpecItems =
      (spec.purpose ? 1 : 0) +
      ['decisions', 'dependencies', 'examples', 'invariants', 'publicContracts', 'responsibilities', 'testing']
        .reduce((total, key) => total + (spec[key]?.length ?? 0), 0);

    assert.equal(selection.data.resolution.budget.limits.maxSpecItems, 12);
    assert.equal(selection.data.resolution.budget.truncated, true);
    assert.equal(selection.data.resolution.budget.usage.specItems, actualSpecItems);
    assert.ok(actualSpecItems <= 12);
    assert.ok(selection.data.resolution.reasonCodes.includes('budget-truncated'));
  });


  it('учитывает architecture semantic items в общем context budget', async () => {
    const module = await loadContextIntelligenceModule();
    const taskAnalysis = module.classifyTask({
      contract: {
        affectedScope: { kind: 'module', targets: ['budgeted.module'] },
        goal: 'Change budgeted module.',
        kind: 'task-contract',
        schemaVersion: 1,
        uncertainties: [],
        verificationExpectations: ['Run tests'],
      },
    });
    const architectureDecisions = Array.from({ length: 8 }, (_, index) => `decision-${index + 1}`);
    const architectureInvariants = Array.from({ length: 8 }, (_, index) => `invariant-${index + 1}`);
    const projectIntelligence = {
      analyzeImpact: async (id: string) => ({
        canonicalExamples: [], consumers: [], dependencies: [], graphState: 'current',
        moduleId: id, ownedSources: ['src/budgeted/index.ts'], publicApi: [],
        relatedModules: [], risk: 'low', riskReasons: [], tests: [],
      }),
      assessFreshness: async (owners?: readonly string[]) => ({
        owners: (owners ?? []).map((owner) => ({
          changeKind: 'none', changedSources: [], owner, reasons: [], state: 'trusted',
        })),
        state: 'trusted',
      }),
      discover: async () => ({}), getModule: async () => undefined, listModules: async () => [],
      loadGraph: async () => undefined,
      loadKnowledge: async () => ({
        architecture: {
          decisions: architectureDecisions,
          invariants: architectureInvariants,
          kind: 'architecture',
          schemaVersion: 1,
        },
        modules: [{
          id: 'budgeted.module', kind: 'module', purpose: 'Budgeted module',
          schemaVersion: 1, sourceLocations: ['src/budgeted'],
          specWorthy: { confidence: 'high', isSpecWorthy: true, reasons: ['architectural-role'] },
        }],
        project: { kind: 'project', schemaVersion: 1 },
      }),
      rebuildGraph: async () => ({}), refreshFreshness: async () => ({}),
      resolveSourceLocations: async () => [], saveGraph: async () => ({}),
      saveKnowledge: async () => ({}), syncAgentsRouter: async () => ({ status: 'unchanged' }),
    };

    const selection = await module.createContextIntelligenceCapability({
      projectIntelligence,
    }).api.resolve({ budgetProfile: 'small', taskAnalysis }) as any;
    const architectureItems =
      selection.data.packet.architectureDecisions.length +
      selection.data.packet.invariants.length;
    const specItems = selection.data.packet.specs.reduce((total: number, spec: any) =>
      total +
      (spec.purpose ? 1 : 0) +
      ['decisions', 'dependencies', 'examples', 'invariants', 'publicContracts', 'responsibilities', 'testing']
        .reduce((count, key) => count + (spec[key]?.length ?? 0), 0), 0);

    assert.ok(architectureItems + specItems <= 12);
    assert.equal(selection.data.resolution.budget.usage.specItems, architectureItems + specItems);
    assert.equal(selection.data.resolution.budget.truncated, true);
    assert.ok(selection.data.resolution.reasonCodes.includes('budget-truncated'));
  });




  it('не требует architecture freshness, если architecture не добавляет semantic context', async () => {
    const module = await loadContextIntelligenceModule();
    const taskAnalysis = module.classifyTask({
      contract: {
        affectedScope: { kind: 'module', targets: ['runtime.context'] },
        goal: 'Change context selection.',
        kind: 'task-contract',
        schemaVersion: 1,
        uncertainties: [],
        verificationExpectations: ['Run tests'],
      },
    });
    const assessedOwners: string[][] = [];
    const projectIntelligence = {
      analyzeImpact: async (id: string) => ({
        canonicalExamples: [], consumers: [], dependencies: [], graphState: 'current',
        moduleId: id, ownedSources: ['runtime/src/context-intelligence/context-resolver.ts'],
        publicApi: [], relatedModules: [], risk: 'low', riskReasons: [],
        tests: ['runtime/tests/ContextIntelligence.test.ts'],
      }),
      assessFreshness: async (owners?: readonly string[]) => {
        assessedOwners.push([...(owners ?? [])]);
        return {
          owners: (owners ?? []).map((owner) => ({
            changeKind: 'none', changedSources: [], owner, reasons: [],
            state: owner === 'architecture' ? 'unknown' : 'trusted',
          })),
          state: 'trusted',
        };
      },
      discover: async () => ({}), getModule: async () => undefined, listModules: async () => [],
      loadGraph: async () => undefined,
      loadKnowledge: async () => ({
        architecture: { kind: 'architecture', schemaVersion: 1 },
        modules: [{
          id: 'runtime.context', kind: 'module', purpose: 'Context selection',
          schemaVersion: 1, sourceLocations: ['runtime/src/context-intelligence'],
          specWorthy: { confidence: 'high', isSpecWorthy: true, reasons: ['architectural-role'] },
        }],
        project: { kind: 'project', schemaVersion: 1 },
      }),
      rebuildGraph: async () => ({}), refreshFreshness: async () => ({}),
      resolveSourceLocations: async () => [], saveGraph: async () => ({}),
      saveKnowledge: async () => ({}), syncAgentsRouter: async () => ({ status: 'unchanged' }),
    };

    const selection = await module.createContextIntelligenceCapability({
      projectIntelligence,
    }).api.resolve({ taskAnalysis }) as any;

    assert.deepEqual(assessedOwners, [['module:runtime.context']]);
    assert.equal(selection.data.resolution.exploration, 'none');
    assert.equal(selection.data.resolution.confidence, 'high');
    assert.ok(selection.data.resolution.reasonCodes.includes('trusted-spec-sufficient'));
  });


  it('не рекомендует Scout, когда unresolved file target уже можно подтвердить targeted source read', async () => {
    const module = await loadContextIntelligenceModule();
    const taskAnalysis = module.classifyTask({ contract: createLocalContract() });
    const projectIntelligence = {
      analyzeImpact: async () => { throw new Error('impact must not run without a matched module'); },
      assessFreshness: async () => { throw new Error('freshness must not run without a matched module'); },
      discover: async () => { throw new Error('discovery must not run'); },
      getModule: async () => undefined, listModules: async () => [], loadGraph: async () => undefined,
      loadKnowledge: async () => ({
        architecture: { kind: 'architecture', schemaVersion: 1 },
        modules: [],
        project: { kind: 'project', schemaVersion: 1 },
      }),
      rebuildGraph: async () => { throw new Error('graph rebuild must not run'); },
      refreshFreshness: async () => { throw new Error('freshness refresh must not run'); },
      resolveSourceLocations: async () => [], saveGraph: async () => ({}),
      saveKnowledge: async () => ({}), syncAgentsRouter: async () => ({ status: 'unchanged' }),
    };

    const selection = await module.createContextIntelligenceCapability({
      projectIntelligence,
    }).api.resolve({ taskAnalysis }) as any;

    assert.equal(selection.data.resolution.exploration, 'source-read');
    assert.deepEqual(selection.data.resolution.sourceReads, ['src/components/Button.tsx']);
    assert.ok(selection.data.resolution.reasonCodes.includes('explicit-file-target'));
    assert.ok(!selection.data.resolution.reasonCodes.includes('scout-recommended'));
  });

});
