import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import * as Runtime from '../dist/index.js';
import {
  AmyRuntimeError,
  RuntimeEventBus,
  classifyTask,
  createDataStorageCapability,
  createDataStorageEventConsumer,
  planRecovery,
  runCompletionProtocol,
  runVerificationPipeline,
} from '../dist/index.js';

const runtimeExports = Runtime as unknown as Record<string, unknown>;
const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'amy-outcome-'));
  temporaryDirectories.push(directory);
  return directory;
};

const createCompletion = (
  state: 'complete' | 'failed' | 'incomplete' | 'unverified',
  retryCount = 0,
) => {
  const taskAnalysis = classifyTask({
    contract: {
      acceptanceCriteria: ['The requested behavior is correct.'],
      affectedScope: { kind: 'local', targets: ['runtime/src/outcome-intelligence'] },
      goal: 'Assess the real task outcome.',
      kind: 'task-contract',
      requirements: ['Use canonical completion evidence.'],
      schemaVersion: 1,
      uncertainties: [],
      verificationExpectations: ['Run tests'],
    },
  });
  const verificationResult = runVerificationPipeline({
    artifacts: {
      implementationResultRef: 'artifact:implementation',
      taskAnalysisRef: 'artifact:task-analysis',
    },
    mechanicalChecks: [{
      evidenceRefs: state === 'unverified' ? [] : ['evidence:tests'],
      id: 'tests',
      kind: 'test',
      label: 'Runtime tests',
      ...(state === 'unverified' ? { reason: 'Runner unavailable' } : {}),
      status: state === 'unverified' ? 'unavailable' : 'passed',
    }],
    strategyDecision: {
      data: {
        confidence: 'high',
        escalation: 'none',
        execution: 'direct',
        exploration: 'none',
        fastPath: false,
        planning: 'none',
        policyVersion: 1,
        reasonCodes: ['direct-execution'],
        review: 'none',
        verification: 'none',
      },
      kind: 'execution-strategy',
      schemaVersion: 1,
    },
    taskAnalysis,
    verificationId: `verification-${state}`,
  });

  return runCompletionProtocol({
    completionId: `completion-${state}`,
    execution: {
      evidenceRefs: ['evidence:implementation'],
      ...(state === 'failed' ? { reason: 'Implementation failed.' } : {}),
      status: state === 'failed' ? 'failed' : 'completed',
      unresolvedIssues: state === 'failed' ? ['Implementation is broken.'] : [],
    },
    guard: { maxRetries: 2, retryCount },
    integration: {
      evidenceRefs: state === 'incomplete' ? ['evidence:partial-integration'] : [],
      reason: state === 'incomplete'
        ? 'Integration is incomplete.'
        : 'No separate integration step is required.',
      status: state === 'incomplete' ? 'incomplete' : 'not-required',
    },
    taskAnalysis,
    verificationResult,
  });
};

