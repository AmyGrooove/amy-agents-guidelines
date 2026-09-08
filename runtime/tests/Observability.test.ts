import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as Runtime from '../dist/index.js';

const runtimeExports = Runtime as unknown as Record<string, any>;

describe('Observability', () => {
  it('validates bounded telemetry and decision provenance inputs without raw reasoning payloads', () => {
    assert.deepEqual(runtimeExports.OBSERVABILITY_VERSIONS, {
      api: 1,
      policy: 1,
      recordSchema: 1,
    });

    const validateObservabilityInput = runtimeExports.validateObservabilityInput as (value: unknown) => any;

    assert.deepEqual(validateObservabilityInput({
      durationMs: 42,
      event: 'completed',
      kind: 'telemetry',
      recordId: 'telemetry:task-1',
      refs: ['artifact:result'],
      subject: { id: 'task-1', kind: 'task' },
    }), {
      durationMs: 42,
      event: 'completed',
      kind: 'telemetry',
      recordId: 'telemetry:task-1',
      refs: ['artifact:result'],
      subject: { id: 'task-1', kind: 'task' },
    });

    assert.deepEqual(validateObservabilityInput({
      confidence: 'high',
      decision: 'worker',
      decisionKind: 'strategy',
      evidenceRefs: ['artifact:task-analysis'],
      explanation: 'Risk justifies a Worker.',
      kind: 'decision',
      policy: { owner: 'strategy-routing', version: 1 },
      reasonCodes: ['worker-recommended'],
      recordId: 'decision:strategy:task-1',
      subject: { id: 'task-1', kind: 'task' },
    }), {
      confidence: 'high',
      decision: 'worker',
      decisionKind: 'strategy',
      evidenceRefs: ['artifact:task-analysis'],
      explanation: 'Risk justifies a Worker.',
      kind: 'decision',
      policy: { owner: 'strategy-routing', version: 1 },
      reasonCodes: ['worker-recommended'],
      recordId: 'decision:strategy:task-1',
      subject: { id: 'task-1', kind: 'task' },
    });

    assert.throws(
      () => validateObservabilityInput({
        chainOfThought: 'hidden reasoning',
        decision: 'worker',
        decisionKind: 'strategy',
        evidenceRefs: [],
        kind: 'decision',
        policy: { owner: 'strategy-routing', version: 1 },
        reasonCodes: ['worker-recommended'],
        recordId: 'decision:bad',
        subject: { id: 'task-1', kind: 'task' },
      }),
      /Unknown observability input fields/,
    );

    assert.throws(
      () => validateObservabilityInput({
        decision: 'worker',
        decisionKind: 'strategy',
        evidenceRefs: [],
        kind: 'decision',
        policy: { owner: 'strategy-routing', version: 1 },
        reasonCodes: [],
        recordId: 'decision:no-reason',
        subject: { id: 'task-1', kind: 'task' },
      }),
      /reasonCodes must contain at least one item/,
    );
  });

  it('records through RuntimeEventBus and degrades fail-open when consumers fail', async () => {
    const RuntimeEventBus = runtimeExports.RuntimeEventBus as new () => any;
    const events = new RuntimeEventBus();
    const received: any[] = [];

    events.subscribe((event: unknown) => {
      received.push(event);
    });
    events.subscribe(() => {
      throw new Error('storage unavailable');
    });

    const createObservabilityCapability = runtimeExports.createObservabilityCapability as (options: any) => any;
    const capability = createObservabilityCapability({
      events,
      now: () => '2026-09-08T08:30:00.000Z',
      runtimeId: 'runtime-stage-13',
    });

    assert.equal(capability.descriptor.id, 'amy.observability');
    assert.equal(capability.descriptor.version, '1.0.0');
    assert.equal(capability.descriptor.dependencies, undefined);

    const receipt = await capability.api.record({
      event: 'completed',
      kind: 'telemetry',
      recordId: 'telemetry:task-1',
      subject: { id: 'task-1', kind: 'task' },
    });

    assert.equal(receipt.status, 'degraded');
    assert.equal(receipt.deliveredCount, 1);
    assert.deepEqual(receipt.deliveryFailures, ['storage unavailable']);
    assert.equal(receipt.record.schemaVersion, 1);
    assert.equal(receipt.record.timestamp, '2026-09-08T08:30:00.000Z');
    assert.equal(received.length, 1);
    assert.equal(received[0].type, 'observability.recorded');
    assert.equal(received[0].runtimeId, 'runtime-stage-13');
    assert.deepEqual(received[0].payload.record, receipt.record);
  });

  it('treats an empty bus as emitted and isolates a throwing custom event port', async () => {
    const RuntimeEventBus = runtimeExports.RuntimeEventBus as new () => any;
    const createObservabilityCapability = runtimeExports.createObservabilityCapability as (options: any) => any;

    const emptyCapability = createObservabilityCapability({
      events: new RuntimeEventBus(),
      runtimeId: 'runtime-empty',
    });
    const emptyReceipt = await emptyCapability.api.record({
      decision: 'FAST',
      decisionKind: 'compute',
      evidenceRefs: [],
      kind: 'decision',
      policy: { owner: 'compute-routing', version: 1 },
      reasonCodes: ['lightweight-task'],
      recordId: 'decision:compute:task-1',
      subject: { id: 'task-1', kind: 'task' },
    });

    assert.equal(emptyReceipt.status, 'emitted');
    assert.equal(emptyReceipt.deliveredCount, 0);
    assert.deepEqual(emptyReceipt.deliveryFailures, []);

    const throwingCapability = createObservabilityCapability({
      events: {
        emit: async () => {
          throw new Error('event port offline');
        },
        subscribe: () => () => undefined,
      },
      runtimeId: 'runtime-throwing',
    });
    const droppedReceipt = await throwingCapability.api.record({
      event: 'failed',
      errorCode: 'TOOL_FAILURE',
      kind: 'telemetry',
      recordId: 'telemetry:tool-1',
      subject: { id: 'tool-1', kind: 'tool-call' },
    });

    assert.equal(droppedReceipt.status, 'dropped');
    assert.equal(droppedReceipt.deliveredCount, 0);
    assert.deepEqual(droppedReceipt.deliveryFailures, ['event port offline']);
  });


  it('builds deterministic provenance from canonical Stage 4-12 decisions without a second taxonomy', () => {
    const buildDecisionProvenance = runtimeExports.buildDecisionProvenance as (source: any) => any[];
    const common = {
      provenanceId: 'prov-1',
      sourceRef: 'artifact:source',
      taskId: 'task-1',
    };

    const classification = buildDecisionProvenance({
      ...common,
      kind: 'task-classification',
      value: {
        data: {
          classification: {
            confidence: 'high',
            dimensions: { complexity: 'low', risk: 'low', scope: 'local' },
            mode: 'text-only',
            reasonCodes: ['scope-local', 'verification-explicit'],
            schemaVersion: 1,
          },
        },
      },
    });
    assert.equal(classification.length, 1);
    assert.equal(classification[0].decisionKind, 'classification');
    assert.deepEqual(classification[0].reasonCodes, ['scope-local', 'verification-explicit']);
    assert.deepEqual(classification[0].policy, { owner: 'task-intelligence', version: 1 });

    const context = buildDecisionProvenance({
      ...common,
      kind: 'context',
      value: {
        data: {
          packet: { likelyAffectedFiles: ['a.ts'], modules: [{ id: 'module-a' }] },
          resolution: {
            confidence: 'medium',
            exploration: 'source-read',
            reasonCodes: ['source-confirmation-required'],
            schemaVersion: 1,
          },
        },
      },
    });
    assert.equal(context[0].decisionKind, 'context');
    assert.equal(context[0].decision, 'exploration=source-read;modules=1;files=1');

    const compute = buildDecisionProvenance({
      ...common,
      kind: 'compute',
      value: {
        assignment: { status: 'mapped' },
        confidence: 'high',
        profile: 'FAST',
        reasonCodes: ['lightweight-task'],
        schemaVersion: 1,
        target: { kind: 'task' },
      },
    });
    assert.equal(compute[0].decisionKind, 'compute');
    assert.equal(compute[0].decision, 'profile=FAST;status=mapped');

    const strategy = buildDecisionProvenance({
      ...common,
      kind: 'strategy',
      value: {
        data: {
          confidence: 'high',
          escalation: 'none',
          execution: 'worker',
          exploration: 'scout',
          fastPath: false,
          planning: 'plan',
          policyVersion: 1,
          reasonCodes: ['context-scout-required', 'worker-recommended', 'verifier-risk-justified'],
          review: 'none',
          verification: 'verifier',
        },
      },
    });
    assert.deepEqual(strategy.map(({ decisionKind }) => decisionKind), [
      'strategy',
      'scout',
      'verifier',
      'reviewer',
    ]);
    assert.equal(strategy[1].decision, 'activated');
    assert.equal(strategy[2].decision, 'required');
    assert.equal(strategy[3].decision, 'not-required');

    const decomposition = buildDecisionProvenance({
      ...common,
      kind: 'decomposition',
      value: {
        data: {
          confidence: 'medium',
          decision: 'planned',
          parallelism: {
            confidence: 'medium',
            maxConcurrency: 2,
            mode: 'parallel',
            reasonCodes: ['parallelism-recommended'],
          },
          policyVersion: 1,
          reasonCodes: ['decomposition-planned'],
        },
      },
    });
    assert.deepEqual(decomposition.map(({ decisionKind }) => decisionKind), [
      'decomposition',
      'parallelism',
    ]);
    assert.deepEqual(decomposition[1].reasonCodes, ['parallelism-recommended']);

    const verification = buildDecisionProvenance({
      ...common,
      kind: 'verification',
      value: {
        data: {
          policyVersion: 1,
          review: {
            findings: [{ evidenceRefs: ['evidence:review'] }],
            reasonCodes: ['review-passed'],
            status: 'passed',
          },
          semantic: {
            criteria: [{ evidenceRefs: ['evidence:criterion'] }],
            reasonCodes: ['semantic-passed'],
            status: 'passed',
          },
          verificationId: 'verification-1',
        },
      },
    });
    assert.deepEqual(verification.map(({ decisionKind }) => decisionKind), ['verifier', 'reviewer']);
    assert.deepEqual(verification[0].evidenceRefs, ['artifact:source', 'evidence:criterion']);
    assert.deepEqual(verification[1].evidenceRefs, ['artifact:source', 'evidence:review']);

    const completion = buildDecisionProvenance({
      ...common,
      kind: 'completion',
      value: {
        data: {
          completionId: 'completion-1',
          confidence: 'medium',
          guard: { decision: 'retry', retriesRemaining: 1 },
          policyVersion: 1,
          reasonCodes: ['guard-retry-allowed'],
        },
      },
    });
    assert.equal(completion[0].decisionKind, 'retry');
    assert.equal(completion[0].decision, 'guard=retry;retriesRemaining=1');

    const recoveryReasonCodes = [
      'failure-diagnosed',
      'retry-budget-available',
      'scoped-retry',
      'verification-required',
    ];
    const recovery = buildDecisionProvenance({
      ...common,
      kind: 'recovery',
      value: {
        data: {
          action: 'retry',
          diagnosis: {
            branch: { id: 'dag:worker-2', kind: 'dag-node' },
            evidenceRefs: ['evidence:stack'],
          },
          policyVersion: 1,
          reasonCodes: recoveryReasonCodes,
          recoveryId: 'recovery-1',
        },
      },
    });
    assert.deepEqual(recovery.map(({ decisionKind }) => decisionKind), ['recovery', 'retry']);
    assert.deepEqual(recovery[0].reasonCodes, recoveryReasonCodes);
    assert.deepEqual(recovery[0].evidenceRefs, ['artifact:source', 'evidence:stack']);
    assert.deepEqual(recovery[0].policy, { owner: 'recovery', version: 1 });
    assert.deepEqual(recovery[0].subject, { id: 'dag:worker-2', kind: 'dag-node' });
    assert.equal(recovery[0].decision, 'retry');
    assert.deepEqual(recovery[1].reasonCodes, recoveryReasonCodes);
  });

  it('bounds provenance evidence collected from canonical verification results', () => {
    const buildDecisionProvenance = runtimeExports.buildDecisionProvenance as (source: any) => any[];
    const evidenceRefs = Array.from({ length: 40 }, (_, index) => `evidence:${index}`);

    const records = buildDecisionProvenance({
      kind: 'verification',
      provenanceId: 'prov-bounded',
      sourceRef: 'artifact:verification',
      taskId: 'task-bounded',
      value: {
        data: {
          policyVersion: 1,
          review: {
            findings: [],
            reasonCodes: ['review-not-required'],
            status: 'not-required',
          },
          semantic: {
            criteria: [{ evidenceRefs }],
            reasonCodes: ['semantic-passed'],
            status: 'passed',
          },
          verificationId: 'verification-bounded',
        },
      },
    });

    assert.equal(records[0].evidenceRefs.length, 32);
    assert.deepEqual(records[0].evidenceRefs, [
      'artifact:verification',
      ...evidenceRefs.slice(0, 31),
    ]);
  });

});
