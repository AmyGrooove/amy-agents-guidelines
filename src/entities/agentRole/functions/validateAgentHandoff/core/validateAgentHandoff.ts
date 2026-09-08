import { isRecord } from '#shared/functions/checks/isRecord';

import { AmyRuntimeError } from '#entities/runtime';
import { COMPUTE_PROFILES } from '#entities/computeProfile';
import { getAgentRole } from '../../getAgentRole/core/getAgentRole.js';
import {
  AGENT_ROLES,
  AGENT_ROLE_VERSIONS,
} from '../../../types/agentRoleContract.js';

import type { TComputeProfile } from '#entities/computeProfile';
import type {
  IAgentHandoff,
  IAgentHandoffEvidence,
  IAgentHandoffInput,
  IAgentHandoffOutput,
  IAgentHandoffResult,
  IAgentHandoffScope,
  TAgentEvidenceKind,
  TAgentHandoffSource,
  TAgentHandoffStatus,
  TAgentRole,
  TAgentRoleInputKind,
  TAgentRoleOutputKind,
} from '../../../types/agentRoleContract.js';


const createValidationError = (message: string) =>
  new AmyRuntimeError({
    code: 'VALIDATION_FAILURE',
    message,
  });

const rejectUnknownKeys = (
  value: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
  subject: string,
) => {
  const unknownKeys = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknownKeys.length > 0) {
    throw createValidationError(
      `Unknown ${subject} fields: ${unknownKeys.join(', ')}`,
    );
  }
};

const validateNonEmptyString = (value: unknown, field: string) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createValidationError(`${field} must be a non-empty string`);
  }

  return value.trim();
};

const validateStringList = (
  value: unknown,
  field: string,
  options: { minItems?: number } = {},
): readonly string[] => {
  if (!Array.isArray(value)) {
    throw createValidationError(`${field} must be an array`);
  }

  const items = value.map((item) => validateNonEmptyString(item, field));

  if (items.length < (options.minItems ?? 0)) {
    throw createValidationError(
      `${field} must contain at least ${options.minItems ?? 0} item(s)`,
    );
  }

  if (new Set(items).size !== items.length) {
    throw createValidationError(`${field} must not contain duplicates`);
  }

  return Object.freeze(items);
};

const checkIsRole = (value: unknown): value is TAgentRole =>
  typeof value === 'string' && AGENT_ROLES.some((role) => role === value);

const checkIsComputeProfile = (value: unknown): value is TComputeProfile =>
  typeof value === 'string' &&
  COMPUTE_PROFILES.some((profile) => profile === value);

const ROLE_INPUT_KINDS: readonly TAgentRoleInputKind[] = [
  'context-packet',
  'failure-evidence',
  'handoff',
  'implementation-result',
  'task-analysis',
  'verification-evidence',
];

const ROLE_OUTPUT_KINDS: readonly TAgentRoleOutputKind[] = [
  'diagnosis',
  'exploration-findings',
  'implementation-result',
  'review-findings',
  'verification-result',
];

const EVIDENCE_KINDS: readonly TAgentEvidenceKind[] = [
  'check',
  'command',
  'file',
  'finding',
];

const HANDOFF_STATUSES: readonly TAgentHandoffStatus[] = [
  'blocked',
  'completed',
  'failed',
];

const validateScope = (value: unknown): Readonly<IAgentHandoffScope> => {
  if (!isRecord(value)) {
    throw createValidationError('handoff.scope must be an object');
  }

  rejectUnknownKeys(value, ['readTargets', 'writeTargets'], 'handoff scope');

  return Object.freeze({
    readTargets: validateStringList(value.readTargets, 'scope.readTargets'),
    writeTargets: validateStringList(value.writeTargets, 'scope.writeTargets'),
  });
};

const validateSource = (value: unknown): TAgentHandoffSource => {
  if (!isRecord(value)) {
    throw createValidationError('handoff.source must be an object');
  }

  if (value.kind === 'orchestrator') {
    rejectUnknownKeys(value, ['kind'], 'handoff source');
    return Object.freeze({ kind: 'orchestrator' as const });
  }

  if (value.kind !== 'agent') {
    throw createValidationError('handoff.source.kind is invalid');
  }

  rejectUnknownKeys(value, ['handoffId', 'kind', 'role'], 'handoff source');

  if (!checkIsRole(value.role)) {
    throw createValidationError('handoff.source.role is invalid');
  }

  return Object.freeze({
    handoffId: validateNonEmptyString(value.handoffId, 'source.handoffId'),
    kind: 'agent' as const,
    role: value.role,
  });
};