describe('OutcomeIntelligence', () => {
  it('exports an independent deterministic outcome capability', () => {
    assert.deepEqual(runtimeExports.OUTCOME_INTELLIGENCE_VERSIONS, {
      api: 1,
      detectorPolicy: 1,
      detectorSchema: 1,
      failureSchema: 1,
      outcomeSchema: 1,
      signalSchema: 1,
    });
    assert.equal(typeof runtimeExports.createOutcomeIntelligenceCapability, 'function');
    assert.equal(typeof runtimeExports.assessOutcome, 'function');
    assert.equal(typeof runtimeExports.detectUserCorrection, 'function');
    assert.equal(typeof runtimeExports.recordOutcomeAssessment, 'function');

    const createCapability = runtimeExports.createOutcomeIntelligenceCapability as () => {
      api: { assess: (value: unknown) => unknown; detectUserCorrection: (value: unknown) => unknown };
      descriptor: { dependencies?: unknown; id: string; version: string };
    };
    const capability = createCapability();

    assert.equal(capability.descriptor.id, 'amy.outcome-intelligence');
    assert.equal(capability.descriptor.version, '1.0.0');
    assert.equal(capability.descriptor.dependencies, undefined);
    assert.equal(typeof capability.api.assess, 'function');
    assert.equal(typeof capability.api.detectUserCorrection, 'function');
  });

  it('maps canonical Completion states without treating tests-passed as the only success signal', () => {
    const assessOutcome = runtimeExports.assessOutcome as (value: unknown) => any;

    const failedAttempt = createCompletion('failed');
    const recoveryPlan = planRecovery({
      completionResult: failedAttempt,
      failure: {
        branch: { id: 'task:success-retry', kind: 'task' },
        directRetryAllowed: false,
        evidenceRefs: ['evidence:failed-attempt'],
        failureClass: 'implementation',
        summary: 'The first implementation attempt failed.',
      },
      recoveryId: 'recovery-success-retry',
    });
    const success = assessOutcome({
      completionResult: createCompletion('complete', 1),
      outcomeId: 'outcome-success',
      recoveryPlans: [recoveryPlan],
      taskId: 'task-success',
    });
    const partial = assessOutcome({
      completionResult: createCompletion('incomplete'),
      outcomeId: 'outcome-partial',
      taskId: 'task-partial',
    });
    const failed = assessOutcome({
      completionResult: createCompletion('failed'),
      outcomeId: 'outcome-failed',
      taskId: 'task-failed',
    });
    const unverified = assessOutcome({
      completionResult: createCompletion('unverified'),
      outcomeId: 'outcome-unverified',
      taskId: 'task-unverified',
    });

    assert.equal(success.status, 'success');
    assert.equal(success.attempts.retryCount, 1);
    assert.equal(success.attempts.escalationCount, 0);
    assert.ok(success.evidenceRefs.includes('completion:completion-complete'));
    assert.ok(success.evidenceRefs.includes('evidence:implementation'));
    assert.ok(success.evidenceRefs.includes('evidence:tests'));
    assert.ok(success.evidenceRefs.includes('verification:verification-complete'));
    assert.ok(success.failures.some(({ source }: { source: string }) => source === 'recovery')); 
    assert.equal(partial.status, 'partial_success');
    assert.equal(failed.status, 'failure');
    assert.equal(unverified.status, 'unverified');
    assert.ok(failed.failures.some(({ failureClass }: { failureClass: string }) => failureClass === 'implementation'));
  });

  it('keeps insufficient evidence unknown instead of manufacturing success', () => {
    const assessOutcome = runtimeExports.assessOutcome as (value: unknown) => any;
    const result = assessOutcome({
      outcomeId: 'outcome-unknown',
      taskId: 'task-unknown',
    });

    assert.equal(result.status, 'unknown');
    assert.equal(result.confidence, 'low');
    assert.ok(result.reasonCodes.includes('completion-evidence-missing'));
  });

  it('uses bounded post-task signals to revise an earlier success and preserve failure taxonomy', () => {
    const assessOutcome = runtimeExports.assessOutcome as (value: unknown) => any;
    const result = assessOutcome({
      completionResult: createCompletion('complete'),
      outcomeId: 'outcome-follow-up',
      postTaskSignals: [{
        evidenceRefs: ['feedback:bug-1'],
        failureClass: 'verification',
        impact: 'failure',
        kind: 'follow-up-bug',
        summary: 'A later bug report shows the acceptance behavior is still broken.',
      }],
      taskId: 'task-follow-up',
    });

    assert.equal(result.status, 'failure');
    assert.equal(result.confidence, 'high');
    assert.ok(result.reasonCodes.includes('post-task-failure-signal'));
    assert.deepEqual(result.failures.map(({ failureClass }: { failureClass: string }) => failureClass), ['verification']);
  });

  it('detects corrections conservatively and distinguishes them from new requests', () => {
    const detectUserCorrection = runtimeExports.detectUserCorrection as (value: unknown) => any;
    const correction = detectUserCorrection({
      message: 'Нет, ты сломал pagination — теперь вторая страница не открывается.',
      messageRef: 'turn:user-correction',
    });
    const newTask = detectUserCorrection({
      message: 'Теперь добавь ещё сортировку по имени.',
      messageRef: 'turn:new-task',
    });
    const ambiguous = detectUserCorrection({
      message: 'Посмотри на это ещё раз.',
      messageRef: 'turn:ambiguous',
    });

    assert.equal(correction.classification, 'correction');
    assert.equal(correction.confidence, 'high');
    assert.deepEqual(correction.signal, {
      evidenceRefs: ['turn:user-correction'],
      impact: 'partial',
      kind: 'user-correction',
      summary: 'User follow-up indicates a correction to the previous result.',
    });
    assert.equal(newTask.classification, 'new-task');
    assert.equal(newTask.signal, undefined);
    assert.equal(ambiguous.classification, 'ambiguous');
    assert.equal(ambiguous.confidence, 'low');
    assert.equal(ambiguous.signal, undefined);
  });

  it('emits a privacy-safe outcome event and Stage 14 storage normalizes outcomes and failures', async () => {
    const rootDirectory = await createTemporaryDirectory();
    const bus = new RuntimeEventBus();
    const storage = createDataStorageCapability({
      now: () => '2026-09-08T12:30:01.000Z',
      rootDirectory,
    });
    bus.subscribe(createDataStorageEventConsumer(storage.api));
    const detectUserCorrection = runtimeExports.detectUserCorrection as (value: unknown) => any;
    const correction = detectUserCorrection({
      message: 'Нет, ты сломал pagination — теперь вторая страница не открывается.',
      messageRef: 'turn:private-feedback',
    });
    const recordOutcomeAssessment = runtimeExports.recordOutcomeAssessment as (
      value: unknown,
      options: unknown,
    ) => Promise<any>;

    const receipt = await recordOutcomeAssessment({
      completionResult: createCompletion('complete'),
      outcomeId: 'outcome-storage',
      postTaskSignals: [correction.signal],
      taskId: 'task-storage',
    }, {
      events: bus,
      now: () => '2026-09-08T12:30:00.000Z',
      runtimeId: 'runtime-stage-15',
    });

    assert.equal(receipt.status, 'emitted');
    assert.equal(receipt.assessment.status, 'partial_success');
    const raw = await readFile(join(rootDirectory, 'raw', '2026-09-08.jsonl'), 'utf8');
    assert.doesNotMatch(raw, /сломал pagination/);
    assert.match(raw, /User follow-up indicates a correction/);

    const database = new DatabaseSync(join(rootDirectory, 'amy.sqlite'));
    const migrations = database.prepare('SELECT version FROM amy_storage_migrations ORDER BY version').all() as { version: number }[];
    const outcome = database.prepare(
      'SELECT outcome_id, task_id, status, retry_count, escalation_count FROM outcomes',
    ).get() as Record<string, unknown>;
    const failure = database.prepare(
      'SELECT outcome_id, task_id, failure_class, source FROM failures',
    ).get() as Record<string, unknown>;

    assert.deepEqual(migrations.map(({ version }) => version), [1, 2]);
    assert.deepEqual({ ...outcome }, {
      escalation_count: 0,
      outcome_id: 'outcome-storage',
      retry_count: 0,
      status: 'partial_success',
      task_id: 'task-storage',
    });
    assert.deepEqual({ ...failure }, {
      failure_class: 'unknown',
      outcome_id: 'outcome-storage',
      source: 'post-task',
      task_id: 'task-storage',
    });
    database.close();
  });


  it('keeps outcome recording fail-open when an optional consumer fails', async () => {
    const bus = new RuntimeEventBus();
    bus.subscribe(async () => {
      throw new Error('optional sink unavailable');
    });
    const recordOutcomeAssessment = runtimeExports.recordOutcomeAssessment as (
      value: unknown,
      options: unknown,
    ) => Promise<any>;

    const receipt = await recordOutcomeAssessment({
      completionResult: createCompletion('complete'),
      outcomeId: 'outcome-fail-open',
      taskId: 'task-fail-open',
    }, {
      events: bus,
      now: () => '2026-09-08T12:35:00.000Z',
      runtimeId: 'runtime-stage-15-fail-open',
    });

    assert.equal(receipt.assessment.status, 'success');
    assert.equal(receipt.status, 'degraded');
    assert.equal(receipt.deliveredCount, 0);
    assert.deepEqual(receipt.deliveryFailures, ['optional sink unavailable']);
  });

  it('rejects malformed negative signals instead of accepting evidence-free corrections', () => {
    const assessOutcome = runtimeExports.assessOutcome as (value: unknown) => any;

    assert.throws(
      () => assessOutcome({
        completionResult: createCompletion('complete'),
        outcomeId: 'outcome-invalid',
        postTaskSignals: [{
          evidenceRefs: [],
          kind: 'user-correction',
          summary: 'Correction without evidence.',
        }],
        taskId: 'task-invalid',
      }),
      (error: unknown) => error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});
