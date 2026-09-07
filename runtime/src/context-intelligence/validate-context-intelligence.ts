import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { validateTaskIntelligenceAnalysis } from '../task-intelligence/validate-task-intelligence.js';

import type {
  IContextResolutionInput,
  TContextBudgetProfile,
} from './context-intelligence-contract.js';

const CONTEXT_BUDGET_PROFILES = new Set<TContextBudgetProfile>([
  'large',
  'small',
  'standard',
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

export const validateContextResolutionInput = (
  value: unknown,
): Readonly<IContextResolutionInput> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Context resolution input must be an object');
  }

  const unknownKeys = Object.keys(value).filter(
    (key) => !['budgetProfile', 'taskAnalysis'].includes(key),
  );

  if (unknownKeys.length > 0) {
    throw createValidationError(
      `Unknown context resolution input fields: ${unknownKeys.sort().join(', ')}`,
    );
  }

  if (
    value.budgetProfile !== undefined &&
    (typeof value.budgetProfile !== 'string' ||
      !CONTEXT_BUDGET_PROFILES.has(value.budgetProfile as TContextBudgetProfile))
  ) {
    throw createValidationError('Context budget profile is invalid');
  }

  return Object.freeze({
    ...(value.budgetProfile
      ? { budgetProfile: value.budgetProfile as TContextBudgetProfile }
      : {}),
    taskAnalysis: validateTaskIntelligenceAnalysis(value.taskAnalysis),
  });
};
