import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as Runtime from '../dist/index.js';
import { AmyRuntimeError, classifyTask, runVerificationPipeline } from '../dist/index.js';

const runtimeExports = Runtime as unknown as Record<string, unknown>;

describe('Completion', () => {
  it('exports an independent deterministic completion capability', () => {
    assert.deepEqual(runtimeExports.COMPLETION_VERSIONS, {
      api: 1,
      evidenceSchema: 1,
      policy: 1,
      resultSchema: 1,
    });
    assert.equal(typeof runtimeExports.createCompletionCapability, 'function');

    const createCompletionCapability = runtimeExports.createCompletionCapability as () => {
      api: { complete: (value: unknown) => unknown };
      descriptor: {
        dependencies?: unknown;
        id: string;
        version: string;
      };
    };
    const capability = createCompletionCapability();

    assert.equal(capability.descriptor.id, 'amy.completion');
    assert.equal(capability.descriptor.version, '1.0.0');
    assert.equal(capability.descriptor.dependencies, undefined);
    assert.equal(typeof capability.api.complete, 'function');
  });

  it('completes only from execution, integration, and passed verification evidence', () => {
    const taskAnalysis = classifyTask({
      contract: {
        acceptanceCriteria: ['Public API remains compatible.'],
        affectedScope: { kind: 'local', targets: ['runtime/src/completion'] },
        goal: 'Evaluate completion evidence.',
        kind: 'task-contract',
        requirements: ['Implement the completion protocol.'],
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
      verificationId: 'verification-complete',
    });
    const createCompletionCapability = runtimeExports.createCompletionCapability as () => {
      api: { complete: (value: unknown) => any };
    };

    const result = createCompletionCapability().api.complete({
      completionId: 'completion-1',
      execution: {
        evidenceRefs: ['evidence:implementation'],
        status: 'completed',
        unresolvedIssues: [],
      },
      guard: { maxRetries: 2, retryCount: 0 },
      integration: {
        evidenceRefs: [],
        reason: 'No integration step is required.',
        status: 'not-required',
      },
      taskAnalysis,
      verificationResult,
    });

    assert.equal(result.kind, 'quality-result');
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.data.status, 'complete');
    assert.equal(result.data.confidence, 'high');
    assert.equal(result.data.guard.decision, 'complete');
    assert.deepEqual(result.data.evidence.requirements, ['Implement the completion protocol.']);
    assert.deepEqual(result.data.evidence.acceptanceCriteria, ['Public API remains compatible.']);
    assert.equal(result.data.evidence.checks.length, 1);
    assert.deepEqual(result.data.evidence.skippedChecks, []);
  });


  it('keeps verification gaps unverified and allows only a bounded guard retry', () => {
    const taskAnalysis = classifyTask({
      contract: {
        affectedScope: { kind: 'local', targets: ['runtime/src/completion'] },
        goal: 'Evaluate completion evidence.',
        kind: 'task-contract',
        schemaVersion: 1,
        uncertainties: [],
        verificationExpectations: ['Run typecheck'],
      },
    });
    const verificationResult = runVerificationPipeline({
      artifacts: {
        implementationResultRef: 'artifact:implementation',
        taskAnalysisRef: 'artifact:task-analysis',
      },
      mechanicalChecks: [{
        evidenceRefs: [],
        id: 'typecheck',
        kind: 'typecheck',
        label: 'Typecheck',
        reason: 'Tool unavailable',
        status: 'unavailable',
      }],
      strategyDecision: {
        data: {
          confidence: 'high', escalation: 'none', execution: 'direct', exploration: 'none',
          fastPath: false, planning: 'none', policyVersion: 1,
          reasonCodes: ['direct-execution'], review: 'none', verification: 'none',
        },
        kind: 'execution-strategy', schemaVersion: 1,
      },
      taskAnalysis,
      verificationId: 'verification-gap',
    });
    const createCompletionCapability = runtimeExports.createCompletionCapability as () => {
      api: { complete: (value: unknown) => any };
    };

    const result = createCompletionCapability().api.complete({
      completionId: 'completion-gap',
      execution: {
        evidenceRefs: ['evidence:implementation'], status: 'completed', unresolvedIssues: [],
      },
      guard: { maxRetries: 2, retryCount: 1 },
      integration: {
        evidenceRefs: [], reason: 'No integration step is required.', status: 'not-required',
      },
      taskAnalysis,
      verificationResult,
    });

    assert.equal(result.data.status, 'unverified');
    assert.equal(result.data.confidence, 'low');
    assert.equal(result.data.guard.decision, 'retry');
    assert.equal(result.data.guard.retriesRemaining, 1);
    assert.deepEqual(result.data.evidence.skippedChecks.map(({ id }: { id: string }) => id), ['typecheck']);
    assert.ok(result.data.evidence.evidenceGaps.includes('verification:mechanical-check-gap'));
    assert.ok(result.data.reasonCodes.includes('verification-unverified'));
    assert.ok(result.data.reasonCodes.includes('guard-retry-allowed'));
  });


  it('rejects completed execution without concrete evidence', () => {
    const taskAnalysis = classifyTask({
      contract: {
        affectedScope: { kind: 'local', targets: ['runtime/src/completion'] },
        goal: 'Evaluate completion evidence.',
        kind: 'task-contract',
        schemaVersion: 1,
        uncertainties: [],
        verificationExpectations: [],
      },
    });
    const verificationResult = runVerificationPipeline({
      artifacts: {
        implementationResultRef: 'artifact:implementation',
        taskAnalysisRef: 'artifact:task-analysis',
      },
      mechanicalChecks: [],
      strategyDecision: {
        data: {
          confidence: 'high', escalation: 'none', execution: 'direct', exploration: 'none',
          fastPath: true, planning: 'none', policyVersion: 1,
          reasonCodes: ['fast-path'], review: 'none', verification: 'none',
        },
        kind: 'execution-strategy', schemaVersion: 1,
      },
      taskAnalysis,
      verificationId: 'verification-no-checks',
    });
    const createCompletionCapability = runtimeExports.createCompletionCapability as () => {
      api: { complete: (value: unknown) => any };
    };

    assert.throws(
      () => createCompletionCapability().api.complete({
        completionId: 'completion-invalid-evidence',
        execution: { evidenceRefs: [], status: 'completed', unresolvedIssues: [] },
        integration: {
          evidenceRefs: [], reason: 'No integration step is required.', status: 'not-required',
        },
        taskAnalysis,
        verificationResult,
      }),
      (error: unknown) => error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });


  it('returns a legitimate incomplete stop result and preserves integration issues', () => {
    const taskAnalysis = classifyTask({
      contract: {
        affectedScope: { kind: 'local', targets: ['runtime/src/completion'] },
        goal: 'Evaluate completion evidence.',
        kind: 'task-contract',
        schemaVersion: 1,
        uncertainties: [],
        verificationExpectations: [],
      },
    });
    const verificationResult = runVerificationPipeline({
      artifacts: {
        implementationResultRef: 'artifact:implementation',
        taskAnalysisRef: 'artifact:task-analysis',
      },
      mechanicalChecks: [],
      strategyDecision: {
        data: {
          confidence: 'high', escalation: 'none', execution: 'direct', exploration: 'none',
          fastPath: true, planning: 'none', policyVersion: 1,
          reasonCodes: ['fast-path'], review: 'none', verification: 'none',
        },
        kind: 'execution-strategy', schemaVersion: 1,
      },
      taskAnalysis,
      verificationId: 'verification-incomplete',
    });
    const createCompletionCapability = runtimeExports.createCompletionCapability as () => {
      api: { complete: (value: unknown) => any };
    };

    const result = createCompletionCapability().api.complete({
      completionId: 'completion-incomplete',
      execution: {
        evidenceRefs: ['evidence:implementation'], status: 'completed', unresolvedIssues: [],
      },
      guard: { maxRetries: 0, retryCount: 0 },
      integration: {
        evidenceRefs: [], reason: 'Generated artifacts are not integrated yet.', status: 'incomplete',
      },
      taskAnalysis,
      verificationResult,
    });

    assert.equal(result.data.status, 'incomplete');
    assert.equal(result.data.confidence, 'medium');
    assert.equal(result.data.guard.decision, 'stop-incomplete');
    assert.deepEqual(result.data.evidence.unresolvedIssues, [
      'Generated artifacts are not integrated yet.',
    ]);
    assert.ok(result.data.reasonCodes.includes('guard-retry-exhausted'));
  });


  it('rejects malformed upstream verification results instead of trusting arbitrary quality data', () => {
    const taskAnalysis = classifyTask({
      contract: {
        affectedScope: { kind: 'local', targets: ['runtime/src/completion'] },
        goal: 'Evaluate completion evidence.',
        kind: 'task-contract',
        schemaVersion: 1,
        uncertainties: [],
        verificationExpectations: [],
      },
    });
    const verificationResult = runVerificationPipeline({
      artifacts: {
        implementationResultRef: 'artifact:implementation',
        taskAnalysisRef: 'artifact:task-analysis',
      },
      mechanicalChecks: [],
      strategyDecision: {
        data: {
          confidence: 'high', escalation: 'none', execution: 'direct', exploration: 'none',
          fastPath: true, planning: 'none', policyVersion: 1,
          reasonCodes: ['fast-path'], review: 'none', verification: 'none',
        },
        kind: 'execution-strategy', schemaVersion: 1,
      },
      taskAnalysis,
      verificationId: 'verification-malformed',
    });
    const createCompletionCapability = runtimeExports.createCompletionCapability as () => {
      api: { complete: (value: unknown) => any };
    };

    assert.throws(
      () => createCompletionCapability().api.complete({
        completionId: 'completion-malformed-verification',
        execution: {
          evidenceRefs: ['evidence:implementation'], status: 'completed', unresolvedIssues: [],
        },
        integration: {
          evidenceRefs: [], reason: 'No integration step is required.', status: 'not-required',
        },
        taskAnalysis,
        verificationResult: {
          ...verificationResult,
          data: { ...verificationResult.data, status: 'made-up-status' },
        },
      }),
      (error: unknown) => error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });


  it('stops a failed result after the guard retry budget is exhausted', () => {
    const taskAnalysis = classifyTask({
      contract: {
        affectedScope: { kind: 'local', targets: ['runtime/src/completion'] },
        goal: 'Evaluate completion evidence.',
        kind: 'task-contract',
        schemaVersion: 1,
        uncertainties: [],
        verificationExpectations: ['Run build'],
      },
    });
    const verificationResult = runVerificationPipeline({
      artifacts: {
        implementationResultRef: 'artifact:implementation',
        taskAnalysisRef: 'artifact:task-analysis',
      },
      mechanicalChecks: [{
        evidenceRefs: ['evidence:build-failure'], id: 'build', kind: 'build', label: 'Build', status: 'failed',
      }],
      strategyDecision: {
        data: {
          confidence: 'high', escalation: 'none', execution: 'direct', exploration: 'none',
          fastPath: false, planning: 'none', policyVersion: 1,
          reasonCodes: ['direct-execution'], review: 'none', verification: 'none',
        },
        kind: 'execution-strategy', schemaVersion: 1,
      },
      taskAnalysis,
      verificationId: 'verification-failed',
    });
    const createCompletionCapability = runtimeExports.createCompletionCapability as () => {
      api: { complete: (value: unknown) => any };
    };

    const result = createCompletionCapability().api.complete({
      completionId: 'completion-failed',
      execution: {
        evidenceRefs: ['evidence:implementation'], status: 'completed', unresolvedIssues: [],
      },
      guard: { maxRetries: 1, retryCount: 1 },
      integration: {
        evidenceRefs: [], reason: 'No integration step is required.', status: 'not-required',
      },
      taskAnalysis,
      verificationResult,
    });

    assert.equal(result.data.status, 'failed');
    assert.equal(result.data.confidence, 'high');
    assert.equal(result.data.guard.decision, 'stop-failed');
    assert.equal(result.data.guard.retriesRemaining, 0);
    assert.ok(result.data.reasonCodes.includes('verification-failed'));
    assert.ok(result.data.reasonCodes.includes('guard-retry-exhausted'));
  });

  it('treats required review that has not run as incomplete, not complete', () => {
    const taskAnalysis = classifyTask({
      contract: {
        affectedScope: { kind: 'local', targets: ['runtime/src/completion'] },
        goal: 'Evaluate completion evidence.',
        kind: 'task-contract',
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
        evidenceRefs: ['evidence:tests'], id: 'tests', kind: 'test', label: 'Tests', status: 'passed',
      }],
      strategyDecision: {
        data: {
          confidence: 'high', escalation: 'none', execution: 'direct', exploration: 'none',
          fastPath: false, planning: 'none', policyVersion: 1,
          reasonCodes: ['reviewer-risk-justified'], review: 'reviewer', verification: 'none',
        },
        kind: 'execution-strategy', schemaVersion: 1,
      },
      taskAnalysis,
      verificationId: 'verification-review-pending',
    });
    const createCompletionCapability = runtimeExports.createCompletionCapability as () => {
      api: { complete: (value: unknown) => any };
    };

    const result = createCompletionCapability().api.complete({
      completionId: 'completion-review-pending',
      execution: {
        evidenceRefs: ['evidence:implementation'], status: 'completed', unresolvedIssues: [],
      },
      integration: {
        evidenceRefs: [], reason: 'No integration step is required.', status: 'not-required',
      },
      taskAnalysis,
      verificationResult,
    });

    assert.equal(verificationResult.data.review.status, 'pending');
    assert.equal(result.data.status, 'incomplete');
    assert.equal(result.data.guard.decision, 'retry');
    assert.ok(result.data.reasonCodes.includes('verification-pending'));
  });

  it('rejects guard budgets above the hard loop-protection cap', () => {
    const taskAnalysis = classifyTask({
      contract: {
        affectedScope: { kind: 'local', targets: ['runtime/src/completion'] },
        goal: 'Evaluate completion evidence.',
        kind: 'task-contract', schemaVersion: 1, uncertainties: [], verificationExpectations: [],
      },
    });
    const verificationResult = runVerificationPipeline({
      artifacts: {
        implementationResultRef: 'artifact:implementation', taskAnalysisRef: 'artifact:task-analysis',
      },
      mechanicalChecks: [],
      strategyDecision: {
        data: {
          confidence: 'high', escalation: 'none', execution: 'direct', exploration: 'none', fastPath: true,
          planning: 'none', policyVersion: 1, reasonCodes: ['fast-path'], review: 'none', verification: 'none',
        },
        kind: 'execution-strategy', schemaVersion: 1,
      },
      taskAnalysis,
      verificationId: 'verification-loop-cap',
    });
    const createCompletionCapability = runtimeExports.createCompletionCapability as () => {
      api: { complete: (value: unknown) => any };
    };

    assert.throws(
      () => createCompletionCapability().api.complete({
        completionId: 'completion-loop-cap',
        execution: {
          evidenceRefs: ['evidence:implementation'], status: 'completed', unresolvedIssues: [],
        },
        guard: { maxRetries: 6, retryCount: 0 },
        integration: {
          evidenceRefs: [], reason: 'No integration step is required.', status: 'not-required',
        },
        taskAnalysis,
        verificationResult,
      }),
      (error: unknown) => error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });


  it('falls back to the task goal when optional requirement lists are empty', () => {
    const taskAnalysis = classifyTask({
      contract: {
        acceptanceCriteria: [],
        affectedScope: { kind: 'local', targets: ['runtime/src/completion'] },
        goal: 'Use the task goal as completion evidence baseline.',
        kind: 'task-contract',
        requirements: [],
        schemaVersion: 1,
        uncertainties: [],
        verificationExpectations: [],
      },
    });
    const verificationResult = runVerificationPipeline({
      artifacts: {
        implementationResultRef: 'artifact:implementation',
        taskAnalysisRef: 'artifact:task-analysis',
      },
      mechanicalChecks: [],
      strategyDecision: {
        data: {
          confidence: 'high', escalation: 'none', execution: 'direct', exploration: 'none',
          fastPath: true, planning: 'none', policyVersion: 1,
          reasonCodes: ['fast-path'], review: 'none', verification: 'none',
        },
        kind: 'execution-strategy', schemaVersion: 1,
      },
      taskAnalysis,
      verificationId: 'verification-empty-lists',
    });
    const createCompletionCapability = runtimeExports.createCompletionCapability as () => {
      api: { complete: (value: unknown) => any };
    };

    const result = createCompletionCapability().api.complete({
      completionId: 'completion-empty-lists',
      execution: {
        evidenceRefs: ['evidence:implementation'], status: 'completed', unresolvedIssues: [],
      },
      integration: {
        evidenceRefs: [], reason: 'No integration step is required.', status: 'not-required',
      },
      taskAnalysis,
      verificationResult,
    });

    assert.deepEqual(result.data.evidence.requirements, [taskAnalysis.data.contract.goal]);
    assert.deepEqual(result.data.evidence.acceptanceCriteria, [taskAnalysis.data.contract.goal]);
  });

});
