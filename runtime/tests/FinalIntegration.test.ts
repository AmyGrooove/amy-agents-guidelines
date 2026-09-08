import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import * as Runtime from '../dist/index.js';

const Amy = Runtime as unknown as Record<string, any>;

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

const createComplexContract = () => ({
  acceptanceCriteria: [
    'Public API remains backward compatible',
    'Both modules are integrated',
    'Tests, typecheck, and build pass',
  ],
  affectedScope: {
    kind: 'multi-module',
    targets: ['runtime.module-a', 'runtime.module-b'],
  },
  constraints: ['Keep optional capabilities fail-open'],
  goal: 'Change a shared runtime contract across two modules.',
  kind: 'task-contract',
  nonGoals: ['Do not add a new orchestrator'],
  requirements: [
    'Update module A',
    'Update module B',
    'Preserve the public contract',
    'Integrate the changes',
  ],
  schemaVersion: 1,
  uncertainties: [],
  verificationExpectations: ['Run tests', 'Run typecheck', 'Run build'],
});

const createPassedMechanicalCheck = () => ({
  evidenceRefs: ['check:tests'],
  id: 'tests',
  kind: 'test',
  label: 'Relevant tests',
  status: 'passed',
});

const createVerificationInput = (
  taskAnalysis: any,
  strategyDecision: any,
  mechanicalChecks: any[],
) => ({
  artifacts: {
    contextPacketRef: 'context:task-1',
    implementationResultRef: 'implementation:task-1',
    taskAnalysisRef: 'task-analysis:task-1',
  },
  mechanicalChecks,
  strategyDecision,
  taskAnalysis,
  verificationId: 'verification:task-1',
});

