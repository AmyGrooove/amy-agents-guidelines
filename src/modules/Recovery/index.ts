export { Recovery, planRecovery } from './core/Recovery.js';
export type { IPlanRecoveryOptions } from './core/Recovery.js';
export { createRecoveryCapability } from './functions/createRecoveryCapability/index.js';
export type { ICreateRecoveryCapabilityOptions } from './functions/createRecoveryCapability/index.js';
export {
  DEFAULT_RECOVERY_POLICY,
  RECOVERY_LIMITS,
  RECOVERY_VERSIONS,
  validateRecoveryInput,
  validateRecoveryPlan,
  validateRecoveryPolicy,
} from '#entities/executionResult';
export type {
  IRecoveryApi,
  IRecoveryAttemptState,
  IRecoveryBranch,
  IRecoveryDiagnosis,
  IRecoveryFact,
  IRecoveryFailureSignal,
  IRecoveryInput,
  IRecoveryPlanData,
  IRecoveryPolicyConfig,
  TRecoveryAction,
  TRecoveryBranchKind,
  TRecoveryFailureClass,
  TRecoveryPlan,
  TRecoveryReasonCode,
} from '#entities/executionResult';
