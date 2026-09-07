import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AmyRuntimeError,
  VERIFICATION_VERSIONS,
  createVerificationCapability,
  runVerificationPipeline,
} from '../dist/index.js';

const createTaskAnalysis = (
  options: {
    acceptanceCriteria?: readonly string[];
    requirements?: readonly string[];
    verificationExpectations?: readonly string[];
  } = {},
) => ({
  data: {
    classification: {
      confidence: 'high',
      dimensions: {
        blastRadius: 'module',
        complexity: 'medium',
        coupling: 'medium',
        expectedContextCost: 'medium',
        novelty: 'medium',
        parallelizability: 'low',
        risk: 'medium',
        scope: 'module',
        uncertainty: 'low',
        verificationCost: 'medium',
      },
      evidenceGaps: [],
      mode: 'text-only',
      reasonCodes: ['requirements-present', 'verification-explicit'],
      schemaVersion: 1,
    },
    contract: {
      acceptanceCriteria: options.acceptanceCriteria ?? ['Public API remains compatible.'],
      affectedScope: { kind: 'module', targets: ['runtime/src/verification'] },
      constraints: ['Keep optional capabilities optional.'],
      goal: 'Verify a runtime change.',
      kind: 'task-contract',
      nonGoals: ['Do not rewrite unrelated runtime modules.'],
      requirements: options.requirements ?? ['Implement the requested runtime behavior.'],
      schemaVersion: 1,
      uncertainties: [],
      verificationExpectations: options.verificationExpectations ?? ['Run tests.'],
    },
  },
  kind: 'task-analysis',
  schemaVersion: 1,
});

const createStrategyDecision = (
  overrides: Partial<{ review: 'none' | 'reviewer'; verification: 'none' | 'verifier' }> = {},
) => ({
  data: {
    confidence: 'high',
    escalation: 'none',
    execution: 'direct',
    exploration: 'none',
    fastPath: false,
    planning: 'none',
    policyVersion: 1,
    reasonCodes: ['direct-execution'],
    review: overrides.review ?? 'none',
    verification: overrides.verification ?? 'none',
  },
  kind: 'execution-strategy',
  schemaVersion: 1,
});

const createBaseInput = (
  overrides: Readonly<Record<string, unknown>> = {},
) => ({
  artifacts: {
    implementationResultRef: 'artifact:implementation',
    taskAnalysisRef: 'artifact:task-analysis',
    ...(overrides.artifacts as object | undefined),
  },
  mechanicalChecks: [
    {
      evidenceRefs: ['evidence:test-output'],
      id: 'tests',
      kind: 'test',
      label: 'Runtime test suite',
      status: 'passed',
    },
  ],
  strategyDecision: createStrategyDecision(),
  taskAnalysis: createTaskAnalysis(),
  verificationId: 'verification-42',
  ...overrides,
});

const createAgentResult = (
  role: 'reviewer' | 'verifier',
  handoffId: string,
  outputKind: 'review-findings' | 'verification-result',
) => ({
  childHandoffIds: [],
  evidence: [{ kind: 'finding', ref: 'agent:evidence', summary: 'Agent evidence.' }],
  handoffId,
  kind: 'agent-handoff-result',
  outputs: [{ kind: outputKind, ref: 'agent:output', summary: 'Agent result.' }],
  role,
  schemaVersion: 1,
  status: 'completed',
  summary: 'Completed.',
  unresolvedIssues: [],
});

