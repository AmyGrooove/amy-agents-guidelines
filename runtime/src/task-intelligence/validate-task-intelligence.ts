import { AmyRuntimeError } from '../errors/amy-runtime-error.js';

import { TASK_INTELLIGENCE_VERSIONS } from './task-intelligence-contract.js';

import type {
  ITaskAffectedScope,
  ITaskClassificationInput,
  ITaskContract,
  ITaskProjectEvidence,
  ITaskProjectModuleEvidence,
  TTaskProjectFreshnessState,
  TTaskProjectGraphState,
  TTaskProjectRisk,
  TTaskProjectRiskReason,
  TTaskScope,
} from './task-intelligence-contract.js';

const TASK_SCOPES = new Set<TTaskScope>([
  'local',
  'module',
  'multi-module',
  'repository',
  'unknown',
]);
const PROJECT_FRESHNESS_STATES = new Set<TTaskProjectFreshnessState>([
  'stale',
  'trusted',
  'unknown',
]);
const PROJECT_GRAPH_STATES = new Set<TTaskProjectGraphState>([
  'current',
  'missing',
  'stale',
]);
const PROJECT_RISKS = new Set<TTaskProjectRisk>([
  'high',
  'low',
  'medium',
  'unknown',
]);
const PROJECT_RISK_REASONS = new Set<TTaskProjectRiskReason>([
  'critical-invariants',
  'graph-missing',
  'graph-stale',
  'high-change-risk',
  'many-consumers',
  'public-api',
]);

const checkIsRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createValidationError = (message: string) =>
  new AmyRuntimeError({
    code: 'VALIDATION_FAILURE',
    message,
  });

const assertAllowedKeys = (
  value: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
  label: string,
) => {
  const unknownKeys = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknownKeys.length > 0) {
    throw createValidationError(
      `Unknown ${label} fields: ${unknownKeys.sort().join(', ')}`,
    );
  }
};

const validateStringArray = (
  value: unknown,
  label: string,
): readonly string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === 'string' && item.trim()) ||
    new Set(value).size !== value.length
  ) {
    throw createValidationError(
      `${label} must be an array of unique non-empty strings`,
    );
  }

  return Object.freeze([...value]);
};

const validateAffectedScope = (
  value: unknown,
): Readonly<ITaskAffectedScope> | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!checkIsRecord(value)) {
    throw createValidationError('Task affected scope must be an object');
  }

  assertAllowedKeys(value, ['kind', 'targets'], 'task affected scope');

  if (typeof value.kind !== 'string' || !TASK_SCOPES.has(value.kind as TTaskScope)) {
    throw createValidationError('Task affected scope kind is invalid');
  }

  const targets = validateStringArray(value.targets, 'Task affected scope targets');

  return Object.freeze({
    kind: value.kind as TTaskScope,
    ...(targets ? { targets } : {}),
  });
};

export const validateTaskContract = (
  value: unknown,
): Readonly<ITaskContract> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Task Contract must be an object');
  }

  assertAllowedKeys(
    value,
    [
      'acceptanceCriteria',
      'affectedScope',
      'constraints',
      'goal',
      'kind',
      'nonGoals',
      'requirements',
      'schemaVersion',
      'uncertainties',
      'verificationExpectations',
    ],
    'Task Contract',
  );

  if (
    value.kind !== 'task-contract' ||
    value.schemaVersion !== TASK_INTELLIGENCE_VERSIONS.taskContractSchema ||
    typeof value.goal !== 'string' ||
    !value.goal.trim()
  ) {
    throw createValidationError('Task Contract identity or goal is invalid');
  }

  const acceptanceCriteria = validateStringArray(
    value.acceptanceCriteria,
    'Task acceptance criteria',
  );
  const affectedScope = validateAffectedScope(value.affectedScope);
  const constraints = validateStringArray(value.constraints, 'Task constraints');
  const nonGoals = validateStringArray(value.nonGoals, 'Task non-goals');
  const requirements = validateStringArray(value.requirements, 'Task requirements');
  const uncertainties = validateStringArray(
    value.uncertainties,
    'Task uncertainties',
  );
  const verificationExpectations = validateStringArray(
    value.verificationExpectations,
    'Task verification expectations',
  );

  return Object.freeze({
    goal: value.goal,
    kind: 'task-contract',
    schemaVersion: TASK_INTELLIGENCE_VERSIONS.taskContractSchema,
    ...(acceptanceCriteria ? { acceptanceCriteria } : {}),
    ...(affectedScope ? { affectedScope } : {}),
    ...(constraints ? { constraints } : {}),
    ...(nonGoals ? { nonGoals } : {}),
    ...(requirements ? { requirements } : {}),
    ...(uncertainties ? { uncertainties } : {}),
    ...(verificationExpectations ? { verificationExpectations } : {}),
  });
};

