import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as Runtime from '../dist/index.js';
import {
  AmyRuntimeError,
  classifyTask,
  runCompletionProtocol,
  runVerificationPipeline,
} from '../dist/index.js';

const runtimeExports = Runtime as unknown as Record<string, unknown>;

const createFailedCompletion = (guard = { maxRetries: 2, retryCount: 0 }) => {
  const taskAnalysis = classifyTask({
    contract: {
      acceptanceCriteria: ['Recovery remains branch-scoped.'],
      affectedScope: { kind: 'local', targets: ['runtime/src/recovery'] },
      goal: 'Recover from one concrete failure.',
      kind: 'task-contract',
      requirements: ['Diagnose before recovery.'],
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
      evidenceRefs: ['evidence:tests'],
      id: 'tests',
      kind: 'test',
      label: 'Runtime tests',
      status: 'passed',
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
    verificationId: 'verification-recovery',
  });

  return runCompletionProtocol({
    completionId: 'completion-recovery',
    execution: {
      evidenceRefs: ['evidence:worker-failure'],
      reason: 'Worker failed to apply the requested change.',
      status: 'failed',
      unresolvedIssues: ['Implementation is incomplete.'],
    },
    guard,
    integration: {
      evidenceRefs: [],
      reason: 'Integration is not reached while implementation is failed.',
      status: 'not-required',
    },
    taskAnalysis,
    verificationResult,
  });
};

const createRecovery = () => {
  const createRecoveryCapability = runtimeExports.createRecoveryCapability as (options?: unknown) => {
    api: { recover: (value: unknown) => any };
    descriptor: { dependencies?: unknown; id: string; version: string };
  };

  return createRecoveryCapability();
};

describe('Recovery', () => {
  it('exports an independent deterministic recovery capability', () => {
    assert.deepEqual(runtimeExports.RECOVERY_VERSIONS, {
      api: 1,
      diagnosisSchema: 1,
      planSchema: 1,
      policy: 1,
    });
    assert.equal(typeof runtimeExports.createRecoveryCapability, 'function');
    assert.equal(typeof runtimeExports.validateRecoveryPlan, 'function');

    const capability = createRecovery();

    assert.equal(capability.descriptor.id, 'amy.recovery');
    assert.equal(capability.descriptor.version, '1.0.0');
    assert.equal(capability.descriptor.dependencies, undefined);
    assert.equal(typeof capability.api.recover, 'function');
  });

  it('diagnoses implementation failure before delegating the failing branch to Debugger', () => {
    const result = createRecovery().api.recover({
      completionResult: createFailedCompletion(),
      escalationCount: 0,
      failure: {
        branch: { id: 'dag:worker-2', kind: 'dag-node' },
        directRetryAllowed: false,
        evidenceRefs: ['evidence:stack-trace'],
        failureClass: 'implementation',
        summary: 'Worker produced an invalid patch.',
      },
      preservedFacts: [{
        ref: 'fact:public-contract',
        summary: 'The public runtime API must remain backward compatible.',
      }],
      recoveryId: 'recovery-implementation',
    });

    assert.equal(result.kind, 'execution-plan');
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.data.action, 'debugger');
    assert.equal(result.data.diagnosis.failureClass, 'implementation');
    assert.deepEqual(result.data.diagnosis.branch, { id: 'dag:worker-2', kind: 'dag-node' });
    assert.deepEqual(result.data.preservedFacts, [{
      ref: 'fact:public-contract',
      summary: 'The public runtime API must remain backward compatible.',
    }]);
    assert.equal(result.data.attempt.retryCount, 0);
    assert.equal(result.data.attempt.nextRetryCount, 1);
    assert.equal(result.data.requiresVerification, true);
    assert.ok(result.data.reasonCodes.includes('failure-diagnosed'));
    assert.ok(result.data.reasonCodes.includes('debugger-required'));
  });

  it('validates canonical Recovery plans for downstream consumers', () => {
    const plan = createRecovery().api.recover({
      completionResult: createFailedCompletion(),
      escalationCount: 0,
      failure: {
        branch: { id: 'task:validator', kind: 'task' },
        directRetryAllowed: false,
        evidenceRefs: ['evidence:validator'],
        failureClass: 'implementation',
        summary: 'Validate the canonical Recovery output boundary.',
      },
      recoveryId: 'recovery-validator',
    });
    const validateRecoveryPlan = runtimeExports.validateRecoveryPlan as (value: unknown) => any;

    assert.deepEqual(validateRecoveryPlan(plan), plan);
    assert.throws(
      () => validateRecoveryPlan({
        ...plan,
        data: { ...plan.data, policyVersion: 999 },
      }),
      (error: unknown) => error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });

  it('maps concrete failure classes to existing canonical recovery mechanisms', () => {
    const completionResult = createFailedCompletion();
    const cases = [
      ['context-understanding', false, 'context-expand'],
      ['architecture-uncertainty', false, 'compute-escalate'],
      ['tool', true, 'retry'],
      ['verification', false, 'debugger'],
      ['integration', false, 'debugger'],
    ] as const;

    cases.forEach(([failureClass, directRetryAllowed, action]) => {
      const result = createRecovery().api.recover({
        completionResult,
        escalationCount: 0,
        failure: {
          branch: { id: `branch:${failureClass}`, kind: failureClass === 'verification' ? 'verification' : 'task' },
          directRetryAllowed,
          evidenceRefs: [`evidence:${failureClass}`],
          failureClass,
          summary: `Concrete ${failureClass} signal.`,
        },
        recoveryId: `recovery-${failureClass}`,
      });

      assert.equal(result.data.action, action);
      assert.equal(result.data.requiresVerification, true);
    });
  });

  it('never overrides a terminal Completion guard with another retry', () => {
    const result = createRecovery().api.recover({
      completionResult: createFailedCompletion({ maxRetries: 0, retryCount: 0 }),
      escalationCount: 0,
      failure: {
        branch: { id: 'task:root', kind: 'task' },
        directRetryAllowed: true,
        evidenceRefs: ['evidence:tool-failure'],
        failureClass: 'tool',
        summary: 'The tool failed deterministically.',
      },
      recoveryId: 'recovery-terminal',
    });

    assert.equal(result.data.action, 'stop');
    assert.equal(result.data.requiresVerification, false);
    assert.equal(result.data.attempt.nextRetryCount, undefined);
    assert.ok(result.data.reasonCodes.includes('completion-guard-terminal'));
  });

  it('does not directly retry a tool failure unless the diagnosis explicitly allows it', () => {
    const result = createRecovery().api.recover({
      completionResult: createFailedCompletion(),
      escalationCount: 0,
      failure: {
        branch: { id: 'task:tooling', kind: 'task' },
        directRetryAllowed: false,
        evidenceRefs: ['evidence:missing-command'],
        failureClass: 'tool',
        summary: 'The required command is unavailable, so repeating it is not useful.',
      },
      recoveryId: 'recovery-non-retryable-tool',
    });

    assert.equal(result.data.action, 'stop');
    assert.equal(result.data.requiresVerification, false);
    assert.ok(result.data.reasonCodes.includes('direct-retry-not-authorized'));
  });

  it('stops compute escalation when its independent escalation budget is exhausted', () => {
    const result = createRecovery().api.recover({
      completionResult: createFailedCompletion(),
      escalationCount: 1,
      failure: {
        branch: { id: 'task:architecture', kind: 'task' },
        directRetryAllowed: false,
        evidenceRefs: ['evidence:architecture-conflict'],
        failureClass: 'architecture-uncertainty',
        summary: 'Two incompatible architecture constraints remain unresolved.',
      },
      recoveryId: 'recovery-escalation-budget',
    });

    assert.equal(result.data.action, 'stop');
    assert.equal(result.data.requiresVerification, false);
    assert.equal(result.data.attempt.nextRetryCount, undefined);
    assert.equal(result.data.attempt.nextEscalationCount, undefined);
    assert.ok(result.data.reasonCodes.includes('escalation-budget-exhausted'));
  });

  it('rejects recovery without concrete failure evidence', () => {
    assert.throws(
      () => createRecovery().api.recover({
        completionResult: createFailedCompletion(),
        escalationCount: 0,
        failure: {
          branch: { id: 'task:root', kind: 'task' },
          directRetryAllowed: true,
          evidenceRefs: [],
          failureClass: 'tool',
          summary: 'Retry because something failed.',
        },
        recoveryId: 'recovery-no-evidence',
      }),
      (error: unknown) => error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });
});
