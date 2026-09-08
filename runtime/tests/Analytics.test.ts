import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as Runtime from '../dist/index.js';

const runtimeExports = Runtime as unknown as Record<string, unknown>;

const createTaskAnalysis = (goal: string, scope: 'local' | 'module' = 'local') => {
  const classifyTask = runtimeExports.classifyTask as (value: unknown) => any;

  return classifyTask({
    contract: {
      acceptanceCriteria: ['The requested behavior is implemented.'],
      affectedScope: { kind: scope },
      goal,
      kind: 'task-contract',
      requirements: ['Preserve existing contracts.'],
      schemaVersion: 1,
      uncertainties: [],
      verificationExpectations: ['Run tests'],
    },
  });
};

const createStrategy = (_taskAnalysis: any, fastPath: boolean) => ({
  data: {
    confidence: 'high',
    escalation: 'none',
    execution: 'direct',
    exploration: fastPath ? 'none' : 'scout',
    fastPath,
    planning: 'none',
    policyVersion: 1,
    reasonCodes: fastPath
      ? ['direct-execution', 'fast-path']
      : ['context-scout-required', 'reviewer-risk-justified', 'verifier-risk-justified'],
    review: fastPath ? 'none' : 'reviewer',
    verification: fastPath ? 'none' : 'verifier',
  },
  kind: 'execution-strategy',
  schemaVersion: 1,
});

const createOutcome = (
  taskId: string,
  status: 'failure' | 'partial_success' | 'success' | 'unknown' | 'unverified',
  failureClass?: string,
  retryCount = 0,
) => ({
  attempts: { escalationCount: 0, retryCount },
  confidence: status === 'unknown' ? 'low' : 'high',
  evidenceRefs: [`task:${taskId}`],
  failures: failureClass
    ? [{
        evidenceRefs: [`failure:${taskId}`],
        failureClass,
        failureId: `failure-${taskId}`,
        kind: 'failure-intelligence',
        schemaVersion: 1,
        source: 'post-task',
        summary: `Observed ${failureClass} failure.`,
      }]
    : [],
  kind: 'outcome-assessment',
  outcomeId: `outcome-${taskId}`,
  reasonCodes: failureClass
    ? ['failure-classified', 'post-task-failure-signal']
    : status === 'success'
      ? ['completion-succeeded']
      : status === 'unverified'
        ? ['completion-unverified']
        : status === 'unknown'
          ? ['completion-evidence-missing']
          : ['completion-incomplete'],
  schemaVersion: 1,
  status,
  taskId,
  unresolvedIssues: failureClass ? [`${failureClass} issue`] : [],
});

const createSample = ({
  goal,
  observedAt,
  outcome,
  policyVersion,
  sampleId,
  fastPath = false,
  usage,
}: {
  goal: string;
  observedAt: string;
  outcome?: ReturnType<typeof createOutcome>;
  policyVersion: number;
  sampleId: string;
  fastPath?: boolean;
  usage?: { costUnits?: number; durationMs?: number; tokens?: number };
}) => {
  const taskAnalysis = createTaskAnalysis(goal);

  return {
    ...(outcome ? { outcomeAssessment: outcome } : {}),
    observedAt,
    policyRefs: [{ owner: 'strategy-routing', version: policyVersion }],
    sampleId,
    strategyDecision: createStrategy(taskAnalysis, fastPath),
    taskAnalysis,
    ...(usage ? { usage } : {}),
  };
};

const createEvalRun = () => ({
  caseResults: [
    {
      caseId: 'eval-pass',
      checks: [{
        actual: true,
        expectationId: 'fast-path',
        expected: true,
        kind: 'strategy-fast-path',
        required: true,
        status: 'passed',
        weight: 1,
      }],
      kind: 'eval-case-result',
      schemaVersion: 1,
      score: 100,
      status: 'passed',
      usage: { costUnits: 1, durationMs: 10, tokens: 100 },
    },
    {
      caseId: 'eval-fail',
      checks: [{
        actual: false,
        expectationId: 'fast-path',
        expected: true,
        kind: 'strategy-fast-path',
        required: true,
        status: 'failed',
        weight: 1,
      }],
      kind: 'eval-case-result',
      schemaVersion: 1,
      score: 0,
      status: 'failed',
      usage: { costUnits: 1, durationMs: 20, tokens: 200 },
    },
  ],
  corpusId: 'corpus-regression',
  executedCaseCount: 2,
  kind: 'eval-run-result',
  runId: 'eval-run-1',
  schemaVersion: 1,
  score: 50,
  skippedCaseIds: [],
  status: 'completed',
  usage: { costUnits: 2, durationMs: 30, tokens: 300 },
  variantId: 'routing-policy-v1',
});

