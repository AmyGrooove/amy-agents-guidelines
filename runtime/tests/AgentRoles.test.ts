import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AGENT_ROLES,
  AGENT_ROLE_VERSIONS,
  createAgentRolesCapability,
  getAgentRole,
  listAgentRoles,
  validateAgentHandoff,
  validateAgentHandoffResult,
} from '../dist/index.js';

describe('AgentRoles', () => {
  it('экспортирует минимальный универсальный role catalog как независимую deterministic capability', () => {
    assert.deepEqual(AGENT_ROLES, [
      'scout',
      'worker',
      'debugger',
      'verifier',
      'reviewer',
    ]);
    assert.deepEqual(AGENT_ROLE_VERSIONS, {
      api: 1,
      handoffSchema: 1,
      resultSchema: 1,
      roleSchema: 1,
    });

    const capability = createAgentRolesCapability();

    assert.equal(capability.descriptor.id, 'amy.agent-roles');
    assert.equal(capability.descriptor.version, '1.0.0');
    assert.equal(capability.descriptor.dependencies, undefined);
    assert.equal(typeof capability.api.list, 'function');
    assert.equal(typeof capability.api.get, 'function');
  });

  it('фиксирует ответственность, I/O policy, delegation и independent typical compute для каждой роли', () => {
    const roles = listAgentRoles();

    assert.equal(roles.length, 5);
    assert.equal(roles.every((role) => role.schemaVersion === 1), true);
    assert.deepEqual(
      roles.map(({ id }) => id),
      AGENT_ROLES,
    );

    const scout = getAgentRole('scout');
    const worker = getAgentRole('worker');
    const verifier = getAgentRole('verifier');

    assert.equal(scout.writePolicy, 'none');
    assert.equal(worker.writePolicy, 'task-scope');
    assert.equal(worker.childDelegation.allowed, true);
    assert.deepEqual(worker.childDelegation.allowedRoles, [
      'scout',
      'worker',
      'debugger',
    ]);
    assert.equal(verifier.writePolicy, 'none');
    assert.equal(worker.typicalComputeProfile, 'STANDARD');
    assert.equal('model' in worker, false);
  });
});


describe('AgentHandoff', () => {
  const workerHandoff = {
    acceptanceCriteria: ['Disabled state is implemented.'],
    computeProfile: 'ADVANCED',
    constraints: ['Preserve public API.'],
    expectedOutputs: ['implementation-result'],
    goal: 'Implement disabled state.',
    handoffId: 'handoff-worker-1',
    inputs: [
      {
        kind: 'context-packet',
        ref: 'context:button',
        summary: 'Bounded Button context.',
      },
    ],
    kind: 'agent-handoff',
    nonGoals: ['Do not restyle unrelated states.'],
    requirements: ['Add disabled behavior.'],
    schemaVersion: 1,
    scope: {
      readTargets: ['src/Button.tsx'],
      writeTargets: ['src/Button.tsx'],
    },
    source: { kind: 'orchestrator' },
    targetRole: 'worker',
  } as const;

  it('валидирует bounded handoff и не превращает compute profile в role alias', () => {
    const handoff = validateAgentHandoff(workerHandoff);
    const capability = createAgentRolesCapability();

    assert.equal(handoff.targetRole, 'worker');
    assert.equal(handoff.computeProfile, 'ADVANCED');
    assert.equal('model' in handoff, false);
    assert.deepEqual(capability.api.validateHandoff(workerHandoff), handoff);
  });

  it('разрешает только явно допустимую child delegation и write scope роли', () => {
    const child = validateAgentHandoff({
      ...workerHandoff,
      computeProfile: 'FAST',
      expectedOutputs: ['exploration-findings'],
      handoffId: 'handoff-scout-1',
      scope: { readTargets: ['src/feature'], writeTargets: [] },
      source: {
        handoffId: 'handoff-worker-1',
        kind: 'agent',
        role: 'worker',
      },
      targetRole: 'scout',
    });

    assert.equal(child.targetRole, 'scout');

    const childWorker = validateAgentHandoff({
      ...workerHandoff,
      handoffId: 'handoff-worker-child',
      source: {
        handoffId: 'handoff-worker-1',
        kind: 'agent',
        role: 'worker',
      },
      targetRole: 'worker',
    });

    assert.equal(childWorker.targetRole, 'worker');

    assert.throws(() =>
      validateAgentHandoff({
        ...workerHandoff,
        expectedOutputs: ['verification-result'],
        handoffId: 'handoff-verifier-child',
        scope: { readTargets: ['src/Button.tsx'], writeTargets: [] },
        source: {
          handoffId: 'handoff-worker-1',
          kind: 'agent',
          role: 'worker',
        },
        targetRole: 'verifier',
      }),
    );

    assert.throws(() =>
      validateAgentHandoff({
        ...workerHandoff,
        expectedOutputs: ['exploration-findings'],
        handoffId: 'handoff-scout-write',
        targetRole: 'scout',
      }),
    );
  });

  it('валидирует role-owned result с evidence и явными unresolved issues', () => {
    const result = validateAgentHandoffResult({
      childHandoffIds: ['handoff-scout-1'],
      evidence: [
        {
          kind: 'check',
          ref: 'pnpm:test',
          summary: 'Relevant tests passed.',
        },
      ],
      handoffId: 'handoff-worker-1',
      kind: 'agent-handoff-result',
      outputs: [
        {
          kind: 'implementation-result',
          ref: 'diff:worker-1',
          summary: 'Implemented disabled behavior.',
        },
      ],
      role: 'worker',
      schemaVersion: 1,
      status: 'completed',
      summary: 'Owned subtask completed.',
      unresolvedIssues: [],
    });

    assert.equal(result.status, 'completed');
    assert.deepEqual(result.childHandoffIds, ['handoff-scout-1']);

    assert.throws(() =>
      validateAgentHandoffResult({
        ...result,
        role: 'verifier',
      }),
    );

    assert.throws(() =>
      validateAgentHandoffResult({
        ...result,
        status: 'blocked',
        unresolvedIssues: [],
      }),
    );
  });
});