describe('Verification', () => {
  it('экспортирует independent deterministic capability без shell executor dependency', () => {
    assert.deepEqual(VERIFICATION_VERSIONS, {
      api: 1,
      policy: 1,
      reportSchema: 1,
      resultSchema: 1,
    });

    const capability = createVerificationCapability();

    assert.equal(capability.descriptor.id, 'amy.verification');
    assert.equal(capability.descriptor.version, '1.0.0');
    assert.equal(capability.descriptor.dependencies, undefined);
    assert.equal(typeof capability.api.verify, 'function');
  });

  it('принимает mechanical evidence и не запускает Verifier/Reviewer без routing signal', () => {
    const result = runVerificationPipeline(createBaseInput());

    assert.equal(result.kind, 'quality-result');
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.data.status, 'passed');
    assert.equal(result.data.mechanical.status, 'passed');
    assert.equal(result.data.semantic.status, 'not-required');
    assert.equal(result.data.review.status, 'not-required');
    assert.equal(result.data.semantic.handoff, undefined);
    assert.equal(result.data.review.handoff, undefined);
  });

  it('создаёт bounded read-only handoffs только когда Strategy Router запросил Verifier и Reviewer', () => {
    const result = runVerificationPipeline(createBaseInput({
      artifacts: {
        contextPacketRef: 'artifact:context',
        implementationResultRef: 'artifact:implementation',
        taskAnalysisRef: 'artifact:task-analysis',
      },
      strategyDecision: createStrategyDecision({ review: 'reviewer', verification: 'verifier' }),
    }));

    assert.equal(result.data.status, 'pending');
    assert.equal(result.data.semantic.status, 'pending');
    assert.equal(result.data.review.status, 'pending');
    assert.equal(result.data.semantic.handoff?.targetRole, 'verifier');
    assert.equal(result.data.semantic.handoff?.scope.writeTargets.length, 0);
    assert.equal(result.data.review.handoff?.targetRole, 'reviewer');
    assert.equal(result.data.review.handoff?.scope.writeTargets.length, 0);
    assert.ok(result.data.semantic.handoff?.inputs.some(({ kind }) => kind === 'verification-evidence'));
    assert.ok(result.data.review.handoff?.inputs.some(({ kind }) => kind === 'context-packet'));
  });

  it('считает semantic verification пройденной только при evidence для каждого requirement/criterion', () => {
    const pending = runVerificationPipeline(createBaseInput({
      strategyDecision: createStrategyDecision({ verification: 'verifier' }),
    }));
    const handoffId = pending.data.semantic.handoff?.handoffId;

    assert.ok(handoffId);

    const result = runVerificationPipeline(createBaseInput({
      strategyDecision: createStrategyDecision({ verification: 'verifier' }),
      verifierReport: {
        criteria: [
          {
            evidenceRefs: ['evidence:req'],
            kind: 'requirement',
            status: 'met',
            subject: 'Implement the requested runtime behavior.',
          },
          {
            evidenceRefs: ['evidence:criterion'],
            kind: 'acceptance-criterion',
            status: 'met',
            subject: 'Public API remains compatible.',
          },
        ],
        kind: 'verifier-report',
        result: createAgentResult('verifier', handoffId, 'verification-result'),
        schemaVersion: 1,
      },
    }));

    assert.equal(result.data.semantic.status, 'passed');
    assert.equal(result.data.status, 'passed');
  });

  it('не трактует skipped/unavailable mechanical checks или missing evidence как success', () => {
    const skipped = runVerificationPipeline(createBaseInput({
      mechanicalChecks: [{
        evidenceRefs: [],
        id: 'typecheck',
        kind: 'typecheck',
        label: 'Typecheck',
        reason: 'Tool unavailable',
        status: 'unavailable',
      }],
    }));
    const missing = runVerificationPipeline(createBaseInput({
      mechanicalChecks: [],
    }));

    assert.equal(skipped.data.mechanical.status, 'unverified');
    assert.equal(skipped.data.status, 'unverified');
    assert.equal(missing.data.mechanical.status, 'unverified');
    assert.equal(missing.data.status, 'unverified');
  });

  it('делает failed mechanical check hard quality failure', () => {
    const result = runVerificationPipeline(createBaseInput({
      mechanicalChecks: [{
        evidenceRefs: ['evidence:failure'],
        id: 'build',
        kind: 'build',
        label: 'Build',
        status: 'failed',
      }],
    }));

    assert.equal(result.data.mechanical.status, 'failed');
    assert.equal(result.data.status, 'failed');
    assert.ok(result.data.reasonCodes.includes('mechanical-check-failed'));
  });

  it('не пропускает semantic gaps и required reviewer findings', () => {
    const routed = createStrategyDecision({ review: 'reviewer', verification: 'verifier' });
    const pending = runVerificationPipeline(createBaseInput({ strategyDecision: routed }));
    const verifierHandoffId = pending.data.semantic.handoff?.handoffId;
    const reviewerHandoffId = pending.data.review.handoff?.handoffId;

    assert.ok(verifierHandoffId);
    assert.ok(reviewerHandoffId);

    const result = runVerificationPipeline(createBaseInput({
      reviewerReport: {
        findings: [{
          evidenceRefs: ['evidence:review'],
          severity: 'required',
          summary: 'Public API regression.',
        }],
        kind: 'reviewer-report',
        result: createAgentResult('reviewer', reviewerHandoffId, 'review-findings'),
        schemaVersion: 1,
      },
      strategyDecision: routed,
      verifierReport: {
        criteria: [{
          evidenceRefs: [],
          kind: 'requirement',
          status: 'unknown',
          subject: 'Implement the requested runtime behavior.',
        }],
        kind: 'verifier-report',
        result: createAgentResult('verifier', verifierHandoffId, 'verification-result'),
        schemaVersion: 1,
      },
    }));

    assert.equal(result.data.semantic.status, 'unverified');
    assert.equal(result.data.review.status, 'failed');
    assert.equal(result.data.status, 'failed');
  });

  it('считает execution failure Verifier evidence gap, а не доказанным semantic failure', () => {
    const strategyDecision = createStrategyDecision({ verification: 'verifier' });
    const pending = runVerificationPipeline(createBaseInput({ strategyDecision }));
    const handoffId = pending.data.semantic.handoff?.handoffId;

    assert.ok(handoffId);

    const result = runVerificationPipeline(createBaseInput({
      strategyDecision,
      verifierReport: {
        criteria: [],
        kind: 'verifier-report',
        result: {
          ...createAgentResult('verifier', handoffId, 'verification-result'),
          status: 'failed',
          unresolvedIssues: ['Verifier execution failed.'],
        },
        schemaVersion: 1,
      },
    }));

    assert.equal(result.data.semantic.status, 'unverified');
    assert.ok(result.data.reasonCodes.includes('semantic-unverified'));
  });

  it('отклоняет report неправильной роли и неизвестные input fields', () => {
    const pending = runVerificationPipeline(createBaseInput({
      strategyDecision: createStrategyDecision({ verification: 'verifier' }),
    }));
    const handoffId = pending.data.semantic.handoff?.handoffId;

    assert.ok(handoffId);

    assert.throws(
      () => runVerificationPipeline({
        ...createBaseInput({ strategyDecision: createStrategyDecision({ verification: 'verifier' }) }),
        verifierReport: {
          criteria: [],
          kind: 'verifier-report',
          result: createAgentResult('reviewer', handoffId, 'review-findings'),
          schemaVersion: 1,
        },
      }),
      (error: unknown) => error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );

    assert.throws(
      () => runVerificationPipeline({ ...createBaseInput(), extra: true }),
      (error: unknown) => error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );

    assert.throws(
      () => runVerificationPipeline(createBaseInput({
        mechanicalChecks: [{
          evidenceRefs: [],
          id: 'tests',
          kind: 'test',
          label: 'Tests',
          status: 'failed',
        }],
      })),
      (error: unknown) => error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });
});