const metric = (segment: any, id: string) => {
  const found = segment.metrics.find((item: { id: string }) => item.id === id);
  assert.ok(found, `Missing metric ${id}`);
  return found;
};

describe('Analytics', () => {
  it('exports an independent optional analytics capability and versioned contracts', () => {
    assert.deepEqual(runtimeExports.ANALYTICS_VERSIONS, {
      api: 1,
      archetypePolicy: 1,
      archetypeSchema: 1,
      inputSchema: 1,
      metricPolicy: 1,
      reportSchema: 1,
    });
    assert.equal(typeof runtimeExports.createAnalyticsCapability, 'function');
    assert.equal(typeof runtimeExports.analyzeAmyData, 'function');
    assert.equal(typeof runtimeExports.discoverTaskArchetypes, 'function');
    assert.equal(typeof runtimeExports.validateAnalyticsInput, 'function');
    assert.equal(typeof runtimeExports.validateEvalRunResult, 'function');

    const createCapability = runtimeExports.createAnalyticsCapability as () => any;
    const capability = createCapability();

    assert.equal(capability.descriptor.id, 'amy.analytics');
    assert.equal(capability.descriptor.version, '1.0.0');
    assert.equal(capability.descriptor.dependencies, undefined);
    assert.equal(typeof capability.api.analyze, 'function');
    assert.equal(typeof capability.api.discoverArchetypes, 'function');
  });

  it('computes descriptive task, outcome, routing, usage, and eval metrics with sample confidence', () => {
    const analyzeAmyData = runtimeExports.analyzeAmyData as (value: unknown) => any;
    const report = analyzeAmyData({
      evalRunSamples: [{
        observedAt: '2026-09-02T12:00:00.000Z',
        policyRefs: [{ owner: 'strategy-routing', version: 1 }],
        run: createEvalRun(),
        sampleId: 'eval-sample-1',
      }],
      reportId: 'analytics-overall',
      segments: [],
      taskSamples: [
        createSample({
          fastPath: true,
          goal: 'Добавь сортировку по имени.',
          observedAt: '2026-09-01T10:00:00.000Z',
          outcome: createOutcome('task-feature', 'success'),
          policyVersion: 1,
          sampleId: 'task-feature',
          usage: { costUnits: 2, durationMs: 100, tokens: 200 },
        }),
        createSample({
          goal: 'Исправь баг pagination и regression.',
          observedAt: '2026-09-02T10:00:00.000Z',
          outcome: createOutcome('task-bug', 'failure', 'verification', 2),
          policyVersion: 1,
          sampleId: 'task-bug',
          usage: { costUnits: 4, durationMs: 300, tokens: 400 },
        }),
      ],
    });

    const overall = report.overall;
    assert.equal(overall.sampleSize, 2);
    assert.equal(metric(overall, 'task.count').value, 2);
    assert.equal(metric(overall, 'outcome.success-rate').value, 0.5);
    assert.equal(metric(overall, 'outcome.failure-rate').value, 0.5);
    assert.equal(metric(overall, 'recovery.avg-retries').value, 1);
    assert.equal(metric(overall, 'strategy.fast-path-rate').value, 0.5);
    assert.equal(metric(overall, 'strategy.scout-rate').value, 0.5);
    assert.equal(metric(overall, 'usage.avg-tokens').value, 300);
    assert.equal(metric(overall, 'eval.avg-score').value, 50);
    assert.equal(metric(overall, 'eval.case-pass-rate').value, 0.5);
    assert.equal(metric(overall, 'task.count').confidence, 'low');
    assert.deepEqual(overall.failureClasses.map(({ failureClass, count }: any) => [failureClass, count]), [['verification', 1]]);
  });

  it('segments by time window, policy version, and deterministic task archetype without cross-contamination', () => {
    const analyzeAmyData = runtimeExports.analyzeAmyData as (value: unknown) => any;
    const report = analyzeAmyData({
      evalRunSamples: [],
      reportId: 'analytics-segmented',
      segments: [
        {
          archetypes: ['bug-investigation'],
          policyRefs: [{ owner: 'strategy-routing', version: 1 }],
          segmentId: 'policy-v1-bugs',
        },
        {
          policyRefs: [{ owner: 'strategy-routing', version: 2 }],
          segmentId: 'policy-v2',
        },
      ],
      taskSamples: [
        createSample({
          goal: 'Fix broken pagination regression.',
          observedAt: '2026-09-01T10:00:00.000Z',
          outcome: createOutcome('bug-v1', 'failure', 'implementation'),
          policyVersion: 1,
          sampleId: 'bug-v1',
        }),
        createSample({
          fastPath: true,
          goal: 'Add sorting support.',
          observedAt: '2026-09-02T10:00:00.000Z',
          outcome: createOutcome('feature-v2', 'success'),
          policyVersion: 2,
          sampleId: 'feature-v2',
        }),
        createSample({
          goal: 'Fix old bug outside the selected window.',
          observedAt: '2026-08-01T10:00:00.000Z',
          outcome: createOutcome('old-bug', 'failure', 'implementation'),
          policyVersion: 1,
          sampleId: 'old-bug',
        }),
      ],
      window: {
        fromInclusive: '2026-09-01T00:00:00.000Z',
        toExclusive: '2026-09-03T00:00:00.000Z',
      },
    });

    assert.equal(report.overall.sampleSize, 2);
    assert.equal(report.segments.find(({ segmentId }: any) => segmentId === 'policy-v1-bugs').sampleSize, 1);
    assert.equal(report.segments.find(({ segmentId }: any) => segmentId === 'policy-v2').sampleSize, 1);
    assert.equal(metric(report.segments[0], 'outcome.failure-rate').value, 1);
    assert.equal(metric(report.segments[1], 'outcome.success-rate').value, 1);
  });

  it('discovers simple archetypes conservatively and marks small corpora as insufficient', () => {
    const discoverTaskArchetypes = runtimeExports.discoverTaskArchetypes as (value: unknown) => any;
    const discovery = discoverTaskArchetypes({
      taskSamples: [
        createSample({ goal: 'Исправь баг в API pagination.', observedAt: '2026-09-01T00:00:00.000Z', policyVersion: 1, sampleId: 'bug' }),
        createSample({ goal: 'Добавь unit tests для router.', observedAt: '2026-09-01T00:00:01.000Z', policyVersion: 1, sampleId: 'tests' }),
      ],
    });

    assert.equal(discovery.status, 'insufficient-sample');
    assert.equal(discovery.sampleSize, 2);
    assert.deepEqual(
      discovery.assignments.map(({ sampleId, archetype }: any) => [sampleId, archetype]),
      [['bug', 'bug-investigation'], ['tests', 'testing']],
    );
    assert.ok(discovery.assignments.every(({ confidence }: any) => confidence !== 'high'));
  });

  it('emits only non-causal investigative findings for recurring failures', () => {
    const analyzeAmyData = runtimeExports.analyzeAmyData as (value: unknown) => any;
    const samples = Array.from({ length: 5 }, (_, index) => createSample({
      goal: `Fix bug ${index} in verification flow.`,
      observedAt: `2026-09-0${index + 1}T10:00:00.000Z`,
      outcome: createOutcome(`failure-${index}`, 'failure', 'verification'),
      policyVersion: 1,
      sampleId: `failure-${index}`,
    }));
    const report = analyzeAmyData({
      evalRunSamples: [],
      reportId: 'analytics-findings',
      segments: [],
      taskSamples: samples,
    });

    const recurring = report.overall.findings.find(({ findingId }: any) => findingId === 'recurring-failure:verification');
    assert.ok(recurring);
    assert.equal(recurring.causalClaim, false);
    assert.match(recurring.hypothesis, /may/i);
    assert.match(recurring.recommendation, /inspect/i);
    assert.equal(recurring.sampleSize, 5);
  });

  it('rejects inconsistent downstream eval results instead of trusting forged aggregates', () => {
    const validateEvalRunResult = runtimeExports.validateEvalRunResult as (value: unknown) => unknown;
    const invalid = { ...createEvalRun(), executedCaseCount: 3 };

    assert.throws(() => validateEvalRunResult(invalid), /executed case count/i);
  });


  it('accepts the one-case aggregate budget overshoot allowed by the Stage 16 runner', () => {
    const validateEvalRunResult = runtimeExports.validateEvalRunResult as (value: unknown) => any;
    const base = createEvalRun();
    const caseResults = base.caseResults.map((result) => ({
      ...result,
      usage: { costUnits: 0, durationMs: 0, tokens: 60_000_000 },
    }));
    const result = validateEvalRunResult({
      ...base,
      caseResults,
      status: 'budget-exhausted',
      usage: { costUnits: 0, durationMs: 0, tokens: 120_000_000 },
    });

    assert.equal(result.usage.tokens, 120_000_000);
    assert.equal(result.status, 'budget-exhausted');
  });
});
