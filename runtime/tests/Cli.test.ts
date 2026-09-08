import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, it } from 'node:test';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cliPath = join(pluginRoot, 'runtime', 'dist', 'cli.js');
const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'amy-cli-'));

  temporaryDirectories.push(directory);

  return directory;
};

const runCli = (args: readonly string[], cwd = pluginRoot) =>
  spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
  });

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe('Cli', () => {
  it('возвращает status для текущего project root', async () => {
    const projectRoot = await createTemporaryDirectory();
    const result = runCli(['status', '--plugin', pluginRoot], projectRoot);

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      lifecycle: 'started',
      runtimeId: JSON.parse(result.stdout).runtimeId,
    });
  });

  it('выводит capabilities, inventory и итоговую config', async () => {
    const projectRoot = await createTemporaryDirectory();
    const commonArgs = [
      '--project',
      projectRoot,
      '--plugin',
      pluginRoot,
    ];
    const capabilities = runCli(['capabilities', ...commonArgs]);
    const inventory = runCli(['inventory', ...commonArgs]);
    const config = runCli(['config', ...commonArgs]);

    assert.equal(capabilities.status, 0, capabilities.stderr);
    assert.deepEqual(
      JSON.parse(capabilities.stdout).map(({ id }: { id: string }) => id),
      ['amy.plugin-inventory'],
    );
    assert.equal(inventory.status, 0, inventory.stderr);
    assert.equal(JSON.parse(inventory.stdout).plugin.name, 'amy-agents-guidelines');
    assert.equal(config.status, 0, config.stderr);
    assert.deepEqual(JSON.parse(config.stdout), {
      capabilities: {},
      schemaVersion: 1,
    });
  });

  it('возвращает стабильный код для неизвестной команды', () => {
    const result = runCli(['unknown']);

    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stderr).code, 'VALIDATION_FAILURE');
  });

  it('возвращает стабильный код для невалидной конфигурации', async () => {
    const projectRoot = await createTemporaryDirectory();

    await mkdir(join(projectRoot, '.amy'));
    await writeFile(join(projectRoot, '.amy', 'config.json'), '{}', 'utf8');

    const result = runCli([
      'config',
      '--project',
      projectRoot,
      '--plugin',
      pluginRoot,
    ]);

    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stderr).code, 'INVALID_CONFIGURATION');
  });

  it('проводит Project Intelligence pipeline только через явные команды', async () => {
    const projectRoot = await createTemporaryDirectory();
    const inputPath = join(projectRoot, 'knowledge.json');
    const knowledge = {
      architecture: { kind: 'architecture', schemaVersion: 1 },
      modules: [],
      project: {
        kind: 'project',
        purpose: 'CLI fixture',
        schemaVersion: 1,
      },
    };

    await writeFile(inputPath, JSON.stringify(knowledge), 'utf8');

    const commonArgs = ['--project', projectRoot, '--plugin', pluginRoot];
    const discovery = runCli(['intelligence-discover', ...commonArgs]);
    const save = runCli([
      'intelligence-save',
      '--input',
      inputPath,
      ...commonArgs,
    ]);
    const show = runCli(['intelligence-show', ...commonArgs]);
    const router = runCli(['intelligence-sync-router', ...commonArgs]);

    assert.equal(discovery.status, 0, discovery.stderr);
    assert.equal(JSON.parse(discovery.stdout).projectRoot, projectRoot);
    assert.equal(save.status, 0, save.stderr);
    assert.deepEqual(JSON.parse(save.stdout), knowledge);
    assert.equal(show.status, 0, show.stderr);
    assert.deepEqual(JSON.parse(show.stdout), knowledge);
    assert.equal(router.status, 0, router.stderr);
    assert.deepEqual(JSON.parse(router.stdout), { status: 'created' });
  });

  it('явно управляет graph, freshness и impact без включения capability по умолчанию', async () => {
    const projectRoot = await createTemporaryDirectory();
    const inputPath = join(projectRoot, 'knowledge.json');
    const sourceRoot = join(projectRoot, 'runtime', 'src', 'capabilities');
    const knowledge = {
      architecture: { kind: 'architecture', schemaVersion: 1 },
      modules: [
        {
          id: 'runtime.capabilities',
          kind: 'module',
          publicContracts: ['CapabilityRegistry'],
          schemaVersion: 1,
          sourceLocations: ['runtime/src/capabilities'],
          specWorthy: {
            confidence: 'high',
            isSpecWorthy: true,
            reasons: ['public-api'],
          },
        },
      ],
      project: { kind: 'project', schemaVersion: 1 },
    };

    await mkdir(sourceRoot, { recursive: true });
    await writeFile(join(sourceRoot, 'index.ts'), 'export {};\n', 'utf8');
    await writeFile(inputPath, JSON.stringify(knowledge), 'utf8');

    const commonArgs = ['--project', projectRoot, '--plugin', pluginRoot];
    const save = runCli([
      'intelligence-save',
      '--input',
      inputPath,
      ...commonArgs,
    ]);
    const graph = runCli(['intelligence-graph-build', ...commonArgs]);
    const refresh = runCli([
      'intelligence-freshness-refresh',
      '--owner',
      'module:runtime.capabilities',
      ...commonArgs,
    ]);
    const freshness = runCli([
      'intelligence-freshness-show',
      '--owner',
      'module:runtime.capabilities',
      ...commonArgs,
    ]);
    const impact = runCli([
      'intelligence-impact',
      '--module',
      'runtime.capabilities',
      ...commonArgs,
    ]);

    assert.equal(save.status, 0, save.stderr);
    assert.equal(graph.status, 0, graph.stderr);
    assert.equal(JSON.parse(graph.stdout).schemaVersion, 1);
    assert.equal(refresh.status, 0, refresh.stderr);
    assert.equal(freshness.status, 0, freshness.stderr);
    assert.equal(JSON.parse(freshness.stdout).state, 'trusted');
    assert.equal(impact.status, 0, impact.stderr);
    assert.equal(JSON.parse(impact.stdout).moduleId, 'runtime.capabilities');
    assert.equal(JSON.parse(impact.stdout).risk, 'high');
  });

  it('валидирует и классифицирует Task Contract только через явные task-команды', async () => {
    const projectRoot = await createTemporaryDirectory();
    const contractPath = join(projectRoot, 'task-contract.json');
    const classificationPath = join(projectRoot, 'task-classification.json');
    const contract = {
      affectedScope: { kind: 'local', targets: ['src/Button.tsx'] },
      goal: 'Add disabled state.',
      kind: 'task-contract',
      schemaVersion: 1,
      uncertainties: [],
      verificationExpectations: ['Run tests'],
    };

    await writeFile(contractPath, JSON.stringify(contract), 'utf8');
    await writeFile(
      classificationPath,
      JSON.stringify({ contract }),
      'utf8',
    );

    const commonArgs = ['--project', projectRoot, '--plugin', pluginRoot];
    const validated = runCli([
      'task-contract-validate',
      '--input',
      contractPath,
      ...commonArgs,
    ]);
    const classified = runCli([
      'task-classify',
      '--input',
      classificationPath,
      ...commonArgs,
    ]);

    assert.equal(validated.status, 0, validated.stderr);
    assert.deepEqual(JSON.parse(validated.stdout), contract);
    assert.equal(classified.status, 0, classified.stderr);
    assert.equal(JSON.parse(classified.stdout).kind, 'task-analysis');
    assert.equal(
      JSON.parse(classified.stdout).data.classification.mode,
      'text-only',
    );
  });


  it('резолвит Context Packet только через явную context-команду', async () => {
    const projectRoot = await createTemporaryDirectory();
    const classificationInputPath = join(projectRoot, 'task-classification.json');
    const contextInputPath = join(projectRoot, 'context-input.json');
    const contract = {
      affectedScope: { kind: 'local', targets: ['src/Button.tsx'] },
      goal: 'Add disabled state.',
      kind: 'task-contract',
      schemaVersion: 1,
      uncertainties: [],
      verificationExpectations: ['Run tests'],
    };

    await writeFile(
      classificationInputPath,
      JSON.stringify({ contract }),
      'utf8',
    );

    const commonArgs = ['--project', projectRoot, '--plugin', pluginRoot];
    const classified = runCli([
      'task-classify',
      '--input',
      classificationInputPath,
      ...commonArgs,
    ]);

    assert.equal(classified.status, 0, classified.stderr);
    await writeFile(
      contextInputPath,
      JSON.stringify({ taskAnalysis: JSON.parse(classified.stdout) }),
      'utf8',
    );

    const context = runCli([
      'context-resolve',
      '--input',
      contextInputPath,
      ...commonArgs,
    ]);

    assert.equal(context.status, 0, context.stderr);
    const selection = JSON.parse(context.stdout);
    assert.equal(selection.kind, 'context-selection');
    assert.equal(selection.data.packet.goal, 'Add disabled state.');
    assert.deepEqual(selection.data.packet.likelyAffectedFiles, ['src/Button.tsx']);
    assert.equal(selection.data.resolution.exploration, 'source-read');
    assert.ok(selection.data.resolution.reasonCodes.includes('project-knowledge-missing'));
  });

  it('маршрутизирует compute явно через CLI и использует project model mapping', async () => {
    const projectRoot = await createTemporaryDirectory();
    const inputPath = join(projectRoot, 'compute-input.json');
    const configRoot = join(projectRoot, '.amy');
    const taskAnalysis = {
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
    };

    await mkdir(configRoot, { recursive: true });
    await writeFile(
      join(configRoot, 'config.json'),
      JSON.stringify({
        capabilities: {},
        compute: {
          profiles: {
            FAST: { model: 'fast-model', reasoningEffort: 'low' },
          },
        },
        schemaVersion: 1,
      }),
      'utf8',
    );
    await writeFile(inputPath, JSON.stringify({ taskAnalysis }), 'utf8');

    const result = runCli([
      'compute-route',
      '--input',
      inputPath,
      '--project',
      projectRoot,
      '--plugin',
      pluginRoot,
    ]);

    assert.equal(result.status, 0, result.stderr);
    const decision = JSON.parse(result.stdout);
    assert.equal(decision.profile, 'FAST');
    assert.deepEqual(decision.assignment, {
      model: 'fast-model',
      reasoningEffort: 'low',
      status: 'mapped',
    });
  });

  it('маршрутизирует execution strategy явно через CLI без default capability registration', async () => {
    const projectRoot = await createTemporaryDirectory();
    const inputPath = join(projectRoot, 'strategy-input.json');
    const taskAnalysis = {
      data: {
        classification: {
          confidence: 'high',
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
    };

    await writeFile(inputPath, JSON.stringify({ taskAnalysis }), 'utf8');

    const result = runCli([
      'strategy-route',
      '--input',
      inputPath,
      '--project',
      projectRoot,
      '--plugin',
      pluginRoot,
    ]);

    assert.equal(result.status, 0, result.stderr);
    const decision = JSON.parse(result.stdout);
    assert.equal(decision.kind, 'execution-strategy');
    assert.equal(decision.data.fastPath, true);
    assert.equal(decision.data.execution, 'direct');
    assert.deepEqual(decision.data.reasonCodes, ['direct-execution', 'fast-path']);
  });

  it('строит decomposition plan только через явную CLI command', async () => {
    const projectRoot = await createTemporaryDirectory();
    const inputPath = join(projectRoot, 'decomposition-input.json');
    const input = {
      proposal: {
        kind: 'decomposition-proposal',
        proposalId: 'cli-plan',
        schemaVersion: 1,
        nodes: [
          { dependencies: [], goal: 'Implement A.', id: 'a', outputs: ['a'], ownerRole: 'worker', readTargets: ['src/a'], writeTargets: ['src/a'] },
          { dependencies: [], goal: 'Implement B.', id: 'b', outputs: ['b'], ownerRole: 'worker', readTargets: ['src/b'], writeTargets: ['src/b'] },
        ],
      },
      source: {
        kind: 'strategy',
        strategyDecision: {
          data: {
            confidence: 'high', escalation: 'none', execution: 'worker', exploration: 'none', fastPath: false,
            planning: 'decompose', policyVersion: 1, reasonCodes: ['decomposition-recommended', 'worker-recommended'],
            review: 'none', verification: 'none',
          },
          kind: 'execution-strategy', schemaVersion: 1,
        },
      },
      taskAnalysis: {
        data: {
          classification: {
            confidence: 'high',
            dimensions: {
              blastRadius: 'multi-module', complexity: 'high', coupling: 'medium', expectedContextCost: 'high', novelty: 'medium',
              parallelizability: 'high', risk: 'medium', scope: 'multi-module', uncertainty: 'medium', verificationCost: 'medium',
            },
            evidenceGaps: [], mode: 'text-only', reasonCodes: ['scope-multi-module'], schemaVersion: 1,
          },
          contract: {
            affectedScope: { kind: 'multi-module', targets: ['src/a', 'src/b'] },
            goal: 'Implement A and B.', kind: 'task-contract', schemaVersion: 1, uncertainties: [], verificationExpectations: ['Run tests'],
          },
        },
        kind: 'task-analysis', schemaVersion: 1,
      },
    };

    await writeFile(inputPath, JSON.stringify(input), 'utf8');

    const result = runCli([
      'decomposition-plan', '--input', inputPath, '--project', projectRoot, '--plugin', pluginRoot,
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).kind, 'execution-plan');
    assert.equal(JSON.parse(result.stdout).data.decision, 'planned');
  });

  it('оценивает verification evidence только через явную CLI command', async () => {
    const projectRoot = await createTemporaryDirectory();
    const inputPath = join(projectRoot, 'verification-input.json');
    const input = {
      artifacts: {
        implementationResultRef: 'artifact:implementation',
        taskAnalysisRef: 'artifact:task-analysis',
      },
      mechanicalChecks: [{
        evidenceRefs: ['evidence:tests'],
        id: 'tests',
        kind: 'test',
        label: 'Runtime tests',
        status: 'passed',
      }],
      strategyDecision: {
        data: {
          confidence: 'high', escalation: 'none', execution: 'direct', exploration: 'none', fastPath: false,
          planning: 'none', policyVersion: 1, reasonCodes: ['direct-execution'], review: 'none', verification: 'none',
        },
        kind: 'execution-strategy', schemaVersion: 1,
      },
      taskAnalysis: {
        data: {
          classification: {
            confidence: 'high',
            dimensions: {
              blastRadius: 'local', complexity: 'low', coupling: 'low', expectedContextCost: 'low', novelty: 'unknown',
              parallelizability: 'low', risk: 'unknown', scope: 'local', uncertainty: 'low', verificationCost: 'low',
            },
            evidenceGaps: ['novelty', 'project-risk'], mode: 'text-only', reasonCodes: ['scope-local'], schemaVersion: 1,
          },
          contract: {
            affectedScope: { kind: 'local', targets: ['src/Button.tsx'] }, goal: 'Verify Button.', kind: 'task-contract',
            schemaVersion: 1, uncertainties: [], verificationExpectations: ['Run tests'],
          },
        },
        kind: 'task-analysis', schemaVersion: 1,
      },
      verificationId: 'cli-verification',
    };

    await writeFile(inputPath, JSON.stringify(input), 'utf8');

    const result = runCli([
      'verification-evaluate', '--input', inputPath, '--project', projectRoot, '--plugin', pluginRoot,
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).kind, 'quality-result');
    assert.equal(JSON.parse(result.stdout).data.status, 'passed');
  });


  it('оценивает completion evidence только через явную CLI command', async () => {
    const projectRoot = await createTemporaryDirectory();
    const verificationPath = join(projectRoot, 'verification-input.json');
    const completionPath = join(projectRoot, 'completion-input.json');
    const taskAnalysis = {
      data: {
        classification: {
          confidence: 'high',
          dimensions: {
            blastRadius: 'local', complexity: 'low', coupling: 'low', expectedContextCost: 'low', novelty: 'unknown',
            parallelizability: 'low', risk: 'unknown', scope: 'local', uncertainty: 'low', verificationCost: 'low',
          },
          evidenceGaps: ['novelty', 'project-risk'], mode: 'text-only', reasonCodes: ['scope-local'], schemaVersion: 1,
        },
        contract: {
          affectedScope: { kind: 'local', targets: ['src/Button.tsx'] }, goal: 'Complete Button.', kind: 'task-contract',
          schemaVersion: 1, uncertainties: [], verificationExpectations: ['Run tests'],
        },
      },
      kind: 'task-analysis', schemaVersion: 1,
    };
    const verificationInput = {
      artifacts: {
        implementationResultRef: 'artifact:implementation',
        taskAnalysisRef: 'artifact:task-analysis',
      },
      mechanicalChecks: [{
        evidenceRefs: ['evidence:tests'], id: 'tests', kind: 'test', label: 'Runtime tests', status: 'passed',
      }],
      strategyDecision: {
        data: {
          confidence: 'high', escalation: 'none', execution: 'direct', exploration: 'none', fastPath: false,
          planning: 'none', policyVersion: 1, reasonCodes: ['direct-execution'], review: 'none', verification: 'none',
        },
        kind: 'execution-strategy', schemaVersion: 1,
      },
      taskAnalysis,
      verificationId: 'cli-completion-verification',
    };

    await writeFile(verificationPath, JSON.stringify(verificationInput), 'utf8');
    const verification = runCli([
      'verification-evaluate', '--input', verificationPath, '--project', projectRoot, '--plugin', pluginRoot,
    ]);
    assert.equal(verification.status, 0, verification.stderr);

    await writeFile(completionPath, JSON.stringify({
      completionId: 'cli-completion',
      execution: {
        evidenceRefs: ['evidence:implementation'], status: 'completed', unresolvedIssues: [],
      },
      integration: {
        evidenceRefs: [], reason: 'No integration step is required.', status: 'not-required',
      },
      taskAnalysis,
      verificationResult: JSON.parse(verification.stdout),
    }), 'utf8');

    const result = runCli([
      'completion-evaluate', '--input', completionPath, '--project', projectRoot, '--plugin', pluginRoot,
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).kind, 'quality-result');
    assert.equal(JSON.parse(result.stdout).data.status, 'complete');
    assert.equal(JSON.parse(result.stdout).data.guard.decision, 'complete');
  });

  it('принимает relative path значения CLI options', () => {
    const result = runCli([
      'intelligence-discover',
      '--project',
      '.',
      '--plugin',
      '.',
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).projectRoot, pluginRoot);
  });
});