describe('Final integration hardening', () => {
  it('keeps package and plugin manifest versions aligned on strict SemVer', async () => {
    const packageJson = JSON.parse(
      await readFile(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { version?: string };
    const manifest = JSON.parse(
      await readFile(join(process.cwd(), '.codex-plugin', 'plugin.json'), 'utf8'),
    ) as { version?: string };
    const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

    assert.equal(packageJson.version, manifest.version);
    assert.match(packageJson.version ?? '', semver);
  });

  it('keeps package typecheck runnable from a clean source tree', async () => {
    const packageJson = JSON.parse(
      await readFile(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };
    const typecheck = packageJson.scripts?.typecheck ?? '';
    const buildIndex = typecheck.indexOf('pnpm build');
    const testTypecheckIndex = typecheck.indexOf('tsc -p tsconfig.test.json --noEmit');

    assert.ok(buildIndex >= 0, 'typecheck must build runtime/dist before checking public-API tests');
    assert.ok(
      testTypecheckIndex > buildIndex,
      'test typecheck must run after runtime/dist is built',
    );
  });

  it('runs the trivial fast path through completion and outcome without decomposition', async () => {
    const taskAnalysis = Amy.classifyTask({ contract: createLocalContract() });
    const contextSelection = await Amy.createContextIntelligenceCapability().api.resolve({
      taskAnalysis,
    });
    const computeDecision = Amy.routeCompute({ taskAnalysis });
    const strategyDecision = Amy.routeStrategy({
      computeDecision,
      contextResolution: contextSelection.data.resolution,
      taskAnalysis,
    });
    const decomposition = Amy.planDecomposition({
      source: { kind: 'strategy', strategyDecision },
      taskAnalysis,
    });

    assert.equal(computeDecision.profile, 'FAST');
    assert.equal(strategyDecision.data.fastPath, true);
    assert.equal(strategyDecision.data.execution, 'direct');
    assert.equal(strategyDecision.data.planning, 'none');
    assert.equal(decomposition.data.decision, 'not-needed');

    const verificationResult = Amy.runVerificationPipeline(
      createVerificationInput(taskAnalysis, strategyDecision, [createPassedMechanicalCheck()]),
    );
    const completionResult = Amy.runCompletionProtocol({
      completionId: 'completion:task-1',
      execution: {
        evidenceRefs: ['implementation:task-1'],
        status: 'completed',
        unresolvedIssues: [],
      },
      integration: {
        evidenceRefs: [],
        reason: 'No separate integration step is required.',
        status: 'not-required',
      },
      taskAnalysis,
      verificationResult,
    });
    const outcome = Amy.assessOutcome({
      completionResult,
      outcomeId: 'outcome:task-1',
      taskId: 'task-1',
    });

    assert.equal(verificationResult.data.status, 'passed');
    assert.equal(completionResult.data.status, 'complete');
    assert.equal(completionResult.data.guard.decision, 'complete');
    assert.equal(outcome.status, 'success');
  });

  it('routes a high-risk multi-module task to bounded DAG execution and conditional review', () => {
    const taskAnalysis = Amy.classifyTask({
      contract: createComplexContract(),
      projectEvidence: {
        kind: 'project-intelligence',
        modules: [
          {
            freshnessState: 'trusted',
            graphState: 'current',
            moduleId: 'runtime.module-a',
            risk: 'high',
            riskReasons: ['public-api', 'many-consumers'],
          },
          {
            freshnessState: 'trusted',
            graphState: 'current',
            moduleId: 'runtime.module-b',
            risk: 'medium',
            riskReasons: [],
          },
        ],
      },
    });
    const computeDecision = Amy.routeCompute({ taskAnalysis });
    const strategyDecision = Amy.routeStrategy({ computeDecision, taskAnalysis });
    const decomposition = Amy.planDecomposition({
      proposal: {
        kind: 'decomposition-proposal',
        proposalId: 'task-complex:plan-1',
        schemaVersion: 1,
        nodes: [
          {
            dependencies: [],
            goal: 'Update module A.',
            id: 'module-a',
            outputs: ['artifact:module-a'],
            ownerRole: 'worker',
            readTargets: ['runtime/src/module-a'],
            writeTargets: ['runtime/src/module-a'],
          },
          {
            dependencies: [],
            goal: 'Update module B.',
            id: 'module-b',
            outputs: ['artifact:module-b'],
            ownerRole: 'worker',
            readTargets: ['runtime/src/module-b'],
            writeTargets: ['runtime/src/module-b'],
          },
          {
            dependencies: ['module-a', 'module-b'],
            goal: 'Integrate both modules.',
            id: 'integrate',
            outputs: ['artifact:integrated'],
            ownerRole: 'worker',
            readTargets: ['runtime/src/module-a', 'runtime/src/module-b'],
            writeTargets: ['runtime/src/index.ts'],
          },
        ],
      },
      source: { kind: 'strategy', strategyDecision },
      taskAnalysis,
    });

    assert.equal(strategyDecision.data.execution, 'worker');
    assert.equal(strategyDecision.data.planning, 'decompose');
    assert.equal(strategyDecision.data.verification, 'verifier');
    assert.equal(strategyDecision.data.review, 'reviewer');
    assert.equal(decomposition.data.decision, 'planned');
    assert.equal(decomposition.data.dag.nodes.length, 3);
    assert.equal(decomposition.data.parallelism.mode, 'sequential');
    assert.equal(decomposition.data.parallelism.maxConcurrency, 1);
    assert.ok(decomposition.data.parallelism.reasonCodes.includes('coordination-cost-high'));
    assert.ok(decomposition.data.parallelism.reasonCodes.includes('integration-cost-high'));
  });

  it('turns failed verification into bounded scoped recovery instead of false completion', () => {
    const taskAnalysis = Amy.classifyTask({ contract: createLocalContract() });
    const strategyDecision = Amy.routeStrategy({ taskAnalysis });
    const verificationResult = Amy.runVerificationPipeline(
      createVerificationInput(taskAnalysis, strategyDecision, [
        {
          evidenceRefs: ['check:tests:failed'],
          id: 'tests',
          kind: 'test',
          label: 'Relevant tests',
          reason: 'Regression detected',
          status: 'failed',
        },
      ]),
    );
    const completionResult = Amy.runCompletionProtocol({
      completionId: 'completion:failed-task',
      execution: {
        evidenceRefs: ['implementation:failed-task'],
        status: 'completed',
        unresolvedIssues: [],
      },
      integration: {
        evidenceRefs: [],
        reason: 'No separate integration step is required.',
        status: 'not-required',
      },
      taskAnalysis,
      verificationResult,
    });
    const recoveryPlan = Amy.planRecovery({
      completionResult,
      failure: {
        branch: { id: 'verification:failed-task', kind: 'verification' },
        directRetryAllowed: true,
        evidenceRefs: ['check:tests:failed'],
        failureClass: 'verification',
        summary: 'Mechanical verification failed.',
      },
      recoveryId: 'recovery:failed-task',
    });
    const outcome = Amy.assessOutcome({
      completionResult,
      outcomeId: 'outcome:failed-task',
      recoveryPlans: [recoveryPlan],
      taskId: 'failed-task',
    });

    assert.equal(verificationResult.data.status, 'failed');
    assert.equal(completionResult.data.status, 'failed');
    assert.equal(completionResult.data.guard.decision, 'retry');
    assert.equal(recoveryPlan.data.action, 'retry');
    assert.equal(recoveryPlan.data.requiresVerification, true);
    assert.equal(recoveryPlan.data.attempt.nextRetryCount, 1);
    assert.equal(outcome.status, 'failure');
  });

  it('keeps lifecycle and observability fail-open when optional storage delivery fails', async () => {
    const events = new Amy.RuntimeEventBus();
    const storageConsumer = Amy.createDataStorageEventConsumer({
      capture: async () => ({
        failures: ['disk unavailable'],
        normalized: 'failed',
        raw: 'failed',
        status: 'dropped',
      }),
    });
    events.subscribe(storageConsumer);

    const runtime = await Amy.createAmyRuntime({
      events,
      homeDirectory: join(process.cwd(), '.amy-stage22-no-home'),
      pluginRoot: process.cwd(),
      projectRoot: process.cwd(),
      runtimeId: 'runtime:stage-22',
    });

    await runtime.start();
    assert.equal(runtime.getStatus().lifecycle, 'started');

    const observability = Amy.createObservabilityCapability({
      events,
      now: () => '2026-09-08T12:00:00.000Z',
      runtimeId: 'runtime:stage-22',
    });
    const receipt = await observability.api.record({
      event: 'completed',
      kind: 'telemetry',
      recordId: 'telemetry:stage-22',
      subject: { id: 'task-1', kind: 'task' },
    });

    assert.equal(receipt.status, 'degraded');
    assert.equal(receipt.deliveredCount, 0);
    assert.deepEqual(receipt.deliveryFailures, ['Data storage capture dropped']);
    assert.equal(runtime.getStatus().lifecycle, 'started');
  });
});
