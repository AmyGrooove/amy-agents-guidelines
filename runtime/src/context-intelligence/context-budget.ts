import type {
  IContextBudgetLimits,
  TContextBudgetProfile,
} from './context-intelligence-contract.js';
import type { TTaskLevel } from '../task-intelligence/task-intelligence-contract.js';

const CONTEXT_BUDGETS: Readonly<Record<TContextBudgetProfile, IContextBudgetLimits>> = Object.freeze({
  large: Object.freeze({ maxFiles: 16, maxModules: 6, maxSpecItems: 60 }),
  small: Object.freeze({ maxFiles: 4, maxModules: 1, maxSpecItems: 12 }),
  standard: Object.freeze({ maxFiles: 8, maxModules: 3, maxSpecItems: 30 }),
});

export const chooseContextBudgetProfile = (
  expectedContextCost: TTaskLevel,
  override?: TContextBudgetProfile,
): TContextBudgetProfile => {
  if (override) {
    return override;
  }

  if (expectedContextCost === 'high') {
    return 'large';
  }

  if (expectedContextCost === 'low') {
    return 'small';
  }

  return 'standard';
};

export const getContextBudgetLimits = (
  profile: TContextBudgetProfile,
): Readonly<IContextBudgetLimits> => CONTEXT_BUDGETS[profile];