const validateInputs = (
  value: unknown,
  targetRole: TAgentRole,
): readonly Readonly<IAgentHandoffInput>[] => {
  if (!Array.isArray(value)) {
    throw createValidationError('handoff.inputs must be an array');
  }

  const role = getAgentRole(targetRole);
  const inputs = value.map((item, index) => {
    if (!isRecord(item)) {
      throw createValidationError(`handoff.inputs[${index}] must be an object`);
    }

    rejectUnknownKeys(item, ['kind', 'ref', 'summary'], 'handoff input');

    if (
      typeof item.kind !== 'string' ||
      !ROLE_INPUT_KINDS.includes(item.kind as TAgentRoleInputKind) ||
      !role.inputs.includes(item.kind as TAgentRoleInputKind)
    ) {
      throw createValidationError(
        `handoff.inputs[${index}].kind is not accepted by role ${targetRole}`,
      );
    }

    const summary =
      item.summary === undefined
        ? undefined
        : validateNonEmptyString(item.summary, `handoff.inputs[${index}].summary`);

    return Object.freeze({
      kind: item.kind as TAgentRoleInputKind,
      ref: validateNonEmptyString(item.ref, `handoff.inputs[${index}].ref`),
      ...(summary ? { summary } : {}),
    });
  });
  const keys = inputs.map(({ kind, ref }) => `${kind}:${ref}`);

  if (new Set(keys).size !== keys.length) {
    throw createValidationError('handoff.inputs must not contain duplicate refs');
  }

  return Object.freeze(inputs);
};

const validateExpectedOutputs = (
  value: unknown,
  targetRole: TAgentRole,
): readonly TAgentRoleOutputKind[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw createValidationError('handoff.expectedOutputs must be a non-empty array');
  }

  const role = getAgentRole(targetRole);
  const outputs = value.map((item) => {
    if (
      typeof item !== 'string' ||
      !ROLE_OUTPUT_KINDS.includes(item as TAgentRoleOutputKind) ||
      !role.outputs.includes(item as TAgentRoleOutputKind)
    ) {
      throw createValidationError(
        `handoff.expectedOutputs contains unsupported output for role ${targetRole}`,
      );
    }

    return item as TAgentRoleOutputKind;
  });

  if (new Set(outputs).size !== outputs.length) {
    throw createValidationError('handoff.expectedOutputs must not contain duplicates');
  }

  return Object.freeze(outputs);
};

export const validateAgentHandoff = (value: unknown): Readonly<IAgentHandoff> => {
  if (!isRecord(value)) {
    throw createValidationError('Agent handoff must be an object');
  }

  rejectUnknownKeys(
    value,
    [
      'acceptanceCriteria',
      'computeProfile',
      'constraints',
      'expectedOutputs',
      'goal',
      'handoffId',
      'inputs',
      'kind',
      'nonGoals',
      'requirements',
      'schemaVersion',
      'scope',
      'source',
      'targetRole',
    ],
    'agent handoff',
  );

  if (value.kind !== 'agent-handoff') {
    throw createValidationError('Agent handoff kind is invalid');
  }

  if (value.schemaVersion !== AGENT_ROLE_VERSIONS.handoffSchema) {
    throw createValidationError('Agent handoff schemaVersion is unsupported');
  }

  if (!checkIsRole(value.targetRole)) {
    throw createValidationError('Agent handoff targetRole is invalid');
  }

  if (
    value.computeProfile !== undefined &&
    !checkIsComputeProfile(value.computeProfile)
  ) {
    throw createValidationError('Agent handoff computeProfile is invalid');
  }

  const targetRole = value.targetRole;
  const role = getAgentRole(targetRole);
  const scope = validateScope(value.scope);
  const source = validateSource(value.source);

  if (role.writePolicy === 'none' && scope.writeTargets.length > 0) {
    throw createValidationError(
      `Role ${targetRole} does not accept write targets`,
    );
  }

  if (source.kind === 'agent') {
    const sourceRole = getAgentRole(source.role);

    if (
      !sourceRole.childDelegation.allowed ||
      !sourceRole.childDelegation.allowedRoles.includes(targetRole)
    ) {
      throw createValidationError(
        `Role ${source.role} cannot delegate to role ${targetRole}`,
      );
    }
  }

  return Object.freeze({
    acceptanceCriteria: validateStringList(
      value.acceptanceCriteria,
      'handoff.acceptanceCriteria',
      { minItems: 1 },
    ),
    ...(value.computeProfile
      ? { computeProfile: value.computeProfile as TComputeProfile }
      : {}),
    constraints: validateStringList(value.constraints, 'handoff.constraints'),
    expectedOutputs: validateExpectedOutputs(value.expectedOutputs, targetRole),
    goal: validateNonEmptyString(value.goal, 'handoff.goal'),
    handoffId: validateNonEmptyString(value.handoffId, 'handoff.handoffId'),
    inputs: validateInputs(value.inputs, targetRole),
    kind: 'agent-handoff' as const,
    nonGoals: validateStringList(value.nonGoals, 'handoff.nonGoals'),
    requirements: validateStringList(value.requirements, 'handoff.requirements', {
      minItems: 1,
    }),
    schemaVersion: AGENT_ROLE_VERSIONS.handoffSchema,
    scope,
    source,
    targetRole,
  });
};

