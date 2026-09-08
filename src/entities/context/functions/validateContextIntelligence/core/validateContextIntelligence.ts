import { isRecord } from '#shared/functions/checks/isRecord';

import { AmyRuntimeError } from '#entities/runtime';
import { validateTaskIntelligenceAnalysis } from '#entities/task';

import type {
  IContextResolutionInput,
  TContextBudgetProfile,
} from '../../../types/contextIntelligenceContract.js';

const CONTEXT_BUDGET_PROFILES = new Set<TContextBudgetProfile>([
  'large',
  'small',
  'standard',
]);


const createValidationError = (message: string) =>
  new AmyRuntimeError({
    code: 'VALIDATION_FAILURE',
    message,
  });

export const validateContextResolutionInput = (
  value: unknown,
): Readonly<IContextResolutionInput> => {
  if (!isRecord(value)) {
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
