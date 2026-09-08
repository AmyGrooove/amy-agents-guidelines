import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as Runtime from '../dist/index.js';

const runtimeExports = Runtime as unknown as Record<string, unknown>;

const createTaskContract = (goal: string, scope: 'local' | 'repository' = 'local') => ({
  acceptanceCriteria: ['Routing matches the expected strategy.'],
  affectedScope: { kind: scope },
  goal,
  kind: 'task-contract' as const,
  requirements: ['Preserve deterministic routing behavior.'],
  schemaVersion: 1,
  uncertainties: [],
  verificationExpectations: [],
});

const createCase = (caseId: string, goal = 'Keep a trivial task on the fast path.') => ({
  caseId,
  constraints: ['Do not require repository replay.'],
  environmentAssumptions: ['Canonical Stage 15 contracts are available.'],
  expectations: [
    {
      expected: true,
      id: 'fast-path',
      kind: 'strategy-fast-path',
      required: true,
      weight: 2,
    },
    {
      expected: 'direct',
      id: 'direct-execution',
      kind: 'strategy-execution',
      required: true,
      weight: 1,
    },
  ],
  kind: 'eval-case' as const,
  schemaVersion: 1,
  scoring: { passThreshold: 100 },
  task: createTaskContract(goal),
});

const createCorpus = (cases = [createCase('case-fast-path')]) => ({
  cases,
  corpusId: 'corpus-regression-routing',
  corpusKind: 'regression' as const,
  kind: 'eval-corpus' as const,
  schemaVersion: 1,
  version: 1,
});

const createStrategyObservation = (fastPath: boolean) => {
  const classifyTask = runtimeExports.classifyTask as (value: unknown) => any;
  const routeStrategy = runtimeExports.routeStrategy as (value: unknown) => any;
  const contract = createTaskContract(
    fastPath ? 'Make a local deterministic edit.' : 'Change repository-wide architecture.',
    fastPath ? 'local' : 'repository',
  );
  const taskAnalysis = classifyTask({
    contract,
    ...(fastPath
      ? {}
      : {
          projectEvidence: {
            kind: 'project-intelligence',
            modules: [{
              freshnessState: 'trusted',
              graphState: 'current',
              moduleId: 'amy.runtime',
              risk: 'high',
              riskReasons: ['critical-invariants', 'public-api'],
            }],
          },
        }),
  });

  return routeStrategy({ taskAnalysis });
};

const createObservation = (fastPath: boolean, usage = { costUnits: 1, durationMs: 10, tokens: 100 }) => ({
  evidenceRefs: ['eval:evidence:routing'],
  kind: 'eval-observation' as const,
  schemaVersion: 1,
  strategyDecision: createStrategyObservation(fastPath),
  usage,
});

