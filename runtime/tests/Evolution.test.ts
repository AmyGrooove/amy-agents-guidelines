import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as Runtime from '../dist/index.js';

const runtimeExports = Runtime as unknown as Record<string, unknown>;

const createTaskAnalysis = (goal = 'Add a small local feature.') => {
  const classifyTask = runtimeExports.classifyTask as (value: unknown) => any;

  return classifyTask({
    contract: {
      acceptanceCriteria: ['Behavior remains correct.'],
      affectedScope: { kind: 'local' },
      goal,
      kind: 'task-contract',
      requirements: ['Preserve existing contracts.'],
      schemaVersion: 1,
      uncertainties: [],
      verificationExpectations: [],
    },
  });
};

const createStrategy = (overrides: Record<string, unknown> = {}) => ({
  data: {
    confidence: 'high',
    escalation: 'none',
    execution: 'direct',
    exploration: 'none',
    fastPath: true,
    planning: 'none',
    policyVersion: 1,
    reasonCodes: ['direct-execution', 'fast-path'],
    review: 'none',
    verification: 'none',
    ...overrides,
  },
  kind: 'execution-strategy',
  schemaVersion: 1,
});

const createOutcome = (taskId: string, status: 'failure' | 'success') => ({
  attempts: { escalationCount: 0, retryCount: 0 },
  confidence: 'high',
  evidenceRefs: [`task:${taskId}`],
  failures: status === 'failure'
    ? [{
        evidenceRefs: [`failure:${taskId}`],
        failureClass: 'routing',
        failureId: `failure-${taskId}`,
        kind: 'failure-intelligence',
        schemaVersion: 1,
        source: 'post-task',
        summary: 'Observed routing failure.',
      }]
    : [],
  kind: 'outcome-assessment',
  outcomeId: `outcome-${taskId}`,
  reasonCodes: status === 'failure'
    ? ['failure-classified', 'post-task-failure-signal']
    : ['completion-succeeded'],
  schemaVersion: 1,
  status,
  taskId,
  unresolvedIssues: status === 'failure' ? ['routing issue'] : [],
});

