import {
  AGENT_ROLES,
  AGENT_ROLE_VERSIONS,
} from '../../../types/agentRoleContract.js';

import type {
  IAgentRoleDescriptor,
  TAgentRole,
} from '../../../types/agentRoleContract.js';

const freezeStrings = <T extends string>(values: readonly T[]) =>
  Object.freeze([...values]);

const createRole = (
  role: Omit<IAgentRoleDescriptor, 'schemaVersion'>,
): Readonly<IAgentRoleDescriptor> =>
  Object.freeze({
    ...role,
    childDelegation: Object.freeze({
      ...role.childDelegation,
      allowedRoles: freezeStrings(role.childDelegation.allowedRoles),
    }),
    completionCriteria: freezeStrings(role.completionCriteria),
    inputs: freezeStrings(role.inputs),
    nonResponsibilities: freezeStrings(role.nonResponsibilities),
    outputs: freezeStrings(role.outputs),
    schemaVersion: AGENT_ROLE_VERSIONS.roleSchema,
  });

const ROLE_CATALOG: Readonly<Record<TAgentRole, Readonly<IAgentRoleDescriptor>>> =
  Object.freeze({
    scout: createRole({
      childDelegation: { allowed: false, allowedRoles: [], maxChildren: 0 },
      completionCriteria: [
        'Return bounded findings tied to concrete source evidence.',
        'State unresolved evidence gaps without expanding task scope.',
      ],
      id: 'scout',
      inputs: ['task-analysis', 'context-packet', 'handoff'],
      nonResponsibilities: [
        'Do not implement production changes.',
        'Do not choose final execution strategy or approve completion.',
      ],
      outputs: ['exploration-findings'],
      readPolicy: 'targeted',
      responsibility:
        'Resolve specific context or repository uncertainty with bounded exploration.',
      toolPolicy: 'read-only',
      typicalComputeProfile: 'STANDARD',
      writePolicy: 'none',
    }),
    worker: createRole({
      childDelegation: {
        allowed: true,
        allowedRoles: ['scout', 'worker', 'debugger'],
        maxChildren: 2,
      },
      completionCriteria: [
        'Own the delegated subtask through implementation and local integration.',
        'Return produced artifacts, verification evidence, and unresolved issues.',
      ],
      id: 'worker',
      inputs: ['task-analysis', 'context-packet', 'handoff'],
      nonResponsibilities: [
        'Do not perform broad repository exploration when bounded context is sufficient.',
        'Do not declare the parent task complete on implementation claims alone.',
      ],
      outputs: ['implementation-result'],
      readPolicy: 'task-scope',
      responsibility:
        'Own and implement a delegated subtask within its explicit scope and constraints.',
      toolPolicy: 'task-execution',
      typicalComputeProfile: 'STANDARD',
      writePolicy: 'task-scope',
    }),
    debugger: createRole({
      childDelegation: { allowed: false, allowedRoles: [], maxChildren: 0 },
      completionCriteria: [
        'Identify a concrete failure cause supported by evidence.',
        'Apply only a scoped repair when write authority is delegated.',
      ],
      id: 'debugger',
      inputs: ['handoff', 'failure-evidence', 'context-packet'],
      nonResponsibilities: [
        'Do not restart the whole task without a diagnosed reason.',
        'Do not broaden architecture beyond the failing branch.',
      ],
      outputs: ['diagnosis', 'implementation-result'],
      readPolicy: 'targeted',
      responsibility:
        'Diagnose a concrete execution or verification failure and produce a scoped recovery result.',
      toolPolicy: 'task-execution',
      typicalComputeProfile: 'ADVANCED',
      writePolicy: 'task-scope',
    }),
    verifier: createRole({
      childDelegation: { allowed: false, allowedRoles: [], maxChildren: 0 },
      completionCriteria: [
        'Evaluate delegated acceptance criteria against supplied evidence.',
        'Report verification gaps explicitly instead of treating missing evidence as success.',
      ],
      id: 'verifier',
      inputs: [
        'task-analysis',
        'context-packet',
        'implementation-result',
        'verification-evidence',
        'handoff',
      ],
      nonResponsibilities: [
        'Do not modify production code while acting as verifier.',
        'Do not perform optional architecture review unless delegated as reviewer.',
      ],
      outputs: ['verification-result'],
      readPolicy: 'targeted',
      responsibility:
        'Check task requirements and acceptance criteria against implementation and verification evidence.',
      toolPolicy: 'read-only',
      typicalComputeProfile: 'STANDARD',
      writePolicy: 'none',
    }),
    reviewer: createRole({
      childDelegation: { allowed: false, allowedRoles: [], maxChildren: 0 },
      completionCriteria: [
        'Return bounded findings with severity and supporting evidence.',
        'Distinguish required fixes from optional maintainability observations.',
      ],
      id: 'reviewer',
      inputs: [
        'task-analysis',
        'context-packet',
        'implementation-result',
        'verification-evidence',
        'handoff',
      ],
      nonResponsibilities: [
        'Do not become a mandatory gate for every task.',
        'Do not rewrite the implementation while acting as reviewer.',
      ],
      outputs: ['review-findings'],
      readPolicy: 'task-scope',
      responsibility:
        'Perform conditional architecture, regression, and maintainability review when risk justifies it.',
      toolPolicy: 'read-only',
      typicalComputeProfile: 'ADVANCED',
      writePolicy: 'none',
    }),
  });

export const listAgentRoles = (): readonly Readonly<IAgentRoleDescriptor>[] =>
  Object.freeze(AGENT_ROLES.map((role) => ROLE_CATALOG[role]));

export const getAgentRole = (
  role: TAgentRole,
): Readonly<IAgentRoleDescriptor> => ROLE_CATALOG[role];