describe('EvalSystem', () => {
  it('exports an independent optional eval capability and versioned contracts', () => {
    const versions = runtimeExports.EVAL_SYSTEM_VERSIONS as Record<string, number>;

    assert.deepEqual(versions, {
      api: 1,
      caseSchema: 1,
      comparisonSchema: 1,
      corpusSchema: 1,
      observationSchema: 1,
      resultSchema: 1,
      scoringPolicy: 1,
    });
    assert.equal(typeof runtimeExports.createEvalSystemCapability, 'function');
    assert.equal(typeof runtimeExports.validateEvalCorpus, 'function');
    assert.equal(typeof runtimeExports.evaluateEvalCase, 'function');
    assert.equal(typeof runtimeExports.runEvalCorpus, 'function');
    assert.equal(typeof runtimeExports.compareEvalVariants, 'function');
    assert.equal(typeof runtimeExports.validateOutcomeAssessment, 'function');

    const createCapability = runtimeExports.createEvalSystemCapability as () => any;
    const capability = createCapability();

    assert.equal(capability.descriptor.id, 'amy.eval-system');
    assert.equal(capability.descriptor.version, '1.0.0');
    assert.equal(capability.descriptor.dependencies, undefined);
    assert.equal(typeof capability.api.evaluateCase, 'function');
    assert.equal(typeof capability.api.runCorpus, 'function');
    assert.equal(typeof capability.api.compareVariants, 'function');
  });

  it('validates compact real/failure/regression corpora and rejects duplicate cases', () => {
    const validateEvalCorpus = runtimeExports.validateEvalCorpus as (value: unknown) => any;

    for (const corpusKind of ['real-task', 'failure', 'regression']) {
      const corpus = validateEvalCorpus({ ...createCorpus(), corpusKind });
      assert.equal(corpus.corpusKind, corpusKind);
      assert.equal(corpus.cases.length, 1);
      assert.equal(corpus.cases[0].task.kind, 'task-contract');
    }

    assert.throws(
      () => validateEvalCorpus(createCorpus([
        createCase('duplicate'),
        createCase('duplicate'),
      ])),
      /case ids must be unique/i,
    );
    assert.throws(
      () => validateEvalCorpus({ ...createCorpus(), rawPrompt: 'do not persist me' }),
      /unknown fields/i,
    );
  });

  it('scores canonical observations deterministically and requires all required expectations', () => {
    const evaluateEvalCase = runtimeExports.evaluateEvalCase as (value: unknown) => any;
    const evalCase = createCase('case-score');

    const passed = evaluateEvalCase({
      case: evalCase,
      observation: createObservation(true),
    });
    const failed = evaluateEvalCase({
      case: evalCase,
      observation: createObservation(false),
    });

    assert.equal(passed.status, 'passed');
    assert.equal(passed.score, 100);
    assert.deepEqual(passed.checks.map(({ status }: { status: string }) => status), ['passed', 'passed']);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.score, 0);
    assert.ok(failed.checks.every(({ status }: { status: string }) => status === 'failed'));
  });

  it('runs corpus sequentially with explicit bounded usage and stops when budget is exhausted', async () => {
    const runEvalCorpus = runtimeExports.runEvalCorpus as (value: unknown, executor: (input: any) => Promise<unknown>) => Promise<any>;
    const corpus = createCorpus([createCase('case-a'), createCase('case-b')]);
    const executed: string[] = [];

    const result = await runEvalCorpus({
      budget: {
        maxCases: 1,
        maxCostUnits: 10,
        maxDurationMs: 1_000,
        maxTokens: 1_000,
      },
      corpus,
      runId: 'run-budget',
      variant: { variantId: 'baseline' },
    }, async ({ case: evalCase }) => {
      executed.push(evalCase.caseId);
      return createObservation(true);
    });

    assert.deepEqual(executed, ['case-a']);
    assert.equal(result.status, 'budget-exhausted');
    assert.equal(result.executedCaseCount, 1);
    assert.deepEqual(result.skippedCaseIds, ['case-b']);
    assert.deepEqual(result.usage, { costUnits: 1, durationMs: 10, tokens: 100 });
    assert.equal(result.score, 100);
  });

  it('compares the same corpus across two variants and reports per-case improvements without mutating routing', async () => {
    const compareEvalVariants = runtimeExports.compareEvalVariants as (
      value: unknown,
      executor: (input: any) => Promise<unknown>,
    ) => Promise<any>;
    const corpus = createCorpus([createCase('case-compare')]);

    const comparison = await compareEvalVariants({
      baseline: { variantId: 'baseline', configurationRef: 'routing-policy:v1' },
      budget: {
        maxCases: 1,
        maxCostUnits: 10,
        maxDurationMs: 1_000,
        maxTokens: 1_000,
      },
      candidate: { variantId: 'candidate', configurationRef: 'routing-policy:v2-shadow' },
      comparisonId: 'comparison-routing',
      corpus,
    }, async ({ variant }) => createObservation(variant.variantId === 'candidate'));

    assert.equal(comparison.status, 'completed');
    assert.equal(comparison.winner, 'candidate');
    assert.equal(comparison.baseline.score, 0);
    assert.equal(comparison.candidate.score, 100);
    assert.equal(comparison.scoreDelta, 100);
    assert.deepEqual(comparison.improvedCaseIds, ['case-compare']);
    assert.deepEqual(comparison.regressedCaseIds, []);
  });
});
