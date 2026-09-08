import { isRecord } from '#shared/functions/checks/isRecord';

import { getAgentRole } from '#entities/agentRole';
import { validateAgentHandoff } from '#entities/agentRole';
import { AmyRuntimeError } from '#entities/runtime';
import { validateStrategyRoutingDecision } from '../../validateStrategyRouting/core/validateStrategyRouting.js';
import { validateTaskIntelligenceAnalysis } from '#entities/task';
import {
  DECOMPOSITION_VERSIONS,
} from '../../../types/decompositionContract.js';

import type {
  IDecompositionInput,
  IDecompositionNodeProposal,
  IDecompositionPolicyConfig,
  IDecompositionProposal,
  TDecompositionNodeRole,
} from '../../../types/decompositionContract.js';

const DECOMPOSITION_NODE_ROLES = new Set<TDecompositionNodeRole>(['scout', 'worker']);


const createValidationError = (message: string) =>
  new AmyRuntimeError({ code: 'VALIDATION_FAILURE', message });

const assertAllowedKeys = (
  value: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
  label: string,
) => {
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key));

  if (unknownKeys.length > 0) {
    throw createValidationError(`${label} contains unknown fields: ${unknownKeys.join(', ')}`);
  }
};

const validateNonEmptyString = (value: unknown, label: string) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createValidationError(`${label} must be a non-empty string`);
  }

  return value.trim();
};

const validateStringList = (value: unknown, label: string) => {
  if (!Array.isArray(value)) {
    throw createValidationError(`${label} must be an array`);
  }

  const strings = value.map((item) => validateNonEmptyString(item, label));

  if (new Set(strings).size !== strings.length) {
    throw createValidationError(`${label} must not contain duplicates`);
  }

  return Object.freeze([...strings].sort());
};

const validateNode = (value: unknown): Readonly<IDecompositionNodeProposal> => {
  if (!isRecord(value)) {
    throw createValidationError('Decomposition node must be an object');
  }

  assertAllowedKeys(
    value,
    [
      'contextRefs',
      'dependencies',
      'goal',
      'id',
      'outputs',
      'ownerRole',
      'readTargets',
      'writeTargets',
    ],
    'Decomposition node',
  );

  if (!DECOMPOSITION_NODE_ROLES.has(value.ownerRole as TDecompositionNodeRole)) {
    throw createValidationError('Decomposition node ownerRole is invalid');
  }

  return Object.freeze({
    contextRefs: value.contextRefs === undefined
      ? Object.freeze([])
      : validateStringList(value.contextRefs, 'Decomposition node contextRefs'),
    dependencies: validateStringList(value.dependencies, 'Decomposition node dependencies'),
    goal: validateNonEmptyString(value.goal, 'Decomposition node goal'),
    id: validateNonEmptyString(value.id, 'Decomposition node id'),
    outputs: validateStringList(value.outputs, 'Decomposition node outputs'),
    ownerRole: value.ownerRole as TDecompositionNodeRole,
    readTargets: validateStringList(value.readTargets, 'Decomposition node readTargets'),
    writeTargets: validateStringList(value.writeTargets, 'Decomposition node writeTargets'),
  });
};

const assertAcyclic = (nodes: readonly Readonly<IDecompositionNodeProposal>[]) => {
  const ids = new Set(nodes.map(({ id }) => id));

  nodes.forEach((node) => {
    node.dependencies.forEach((dependency) => {
      if (!ids.has(dependency)) {
        throw createValidationError(
          `Decomposition node ${node.id} references unknown dependency ${dependency}`,
        );
      }

      if (dependency === node.id) {
        throw createValidationError(`Decomposition node ${node.id} cannot depend on itself`);
      }
    });
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(nodes.map((node) => [node.id, node] as const));

  const visit = (id: string) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw createValidationError('Decomposition proposal must be acyclic');
    }

    visiting.add(id);
    byId.get(id)?.dependencies.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };

  [...ids].sort().forEach(visit);
};

