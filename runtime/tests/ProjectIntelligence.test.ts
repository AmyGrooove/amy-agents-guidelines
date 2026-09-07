import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import {
  AmyRuntimeError,
  createAmyRuntime,
} from '../dist/index.js';

interface IModuleCandidate {
  id: string;
  signals: readonly string[];
  sourceLocations: readonly string[];
}

interface IProjectDiscovery {
  agentsInstructions: readonly string[];
  configurations: readonly string[];
  documentation: readonly string[];
  manifests: readonly string[];
  moduleCandidates: readonly IModuleCandidate[];
  projectRoot: string;
}

interface IProjectIntelligenceApi {
  analyzeImpact(moduleId: string): Promise<{
    canonicalExamples: readonly string[];
    consumers: readonly string[];
    dependencies: readonly string[];
    graphState: string;
    moduleId: string;
    ownedSources: readonly string[];
    publicApi: readonly string[];
    relatedModules: readonly string[];
    risk: string;
    riskReasons: readonly string[];
    tests: readonly string[];
  }>;
  assessFreshness(owners?: readonly string[]): Promise<{
    owners: readonly {
      changeKind: string;
      changedSources: readonly { path: string; role: string }[];
      owner: string;
      reasons: readonly string[];
      state: string;
    }[];
    state: string;
  }>;
  discover(): Promise<IProjectDiscovery>;
  getModule(id: string): Promise<unknown>;
  listModules(): Promise<readonly { id: string }[]>;
  loadGraph(): Promise<unknown>;
  loadKnowledge(): Promise<unknown>;
  rebuildGraph(): Promise<{
    edges: readonly { from: string; relation: string; to: string }[];
    knowledgeFingerprint: string;
    nodes: readonly {
      id: string;
      kind: string;
      label?: string;
      moduleId?: string;
      owner?: string;
      path?: string;
      semanticRole?: string;
    }[];
    schemaVersion: number;
  }>;
  refreshFreshness(owners?: readonly string[]): Promise<unknown>;
  resolveSourceLocations(id?: string): Promise<readonly string[]>;
  saveGraph(value: unknown): Promise<unknown>;
  saveKnowledge(value: unknown): Promise<unknown>;
  syncAgentsRouter(): Promise<{ reason?: string; status: string }>;
}

interface IProjectIntelligenceCapability {
  api: IProjectIntelligenceApi;
  descriptor: {
    capabilityContract: number;
    id: string;
    runtimeApi: number;
    version: string;
  };
}

interface IProjectIntelligenceModule {
  PROJECT_INTELLIGENCE_VERSIONS: {
    api: number;
    artifactSchema: number;
    freshnessSchema: number;
    graphSchema: number;
  };
  createProjectIntelligenceCapability(
    projectRoot: string,
  ): IProjectIntelligenceCapability;
  validateSpecWorthinessDecision(value: unknown): {
    confidence: string;
    isSpecWorthy: boolean;
    reasons: readonly string[];
  };
}

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'amy-project-intelligence-'));

  temporaryDirectories.push(directory);

  return directory;
};

const loadProjectIntelligenceModule = async () =>
  import('../dist/index.js') as Promise<unknown> as Promise<IProjectIntelligenceModule>;