const validateResultOutputs = (
  value: unknown,
  roleId: TAgentRole,
): readonly Readonly<IAgentHandoffOutput>[] => {
  if (!Array.isArray(value)) {
    throw createValidationError('handoff result outputs must be an array');
  }

  const role = getAgentRole(roleId);
  const outputs = value.map((item, index) => {
    if (!isRecord(item)) {
      throw createValidationError(`result.outputs[${index}] must be an object`);
    }

    rejectUnknownKeys(item, ['kind', 'ref', 'summary'], 'handoff result output');

    if (
      typeof item.kind !== 'string' ||
      !ROLE_OUTPUT_KINDS.includes(item.kind as TAgentRoleOutputKind) ||
      !role.outputs.includes(item.kind as TAgentRoleOutputKind)
    ) {
      throw createValidationError(
        `result.outputs[${index}].kind is not produced by role ${roleId}`,
      );
    }

    return Object.freeze({
      kind: item.kind as TAgentRoleOutputKind,
      ref: validateNonEmptyString(item.ref, `result.outputs[${index}].ref`),
      summary: validateNonEmptyString(
        item.summary,
        `result.outputs[${index}].summary`,
      ),
    });
  });

  return Object.freeze(outputs);
};

const validateEvidence = (
  value: unknown,
): readonly Readonly<IAgentHandoffEvidence>[] => {
  if (!Array.isArray(value)) {
    throw createValidationError('handoff result evidence must be an array');
  }

  return Object.freeze(
    value.map((item, index) => {
      if (!isRecord(item)) {
        throw createValidationError(`result.evidence[${index}] must be an object`);
      }

      rejectUnknownKeys(item, ['kind', 'ref', 'summary'], 'handoff result evidence');

      if (
        typeof item.kind !== 'string' ||
        !EVIDENCE_KINDS.includes(item.kind as TAgentEvidenceKind)
      ) {
        throw createValidationError(`result.evidence[${index}].kind is invalid`);
      }

      return Object.freeze({
        kind: item.kind as TAgentEvidenceKind,
        ref: validateNonEmptyString(item.ref, `result.evidence[${index}].ref`),
        summary: validateNonEmptyString(
          item.summary,
          `result.evidence[${index}].summary`,
        ),
      });
    }),
  );
};

export const validateAgentHandoffResult = (
  value: unknown,
): Readonly<IAgentHandoffResult> => {
  if (!isRecord(value)) {
    throw createValidationError('Agent handoff result must be an object');
  }

  rejectUnknownKeys(
    value,
    [
      'childHandoffIds',
      'evidence',
      'handoffId',
      'kind',
      'outputs',
      'role',
      'schemaVersion',
      'status',
      'summary',
      'unresolvedIssues',
    ],
    'agent handoff result',
  );

  if (value.kind !== 'agent-handoff-result') {
    throw createValidationError('Agent handoff result kind is invalid');
  }

  if (value.schemaVersion !== AGENT_ROLE_VERSIONS.resultSchema) {
    throw createValidationError('Agent handoff result schemaVersion is unsupported');
  }

  if (!checkIsRole(value.role)) {
    throw createValidationError('Agent handoff result role is invalid');
  }

  if (
    typeof value.status !== 'string' ||
    !HANDOFF_STATUSES.includes(value.status as TAgentHandoffStatus)
  ) {
    throw createValidationError('Agent handoff result status is invalid');
  }

  const role = getAgentRole(value.role);
  const childHandoffIds = validateStringList(
    value.childHandoffIds,
    'result.childHandoffIds',
  );
  const unresolvedIssues = validateStringList(
    value.unresolvedIssues,
    'result.unresolvedIssues',
  );

  if (childHandoffIds.length > role.childDelegation.maxChildren) {
    throw createValidationError(
      `Role ${value.role} returned more child handoffs than its delegation policy allows`,
    );
  }

  if (value.status !== 'completed' && unresolvedIssues.length === 0) {
    throw createValidationError(
      'Blocked or failed handoff result must explain unresolved issues',
    );
  }

  return Object.freeze({
    childHandoffIds,
    evidence: validateEvidence(value.evidence),
    handoffId: validateNonEmptyString(value.handoffId, 'result.handoffId'),
    kind: 'agent-handoff-result' as const,
    outputs: validateResultOutputs(value.outputs, value.role),
    role: value.role,
    schemaVersion: AGENT_ROLE_VERSIONS.resultSchema,
    status: value.status as TAgentHandoffStatus,
    summary: validateNonEmptyString(value.summary, 'result.summary'),
    unresolvedIssues,
  });
};