const createAnalyticsInput = ({
  expensiveSuccess = true,
  sampleCount = 5,
}: {
  expensiveSuccess?: boolean;
  sampleCount?: number;
} = {}) => {
  const taskAnalysis = createTaskAnalysis();
  const samples = [
    ...Array.from({ length: sampleCount }, (_, index) => ({
      observedAt: `2026-09-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
      outcomeAssessment: createOutcome(`scout-${index}`, expensiveSuccess ? 'success' : 'failure'),
      policyRefs: [{ owner: 'strategy-routing', version: 1 }],
      sampleId: `scout-${index}`,
      strategyDecision: createStrategy({
        exploration: 'scout',
        fastPath: false,
        reasonCodes: ['context-scout-required', 'direct-execution'],
      }),
      taskAnalysis,
      usage: { costUnits: 5, durationMs: 50, tokens: 500 },
    })),
    ...Array.from({ length: sampleCount }, (_, index) => ({
      observedAt: `2026-09-${String(index + 11).padStart(2, '0')}T10:00:00.000Z`,
      outcomeAssessment: createOutcome(`direct-${index}`, 'success'),
      policyRefs: [{ owner: 'strategy-routing', version: 1 }],
      sampleId: `direct-${index}`,
      strategyDecision: createStrategy(),
      taskAnalysis,
      usage: { costUnits: 1, durationMs: 10, tokens: 100 },
    })),
  ];

  return {
    evalRunSamples: [],
    reportId: 'health-stage-19',
    segments: [],
    taskSamples: samples,
  };
};

const createEvalRun = (variantId: string, passed: boolean) => ({
  caseResults: [{
    caseId: 'case-routing',
    checks: [{
      actual: passed,
      expectationId: 'fast-path',
      expected: true,
      kind: 'strategy-fast-path',
      required: true,
      status: passed ? 'passed' : 'failed',
      weight: 1,
    }],
    kind: 'eval-case-result',
    schemaVersion: 1,
    score: passed ? 100 : 0,
    status: passed ? 'passed' : 'failed',
    usage: { costUnits: 1, durationMs: 10, tokens: 100 },
  }],
  corpusId: 'corpus-routing',
  executedCaseCount: 1,
  kind: 'eval-run-result',
  runId: `run-${variantId}`,
  schemaVersion: 1,
  score: passed ? 100 : 0,
  skippedCaseIds: [],
  status: 'completed',
  usage: { costUnits: 1, durationMs: 10, tokens: 100 },
  variantId,
});

const createEvalComparison = ({
  baselinePassed = true,
  candidatePassed = true,
}: {
  baselinePassed?: boolean;
  candidatePassed?: boolean;
} = {}) => {
  const baseline = createEvalRun('baseline', baselinePassed);
  const candidate = createEvalRun('candidate', candidatePassed);
  const scoreDelta = candidate.score - baseline.score;

  return {
    baseline,
    candidate,
    comparisonId: 'comparison-routing',
    improvedCaseIds: !baselinePassed && candidatePassed ? ['case-routing'] : [],
    kind: 'eval-comparison-result',
    regressedCaseIds: baselinePassed && !candidatePassed ? ['case-routing'] : [],
    schemaVersion: 1,
    scoreDelta,
    status: 'completed',
    winner: scoreDelta > 0 ? 'candidate' : scoreDelta < 0 ? 'baseline' : 'tie',
  };
};

const proposalInput = (overrides: Record<string, unknown> = {}) => ({
  confidence: 'medium',
  evidenceRefs: ['analytics:health-stage-19'],
  expectedBenefit: 'Reduce orchestration cost without reducing reliability.',
  hypothesis: 'Scout may be unnecessary for this comparable task cohort.',
  observation: 'Scout tasks cost materially more while observed reliability is comparable.',
  proposalId: 'proposal-scout-fast-path',
  proposedChange: 'Avoid Scout for this narrow routing cohort.',
  risks: ['Could miss repository context if cohort matching is wrong.'],
  sampleSize: 10,
  target: 'routing',
  ...overrides,
});

describe('Controlled Evolution', () => {
  it('exports an independent optional evolution capability with no automatic apply API', () => {
    assert.deepEqual(runtimeExports.EVOLUTION_VERSIONS, {
      api: 1,
      counterfactualPolicy: 1,
      counterfactualSchema: 1,
      decisionSchema: 1,
      proposalPolicy: 1,
      proposalSchema: 1,
      shadowSchema: 1,
    });
    assert.equal(typeof runtimeExports.createEvolutionCapability, 'function');
    assert.equal(typeof runtimeExports.analyzeCounterfactuals, 'function');
    assert.equal(typeof runtimeExports.compareShadowStrategy, 'function');
    assert.equal(typeof runtimeExports.createImprovementProposal, 'function');
    assert.equal(typeof runtimeExports.recordImprovementDecision, 'function');
    assert.equal(typeof runtimeExports.validateEvalComparisonResult, 'function');
    assert.equal(runtimeExports.applyImprovementProposal, undefined);

    const createCapability = runtimeExports.createEvolutionCapability as () => any;
    const capability = createCapability();

    assert.equal(capability.descriptor.id, 'amy.evolution');
    assert.equal(capability.descriptor.version, '1.0.0');
    assert.equal(capability.descriptor.dependencies, undefined);
    assert.equal(typeof capability.api.analyzeCounterfactuals, 'function');
    assert.equal(typeof capability.api.compareShadowStrategy, 'function');
    assert.equal(typeof capability.api.createProposal, 'function');
    assert.equal(typeof capability.api.recordDecision, 'function');
    assert.equal(capability.api.apply, undefined);
  });

  it('finds lower-cost comparable-reliability orchestration hypotheses without causal claims', () => {
    const analyzeCounterfactuals = runtimeExports.analyzeCounterfactuals as (value: unknown) => any;
    const result = analyzeCounterfactuals({
      analysisId: 'counterfactual-scout',
      analyticsInput: createAnalyticsInput(),
    });

    const scout = result.hypotheses.find(({ dimension }: any) => dimension === 'scout');
    assert.ok(scout);
    assert.equal(scout.observedChoice, 'with');
    assert.equal(scout.alternativeChoice, 'without');
    assert.equal(scout.costMetric, 'cost-units');
    assert.equal(scout.causalClaim, false);
    assert.equal(scout.sampleSize, 5);
    assert.equal(scout.reasonCodes.includes('lower-cost-comparable-reliability'), true);
    assert.ok(scout.estimatedRelativeCostReduction >= 0.7);
    assert.equal(result.causalClaim, false);
    assert.equal(result.sourceReportId, 'health-stage-19');
  });

  it('does not call a more reliable or undersampled expensive choice overkill', () => {
    const analyzeCounterfactuals = runtimeExports.analyzeCounterfactuals as (value: unknown) => any;

    const worseAlternative = analyzeCounterfactuals({
      analysisId: 'counterfactual-reliability',
      analyticsInput: createAnalyticsInput({ expensiveSuccess: true }),
    });
    assert.ok(worseAlternative.hypotheses.some(({ dimension }: any) => dimension === 'scout'));

    const insufficient = analyzeCounterfactuals({
      analysisId: 'counterfactual-small',
      analyticsInput: createAnalyticsInput({ sampleCount: 4 }),
    });
    assert.equal(insufficient.hypotheses.length, 0);

    const expensiveFails = analyzeCounterfactuals({
      analysisId: 'counterfactual-expensive-fails',
      analyticsInput: createAnalyticsInput({ expensiveSuccess: false }),
    });
    assert.ok(expensiveFails.hypotheses.some(({ dimension }: any) => dimension === 'scout'));
  });

  it('compares a host-produced shadow strategy without executing or mutating production', () => {
    const compareShadowStrategy = runtimeExports.compareShadowStrategy as (value: unknown) => any;
    const production = createStrategy({
      exploration: 'scout',
      fastPath: false,
      reasonCodes: ['context-scout-required', 'direct-execution'],
    });
    const candidate = createStrategy();

    const result = compareShadowStrategy({
      candidateDecision: candidate,
      candidateRef: 'routing-policy:v2-shadow',
      evidenceRefs: ['counterfactual:counterfactual-scout'],
      productionDecision: production,
      shadowId: 'shadow-scout',
    });

    assert.equal(result.executionPerformed, false);
    assert.equal(result.productionMutation, false);
    assert.equal(result.causalClaim, false);
    assert.ok(result.differences.some(({ dimension, productionValue, candidateValue }: any) =>
      dimension === 'exploration' && productionValue === 'scout' && candidateValue === 'none'));
    assert.deepEqual(production.data.exploration, 'scout');
  });

  it('gates proposals on evidence and eval while always requiring an explicit user decision', () => {
    const createImprovementProposal = runtimeExports.createImprovementProposal as (value: unknown) => any;

    const needsEvidence = createImprovementProposal(proposalInput({ sampleSize: 3, confidence: 'low' }));
    assert.equal(needsEvidence.recommendation, 'collect-more-evidence');

    const needsEval = createImprovementProposal(proposalInput());
    assert.equal(needsEval.recommendation, 'run-eval');

    const acceptable = createImprovementProposal(proposalInput({
      evalResult: createEvalComparison(),
    }));
    assert.equal(acceptable.recommendation, 'request-user-decision');
    assert.equal(acceptable.userDecisionRequired, true);
    assert.equal(acceptable.automaticApplication, false);
    assert.equal(acceptable.causalClaim, false);

    const regression = createImprovementProposal(proposalInput({
      evalResult: createEvalComparison({ candidatePassed: false }),
    }));
    assert.equal(regression.recommendation, 'do-not-adopt');
  });

  it('records only an explicit user decision and never applies the proposal', () => {
    const createImprovementProposal = runtimeExports.createImprovementProposal as (value: unknown) => any;
    const recordImprovementDecision = runtimeExports.recordImprovementDecision as (value: unknown) => any;
    const proposal = createImprovementProposal(proposalInput({ evalResult: createEvalComparison() }));

    const decision = recordImprovementDecision({
      decision: 'approved',
      decidedBy: 'user',
      note: 'Apply this change manually in the next policy edit.',
      proposal,
    });

    assert.equal(decision.proposalId, proposal.proposalId);
    assert.equal(decision.decision, 'approved');
    assert.equal(decision.decidedBy, 'user');
    assert.equal(decision.automaticApplication, false);
    assert.equal(decision.kind, 'improvement-decision');
  });


  it('rejects completed eval comparisons that do not cover the same case ids', () => {
    const createImprovementProposal = runtimeExports.createImprovementProposal as (value: unknown) => any;
    const comparison = createEvalComparison();
    const candidate = {
      ...comparison.candidate,
      caseResults: comparison.candidate.caseResults.map((result: any) => ({
        ...result,
        caseId: 'case-other',
      })),
    };

    assert.throws(
      () => createImprovementProposal(proposalInput({
        evalResult: {
          ...comparison,
          candidate,
          improvedCaseIds: [],
          regressedCaseIds: [],
        },
      })),
      /same case ids/i,
    );
  });

  it('rejects forged proposal recommendations that do not match their evidence', () => {
    const createImprovementProposal = runtimeExports.createImprovementProposal as (value: unknown) => any;
    const recordImprovementDecision = runtimeExports.recordImprovementDecision as (value: unknown) => any;
    const proposal = createImprovementProposal(proposalInput({ sampleSize: 3, confidence: 'low' }));
    const forged = {
      ...proposal,
      recommendation: 'request-user-decision',
      reasonCodes: ['eval-candidate-safe'],
    };

    assert.throws(
      () => recordImprovementDecision({
        decision: 'approved',
        decidedBy: 'user',
        proposal: forged,
      }),
      /recommendation.*evidence|policy/i,
    );
  });

  it('rejects forged eval aggregates before using them as proposal evidence', () => {
    const createImprovementProposal = runtimeExports.createImprovementProposal as (value: unknown) => any;
    const invalid = {
      ...createEvalComparison(),
      scoreDelta: 999,
    };

    assert.throws(
      () => createImprovementProposal(proposalInput({ evalResult: invalid })),
      /score delta/i,
    );
  });
});