const createKnowledge = () => ({
  architecture: {
    components: ['runtime', 'skills'],
    dependencyDirection: ['skills -> Runtime public API'],
    invariants: ['Runtime remains optional'],
    kind: 'architecture',
    schemaVersion: 1,
  },
  modules: [
    {
      id: 'runtime.capabilities',
      kind: 'module',
      purpose: 'Register and resolve optional capabilities.',
      responsibilities: ['Capability resolution'],
      schemaVersion: 1,
      sourceLocations: ['runtime/src/capabilities'],
      specWorthy: {
        confidence: 'high',
        isSpecWorthy: true,
        reasons: ['public-api', 'architectural-role'],
      },
    },
    {
      id: 'skills.react',
      kind: 'module',
      schemaVersion: 1,
      sourceLocations: ['skills/develop-react-component'],
      specWorthy: {
        confidence: 'medium',
        isSpecWorthy: true,
        reasons: ['reused'],
      },
    },
  ],
  project: {
    entryPoints: ['runtime/src/index.ts'],
    kind: 'project',
    modules: ['runtime.capabilities', 'skills.react'],
    purpose: 'Provide development standards and optional agent runtime.',
    schemaVersion: 1,
    sourceOfTruth: ['runtime/src', 'skills'],
    technologies: ['TypeScript', 'Node.js'],
  },
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe('ProjectIntelligence', () => {
  it('экспортирует независимую versioned capability', async () => {
    const module = await loadProjectIntelligenceModule();

    assert.equal(typeof module.createProjectIntelligenceCapability, 'function');
    assert.deepEqual(module.PROJECT_INTELLIGENCE_VERSIONS, {
      api: 1,
      artifactSchema: 1,
      freshnessSchema: 1,
      graphSchema: 1,
    });

    const projectRoot = await createTemporaryDirectory();
    const capability = module.createProjectIntelligenceCapability(projectRoot);

    assert.equal(capability.descriptor.id, 'amy.project-intelligence');
    assert.equal(capability.descriptor.version, '1.1.0');
  });

  it('валидирует объяснимое yes/no spec-worthy решение отдельно от module spec', async () => {
    const module = await loadProjectIntelligenceModule();

    assert.deepEqual(
      module.validateSpecWorthinessDecision({
        confidence: 'low',
        isSpecWorthy: false,
        reasons: ['domain-responsibility'],
      }),
      {
        confidence: 'low',
        isSpecWorthy: false,
        reasons: ['domain-responsibility'],
      },
    );
  });

  it('обнаруживает project root и дешёвые сигналы module candidates', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();

    await mkdir(join(projectRoot, '.git'));
    await mkdir(join(projectRoot, 'src', 'accounts'), { recursive: true });
    await mkdir(join(projectRoot, 'src', 'users'), { recursive: true });
    await mkdir(join(projectRoot, 'src', 'internal'), { recursive: true });
    await mkdir(join(projectRoot, 'packages', 'api'), { recursive: true });
    await mkdir(join(projectRoot, 'services', 'worker', 'src', 'jobs'), {
      recursive: true,
    });
    await writeFile(
      join(projectRoot, 'package.json'),
      JSON.stringify({ name: 'fixture', workspaces: ['packages/*'] }),
      'utf8',
    );
    await writeFile(
      join(projectRoot, 'packages', 'api', 'package.json'),
      JSON.stringify({ name: '@fixture/api' }),
      'utf8',
    );
    await writeFile(join(projectRoot, 'tsconfig.json'), '{}', 'utf8');
    await writeFile(join(projectRoot, 'README.md'), '# Fixture', 'utf8');
    await writeFile(join(projectRoot, 'AGENTS.md'), '# Instructions', 'utf8');
    await writeFile(join(projectRoot, 'src', 'accounts', 'index.ts'), '', 'utf8');
    await writeFile(join(projectRoot, 'src', 'users', 'users.module.ts'), '', 'utf8');
    await writeFile(
      join(projectRoot, 'services', 'worker', 'src', 'jobs', 'index.ts'),
      '',
      'utf8',
    );

    const capability = module.createProjectIntelligenceCapability(
      join(projectRoot, 'src', 'accounts'),
    );
    const discovery = await capability.api.discover();

    assert.equal(discovery.projectRoot, projectRoot);
    assert.deepEqual(discovery.manifests, [
      'package.json',
      'packages/api/package.json',
    ]);
    assert.deepEqual(discovery.configurations, ['tsconfig.json']);
    assert.deepEqual(discovery.documentation, ['README.md']);
    assert.deepEqual(discovery.agentsInstructions, ['AGENTS.md']);
    assert.deepEqual(
      discovery.moduleCandidates.map(({ id }) => id),
      [
        'packages.api',
        'services.worker.src.jobs',
        'src.accounts',
        'src.internal',
        'src.users',
      ],
    );
    assert.deepEqual(
      discovery.moduleCandidates.find(({ id }) => id === 'src.accounts')
        ?.signals,
      ['public-entrypoint', 'source-boundary'],
    );
    assert.deepEqual(
      discovery.moduleCandidates.find(({ id }) => id === 'src.users')
        ?.signals,
      ['framework-convention', 'source-boundary'],
    );
  });

  it('поддерживает пустой project без искусственных module candidates', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const discovery = await module
      .createProjectIntelligenceCapability(projectRoot)
      .api.discover();

    assert.equal(discovery.projectRoot, projectRoot);
    assert.deepEqual(discovery.manifests, []);
    assert.deepEqual(discovery.moduleCandidates, []);
  });

  it('сохраняет, загружает и индексирует canonical knowledge', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const api = module.createProjectIntelligenceCapability(projectRoot).api;
    const knowledge = createKnowledge();
    const saved = await api.saveKnowledge(knowledge);
    const loaded = await api.loadKnowledge();

    assert.deepEqual(saved, knowledge);
    assert.deepEqual(loaded, knowledge);
    assert.equal(Object.isFrozen(loaded), true);
    assert.deepEqual(await api.listModules(), [
      { id: 'runtime.capabilities' },
      { id: 'skills.react' },
    ]);
    assert.deepEqual(
      await api.getModule('runtime.capabilities'),
      knowledge.modules[0],
    );
    assert.equal(await api.getModule('missing'), undefined);

    const index = JSON.parse(
      await readFile(
        join(projectRoot, '.amy', 'project-intelligence', 'index.json'),
        'utf8',
      ),
    ) as unknown;

    assert.deepEqual(index, {
      architecture: 'architecture.json',
      modules: [
        { id: 'runtime.capabilities', path: 'modules/runtime.capabilities.json' },
        { id: 'skills.react', path: 'modules/skills.react.json' },
      ],
      project: 'project.json',
      schemaVersion: 1,
    });
  });

  it('создаёт deterministic artifacts и удаляет только прежние indexed specs', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const api = module.createProjectIntelligenceCapability(projectRoot).api;
    const knowledge = createKnowledge();

    await api.saveKnowledge(knowledge);
    const artifactRoot = join(projectRoot, '.amy', 'project-intelligence');
    const firstIndex = await readFile(join(artifactRoot, 'index.json'), 'utf8');

    await writeFile(join(artifactRoot, 'modules', 'human-note.json'), '{}', 'utf8');
    await api.saveKnowledge({
      ...knowledge,
      modules: [knowledge.modules[0]],
    });

    const secondIndex = await readFile(join(artifactRoot, 'index.json'), 'utf8');

    assert.notEqual(firstIndex, secondIndex);
    await assert.rejects(
      readFile(join(artifactRoot, 'modules', 'skills.react.json'), 'utf8'),
      (error: unknown) =>
        error instanceof Error && 'code' in error && error.code === 'ENOENT',
    );
    assert.equal(
      await readFile(join(artifactRoot, 'modules', 'human-note.json'), 'utf8'),
      '{}',
    );

    await api.saveKnowledge({
      ...knowledge,
      modules: [knowledge.modules[0]],
    });
    assert.equal(
      await readFile(join(artifactRoot, 'index.json'), 'utf8'),
      secondIndex,
    );
  });

  it('принимает честно неполное knowledge и отклоняет выдуманные поля', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const api = module.createProjectIntelligenceCapability(projectRoot).api;

    await api.saveKnowledge({
      architecture: { kind: 'architecture', schemaVersion: 1 },
      modules: [],
      project: { kind: 'project', schemaVersion: 1 },
    });

    await assert.rejects(
      api.saveKnowledge({
        architecture: { kind: 'architecture', schemaVersion: 1 },
        modules: [],
        project: {
          invented: true,
          kind: 'project',
          schemaVersion: 1,
        },
      }),
      (error: unknown) =>
        error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });

  it('валидирует schema, module ids, reason codes и project-relative paths', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const api = module.createProjectIntelligenceCapability(projectRoot).api;
    const invalidValues = [
      {
        ...createKnowledge(),
        project: { kind: 'project', schemaVersion: 2 },
      },
      {
        ...createKnowledge(),
        modules: [
          {
            ...createKnowledge().modules[0],
            id: '../outside',
          },
        ],
      },
      {
        ...createKnowledge(),
        modules: [
          {
            ...createKnowledge().modules[0],
            sourceLocations: ['../outside'],
          },
        ],
      },
      {
        ...createKnowledge(),
        modules: [
          {
            ...createKnowledge().modules[0],
            specWorthy: {
              confidence: 'high',
              isSpecWorthy: true,
              reasons: ['score-99'],
            },
          },
        ],
      },
      {
        ...createKnowledge(),
        modules: [
          {
            ...createKnowledge().modules[0],
            specWorthy: {
              confidence: 'high',
              isSpecWorthy: false,
              reasons: ['architectural-role'],
            },
          },
        ],
      },
      {
        ...createKnowledge(),
        modules: [
          {
            ...createKnowledge().modules[0],
            specWorthy: {
              confidence: 'high',
              isSpecWorthy: true,
              reasons: [],
            },
          },
        ],
      },
      {
        ...createKnowledge(),
        modules: [
          {
            ...createKnowledge().modules[0],
            sourceLocations: [],
          },
        ],
      },
    ];

    for (const value of invalidValues) {
      await assert.rejects(
        api.saveKnowledge(value),
        (error: unknown) =>
          error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
      );
    }
  });

  it('отклоняет malformed canonical artifacts при загрузке', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const api = module.createProjectIntelligenceCapability(projectRoot).api;

    await api.saveKnowledge(createKnowledge());
    await writeFile(
      join(projectRoot, '.amy', 'project-intelligence', 'project.json'),
      '{',
      'utf8',
    );

    await assert.rejects(
      api.loadKnowledge(),
      (error: unknown) =>
        error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });

  it('разрешает только подтверждённые source locations внутри project root', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const api = module.createProjectIntelligenceCapability(projectRoot).api;
    const knowledge = createKnowledge();

    await api.saveKnowledge(knowledge);

    assert.deepEqual(await api.resolveSourceLocations(), [
      join(projectRoot, 'runtime', 'src'),
      join(projectRoot, 'skills'),
      join(projectRoot, 'runtime', 'src', 'index.ts'),
    ]);
    assert.deepEqual(await api.resolveSourceLocations('runtime.capabilities'), [
      join(projectRoot, 'runtime', 'src', 'capabilities'),
    ]);
    assert.deepEqual(await api.resolveSourceLocations('missing'), []);
  });

  it('нормализует Windows separators в canonical project-relative paths', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const api = module.createProjectIntelligenceCapability(projectRoot).api;
    const knowledge = createKnowledge();
    const firstModule = knowledge.modules[0];

    assert.ok(firstModule);
    firstModule.sourceLocations = ['runtime\\src\\capabilities'];
    await api.saveKnowledge(knowledge);

    assert.deepEqual(await api.getModule('runtime.capabilities'), {
      ...firstModule,
      sourceLocations: ['runtime/src/capabilities'],
    });
  });

  it('строит lightweight graph из canonical knowledge и даёт explainable impact analysis', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const api = module.createProjectIntelligenceCapability(projectRoot).api;
    const knowledge = createKnowledge();
    const capabilitiesModule = knowledge.modules[0];
    const reactModule = knowledge.modules[1];

    assert.ok(capabilitiesModule);
    assert.ok(reactModule);
    Object.assign(capabilitiesModule, {
      dependencies: ['skills.react'],
      examples: ['runtime/src/index.ts'],
      publicContracts: ['IProjectIntelligenceApi'],
      testing: ['runtime/tests/ProjectIntelligence.test.ts'],
    });
    Object.assign(reactModule, {
      consumers: ['runtime.capabilities'],
    });

    await api.saveKnowledge(knowledge);
    const graph = await api.rebuildGraph();

    assert.equal(graph.schemaVersion, 1);
    assert.match(graph.knowledgeFingerprint, /^[a-f0-9]{64}$/);
    assert.ok(
      graph.nodes.some(
        ({ id, kind, moduleId }) =>
          id === 'module:runtime.capabilities' &&
          kind === 'module' &&
          moduleId === 'runtime.capabilities',
      ),
    );
    assert.ok(
      graph.edges.some(
        ({ from, relation, to }) =>
          from === 'module:runtime.capabilities' &&
          relation === 'depends_on' &&
          to === 'module:skills.react',
      ),
    );

    const impact = await api.analyzeImpact('runtime.capabilities');

    assert.equal(impact.graphState, 'current');
    assert.deepEqual(impact.dependencies, ['skills.react']);
    assert.deepEqual(impact.consumers, []);
    assert.deepEqual(impact.publicApi, ['IProjectIntelligenceApi']);
    assert.deepEqual(impact.tests, ['runtime/tests/ProjectIntelligence.test.ts']);
    assert.deepEqual(impact.canonicalExamples, ['runtime/src/index.ts']);
    assert.deepEqual(impact.ownedSources, ['runtime/src/capabilities']);
    assert.equal(impact.risk, 'high');
    assert.ok(impact.riskReasons.includes('public-api'));
  });

  it('валидирует custom graph, dangling edges и knowledge freshness', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const api = module.createProjectIntelligenceCapability(projectRoot).api;

    await api.saveKnowledge(createKnowledge());
    const graph = await api.rebuildGraph();
    const architectureSource = {
      id: 'source:architecture-reference',
      kind: 'source',
      owner: 'architecture',
      path: 'docs/architecture.md',
      semanticRole: 'architecture',
    };

    await api.saveGraph({
      ...graph,
      edges: [
        ...graph.edges,
        {
          from: 'architecture',
          relation: 'owns',
          to: architectureSource.id,
        },
      ],
      nodes: [...graph.nodes, architectureSource],
    });

    assert.ok(await api.loadGraph());
    await assert.rejects(
      api.saveGraph({
        ...graph,
        edges: [
          ...graph.edges,
          { from: 'module:missing', relation: 'depends_on', to: 'project' },
        ],
      }),
      (error: unknown) =>
        error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );

    await api.saveKnowledge({
      ...createKnowledge(),
      project: { ...createKnowledge().project, purpose: 'Changed purpose' },
    });
    const staleImpact = await api.analyzeImpact('runtime.capabilities');

    assert.equal(staleImpact.graphState, 'stale');
    assert.equal(staleImpact.risk, 'unknown');
    assert.deepEqual(staleImpact.riskReasons, ['graph-stale']);
  });

  it('фиксирует fingerprints и отличает implementation drift от contract drift', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const api = module.createProjectIntelligenceCapability(projectRoot).api;
    const knowledge = createKnowledge();
    const capabilitiesModule = knowledge.modules[0];

    assert.ok(capabilitiesModule);
    Object.assign(capabilitiesModule, {
      sourceOfTruth: ['runtime/src/index.ts'],
    });
    await mkdir(join(projectRoot, 'runtime', 'src', 'capabilities'), {
      recursive: true,
    });
    await writeFile(
      join(projectRoot, 'runtime', 'src', 'capabilities', 'registry.ts'),
      'export const registry = 1;\n',
      'utf8',
    );
    await writeFile(
      join(projectRoot, 'runtime', 'src', 'index.ts'),
      'export const api = 1;\n',
      'utf8',
    );
    await api.saveKnowledge(knowledge);

    assert.deepEqual(await api.assessFreshness(['module:runtime.capabilities']), {
      owners: [
        {
          changeKind: 'unknown',
          changedSources: [],
          owner: 'module:runtime.capabilities',
          reasons: ['baseline-missing'],
          state: 'unknown',
        },
      ],
      state: 'unknown',
    });

    await api.refreshFreshness(['module:runtime.capabilities']);
    const trusted = await api.assessFreshness([
      'module:runtime.capabilities',
    ]);

    assert.equal(trusted.state, 'trusted');
    assert.equal(trusted.owners[0]?.changeKind, 'none');

    await writeFile(
      join(projectRoot, 'runtime', 'src', 'capabilities', 'registry.ts'),
      'export const registry = 2;\n',
      'utf8',
    );
    const implementationDrift = await api.assessFreshness([
      'module:runtime.capabilities',
    ]);

    assert.equal(implementationDrift.state, 'trusted');
    assert.equal(implementationDrift.owners[0]?.changeKind, 'implementation');
    assert.deepEqual(implementationDrift.owners[0]?.reasons, [
      'implementation-drift',
    ]);

    await api.refreshFreshness(['module:runtime.capabilities']);
    await writeFile(
      join(projectRoot, 'runtime', 'src', 'index.ts'),
      'export const api = 2;\n',
      'utf8',
    );
    const contractDrift = await api.assessFreshness([
      'module:runtime.capabilities',
    ]);

    assert.equal(contractDrift.state, 'stale');
    assert.equal(contractDrift.owners[0]?.changeKind, 'contract');
    assert.deepEqual(contractDrift.owners[0]?.reasons, ['contract-drift']);
    assert.deepEqual(
      contractDrift.owners[0]?.changedSources.map(({ path, role }) => ({
        path,
        role,
      })),
      [{ path: 'runtime/src/index.ts', role: 'contract' }],
    );
  });

  it('поддерживает selective refresh и architecture drift через graph metadata', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const api = module.createProjectIntelligenceCapability(projectRoot).api;

    await mkdir(join(projectRoot, 'docs'), { recursive: true });
    await writeFile(
      join(projectRoot, 'docs', 'architecture.md'),
      '# Architecture v1\n',
      'utf8',
    );
    await api.saveKnowledge({
      ...createKnowledge(),
      project: { kind: 'project', schemaVersion: 1 },
    });
    const graph = await api.rebuildGraph();
    const architectureSource = {
      id: 'source:architecture-reference',
      kind: 'source',
      owner: 'architecture',
      path: 'docs/architecture.md',
      semanticRole: 'architecture',
    };

    await api.saveGraph({
      ...graph,
      edges: [
        ...graph.edges,
        {
          from: 'architecture',
          relation: 'owns',
          to: architectureSource.id,
        },
      ],
      nodes: [...graph.nodes, architectureSource],
    });
    await api.refreshFreshness(['architecture', 'project']);
    await writeFile(
      join(projectRoot, 'docs', 'architecture.md'),
      '# Architecture v2\n',
      'utf8',
    );

    const beforeRefresh = await api.assessFreshness(['architecture', 'project']);

    assert.equal(beforeRefresh.state, 'stale');
    assert.equal(beforeRefresh.owners[0]?.owner, 'architecture');
    assert.equal(beforeRefresh.owners[0]?.changeKind, 'architecture');
    assert.equal(beforeRefresh.owners[0]?.state, 'stale');

    await api.refreshFreshness(['architecture']);
    const afterRefresh = await api.assessFreshness(['architecture', 'project']);

    assert.equal(afterRefresh.state, 'unknown');
    assert.equal(afterRefresh.owners[0]?.state, 'trusted');
    assert.equal(afterRefresh.owners[1]?.state, 'unknown');
    assert.deepEqual(afterRefresh.owners[1]?.reasons, ['no-sources']);
  });

  it('добавляет idempotent router, сохраняя existing AGENTS instructions', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const agentsPath = join(projectRoot, 'AGENTS.md');
    const api = module.createProjectIntelligenceCapability(projectRoot).api;

    await writeFile(agentsPath, '# Human rules\n\nNever overwrite me.\n', 'utf8');
    await api.saveKnowledge(createKnowledge());

    assert.deepEqual(await api.syncAgentsRouter(), { status: 'updated' });
    const firstContent = await readFile(agentsPath, 'utf8');

    assert.match(firstContent, /^# Human rules\n\nNever overwrite me\./);
    assert.match(firstContent, /\.amy\/project-intelligence\/index\.json/);
    assert.deepEqual(await api.syncAgentsRouter(), { status: 'unchanged' });
    assert.equal(await readFile(agentsPath, 'utf8'), firstContent);
  });

  it('создаёт root AGENTS router и отказывается менять malformed managed block', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const agentsPath = join(projectRoot, 'AGENTS.md');
    const api = module.createProjectIntelligenceCapability(projectRoot).api;

    await api.saveKnowledge(createKnowledge());
    assert.deepEqual(await api.syncAgentsRouter(), { status: 'created' });

    await writeFile(
      agentsPath,
      '# Human rules\n\n<!-- amy-project-intelligence:start -->\nBroken block.\n',
      'utf8',
    );

    assert.deepEqual(await api.syncAgentsRouter(), {
      reason: 'malformed-managed-block',
      status: 'refused',
    });
    assert.equal(
      await readFile(agentsPath, 'utf8'),
      '# Human rules\n\n<!-- amy-project-intelligence:start -->\nBroken block.\n',
    );
  });

  it('остаётся explicit и не ломает Runtime при отсутствии или disabled capability', async () => {
    const module = await loadProjectIntelligenceModule();
    const projectRoot = await createTemporaryDirectory();
    const homeDirectory = await createTemporaryDirectory();
    const runtimeWithoutCapability = await createAmyRuntime({
      homeDirectory,
      projectRoot,
    });

    assert.deepEqual(
      runtimeWithoutCapability.capabilities.list().map(({ id }) => id),
      ['amy.plugin-inventory'],
    );

    const runtimeWithDisabledCapability = await createAmyRuntime({
      capabilities: [module.createProjectIntelligenceCapability(projectRoot)],
      homeDirectory,
      overrides: {
        capabilities: {
          'amy.project-intelligence': { enabled: false },
        },
      },
      projectRoot,
    });

    await runtimeWithDisabledCapability.start();

    assert.equal(
      (
        await runtimeWithDisabledCapability.resolveOptional(
          'amy.project-intelligence',
        )
      ).status,
      'disabled',
    );
  });
});