const validateProjectModuleEvidence = (
  value: unknown,
): Readonly<ITaskProjectModuleEvidence> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Task project module evidence must be an object');
  }

  assertAllowedKeys(
    value,
    ['freshnessState', 'graphState', 'moduleId', 'risk', 'riskReasons'],
    'task project module evidence',
  );

  if (typeof value.moduleId !== 'string' || !value.moduleId.trim()) {
    throw createValidationError('Task project module evidence id is invalid');
  }

  if (
    value.freshnessState !== undefined &&
    (typeof value.freshnessState !== 'string' ||
      !PROJECT_FRESHNESS_STATES.has(
        value.freshnessState as TTaskProjectFreshnessState,
      ))
  ) {
    throw createValidationError('Task project freshness state is invalid');
  }

  if (
    value.graphState !== undefined &&
    (typeof value.graphState !== 'string' ||
      !PROJECT_GRAPH_STATES.has(value.graphState as TTaskProjectGraphState))
  ) {
    throw createValidationError('Task project graph state is invalid');
  }

  if (
    value.risk !== undefined &&
    (typeof value.risk !== 'string' ||
      !PROJECT_RISKS.has(value.risk as TTaskProjectRisk))
  ) {
    throw createValidationError('Task project risk is invalid');
  }

  if (
    value.riskReasons !== undefined &&
    (!Array.isArray(value.riskReasons) ||
      new Set(value.riskReasons).size !== value.riskReasons.length ||
      !value.riskReasons.every(
        (reason) =>
          typeof reason === 'string' &&
          PROJECT_RISK_REASONS.has(reason as TTaskProjectRiskReason),
      ))
  ) {
    throw createValidationError('Task project risk reasons are invalid');
  }

  const riskReasons = value.riskReasons
    ? Object.freeze([...value.riskReasons] as TTaskProjectRiskReason[])
    : undefined;

  return Object.freeze({
    moduleId: value.moduleId,
    ...(value.freshnessState
      ? { freshnessState: value.freshnessState as TTaskProjectFreshnessState }
      : {}),
    ...(value.graphState
      ? { graphState: value.graphState as TTaskProjectGraphState }
      : {}),
    ...(value.risk ? { risk: value.risk as TTaskProjectRisk } : {}),
    ...(riskReasons ? { riskReasons } : {}),
  });
};

const validateProjectEvidence = (
  value: unknown,
): Readonly<ITaskProjectEvidence> | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!checkIsRecord(value)) {
    throw createValidationError('Task project evidence must be an object');
  }

  assertAllowedKeys(value, ['kind', 'modules'], 'task project evidence');

  if (value.kind !== 'project-intelligence' || !Array.isArray(value.modules)) {
    throw createValidationError('Task project evidence is invalid');
  }

  const modules = Object.freeze(value.modules.map(validateProjectModuleEvidence));

  if (new Set(modules.map(({ moduleId }) => moduleId)).size !== modules.length) {
    throw createValidationError('Task project evidence module ids must be unique');
  }

  return Object.freeze({
    kind: 'project-intelligence',
    modules,
  });
};

export const validateTaskClassificationInput = (
  value: unknown,
): Readonly<ITaskClassificationInput> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Task classification input must be an object');
  }

  assertAllowedKeys(
    value,
    ['contract', 'projectEvidence'],
    'task classification input',
  );

  const contract = validateTaskContract(value.contract);
  const projectEvidence = validateProjectEvidence(value.projectEvidence);

  return Object.freeze({
    contract,
    ...(projectEvidence ? { projectEvidence } : {}),
  });
};