const validateProposal = (value: unknown): Readonly<IDecompositionProposal> => {
  if (!isRecord(value)) {
    throw createValidationError('Decomposition proposal must be an object');
  }

  assertAllowedKeys(
    value,
    ['kind', 'nodes', 'proposalId', 'schemaVersion'],
    'Decomposition proposal',
  );

  if (
    value.kind !== 'decomposition-proposal' ||
    value.schemaVersion !== DECOMPOSITION_VERSIONS.proposalSchema ||
    !Array.isArray(value.nodes)
  ) {
    throw createValidationError('Decomposition proposal identity is invalid');
  }

  const nodes = value.nodes.map(validateNode);
  const ids = nodes.map(({ id }) => id);

  if (new Set(ids).size !== ids.length) {
    throw createValidationError('Decomposition proposal node ids must be unique');
  }

  assertAcyclic(nodes);

  return Object.freeze({
    kind: 'decomposition-proposal' as const,
    nodes: Object.freeze([...nodes].sort((left, right) => left.id.localeCompare(right.id))),
    proposalId: validateNonEmptyString(value.proposalId, 'Decomposition proposal id'),
    schemaVersion: DECOMPOSITION_VERSIONS.proposalSchema,
  });
};

const validateDepth = (value: unknown) => {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw createValidationError('Worker decomposition depth must be a non-negative integer');
  }

  return value as number;
};

export const validateDecompositionPolicy = (
  value: Readonly<IDecompositionPolicyConfig>,
): Readonly<IDecompositionPolicyConfig> => {
  if (
    !Number.isInteger(value.maxNodes) ||
    value.maxNodes < 1 ||
    !Number.isInteger(value.maxDelegationDepth) ||
    value.maxDelegationDepth < 1
  ) {
    throw createValidationError('Decomposition policy limits must be positive integers');
  }

  return Object.freeze({
    maxDelegationDepth: value.maxDelegationDepth,
    maxNodes: value.maxNodes,
  });
};

export const validateDecompositionInput = (
  value: unknown,
): Readonly<IDecompositionInput> => {
  if (!isRecord(value)) {
    throw createValidationError('Decomposition input must be an object');
  }

  assertAllowedKeys(value, ['proposal', 'source', 'taskAnalysis'], 'Decomposition input');

  if (!isRecord(value.source)) {
    throw createValidationError('Decomposition source must be an object');
  }

  const taskAnalysis = validateTaskIntelligenceAnalysis(value.taskAnalysis);
  const proposal = value.proposal === undefined
    ? undefined
    : validateProposal(value.proposal);

  if (value.source.kind === 'strategy') {
    assertAllowedKeys(value.source, ['kind', 'strategyDecision'], 'Strategy decomposition source');
    const strategyDecision = validateStrategyRoutingDecision(value.source.strategyDecision);

    return Object.freeze({
      ...(proposal ? { proposal } : {}),
      source: Object.freeze({ kind: 'strategy' as const, strategyDecision }),
      taskAnalysis,
    });
  }

  if (value.source.kind === 'worker') {
    assertAllowedKeys(value.source, ['depth', 'handoff', 'kind'], 'Worker decomposition source');
    const handoff = validateAgentHandoff(value.source.handoff);

    if (handoff.targetRole !== 'worker') {
      throw createValidationError('Worker decomposition source must reference a worker handoff');
    }

    const allowedChildRoles = getAgentRole('worker').childDelegation.allowedRoles;
    proposal?.nodes.forEach((node) => {
      if (!allowedChildRoles.includes(node.ownerRole)) {
        throw createValidationError(`Worker cannot delegate decomposition node to ${node.ownerRole}`);
      }
    });

    return Object.freeze({
      ...(proposal ? { proposal } : {}),
      source: Object.freeze({
        depth: validateDepth(value.source.depth),
        handoff,
        kind: 'worker' as const,
      }),
      taskAnalysis,
    });
  }

  throw createValidationError('Decomposition source kind is invalid');
};
