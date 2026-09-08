import {
  DEFAULT_RECOVERY_POLICY,
  RECOVERY_VERSIONS,
} from './recovery-contract.js';
import {
  validateRecoveryInput,
  validateRecoveryPolicy,
} from './validate-recovery.js';

import type {
  IRecoveryAttemptState,
  IRecoveryInput,
  IRecoveryPlanData,
  IRecoveryPolicyConfig,
  TRecoveryAction,
  TRecoveryReasonCode,
  TRecoveryPlan,
} from './recovery-contract.js';

export interface IPlanRecoveryOptions {
  policy?: Readonly<IRecoveryPolicyConfig>;
}

const mapAction = (
  failure: Readonly<IRecoveryInput['failure']>,
): TRecoveryAction => {
  switch (failure.failureClass) {
    case 'architecture-uncertainty': return 'compute-escalate';
    case 'context-understanding': return 'context-expand';
    case 'implementation': return 'debugger';
    case 'integration':
    case 'verification':
      return failure.directRetryAllowed ? 'retry' : 'debugger';
    case 'tool':
      return failure.directRetryAllowed ? 'retry' : 'stop';
  }
};

const getActionReason = (action: TRecoveryAction): TRecoveryReasonCode | undefined => {
  switch (action) {
    case 'compute-escalate': return 'compute-escalation-required';
    case 'context-expand': return 'context-expansion-required';
    case 'debugger': return 'debugger-required';
    case 'retry': return 'scoped-retry';
    case 'stop': return undefined;
  }
};

const getAttemptState = (
  input: Readonly<IRecoveryInput>,
  maxEscalations: number,
  action: TRecoveryAction,
): Readonly<IRecoveryAttemptState> => {
  const retryCount = input.completionResult.data.guard.retryCount;
  const maxRetries = input.completionResult.data.guard.maxRetries;
  const escalationCount = input.escalationCount ?? 0;
  const isActionable = action !== 'stop';
  const consumesEscalation = action === 'compute-escalate';
  const nextRetryCount = isActionable ? retryCount + 1 : undefined;
  const nextEscalationCount = consumesEscalation ? escalationCount + 1 : undefined;

  return Object.freeze({
    escalationCount,
    escalationsRemaining: Math.max(
      0,
      maxEscalations - (nextEscalationCount ?? escalationCount),
    ),
    retriesRemaining: Math.max(0, maxRetries - (nextRetryCount ?? retryCount)),
    retryCount,
    ...(nextEscalationCount !== undefined ? { nextEscalationCount } : {}),
    ...(nextRetryCount !== undefined ? { nextRetryCount } : {}),
  });
};

export const planRecovery = (
  value: unknown,
  options: IPlanRecoveryOptions = {},
): Readonly<TRecoveryPlan> => {
  const input = validateRecoveryInput(value);
  const policy = validateRecoveryPolicy(options.policy ?? DEFAULT_RECOVERY_POLICY);
  const reasonCodes = new Set<TRecoveryReasonCode>(['failure-diagnosed']);
  const requestedAction = mapAction(input.failure);
  const guard = input.completionResult.data.guard;
  const escalationCount = input.escalationCount ?? 0;
  let action: TRecoveryAction = requestedAction;
  let requiresVerification = true;

  if ((input.preservedFacts?.length ?? 0) > 0) {
    reasonCodes.add('failure-evidence-preserved');
  }

  if (input.completionResult.data.status === 'complete') {
    action = 'stop';
    requiresVerification = false;
    reasonCodes.add('completion-already-complete');
  } else if (guard.decision !== 'retry') {
    action = 'stop';
    requiresVerification = false;
    reasonCodes.add('completion-guard-terminal');
  } else if (requestedAction === 'stop' && !input.failure.directRetryAllowed) {
    action = 'stop';
    requiresVerification = false;
    reasonCodes.add('direct-retry-not-authorized');
  } else if (requestedAction === 'compute-escalate' && escalationCount >= policy.maxEscalations) {
    action = 'stop';
    requiresVerification = false;
    reasonCodes.add('escalation-budget-exhausted');
  } else {
    reasonCodes.add('retry-budget-available');
    reasonCodes.add('verification-required');
    const actionReason = getActionReason(requestedAction);
    if (actionReason) reasonCodes.add(actionReason);
  }

  const data: IRecoveryPlanData = Object.freeze({
    action,
    attempt: getAttemptState(input, policy.maxEscalations, action),
    diagnosis: Object.freeze({
      branch: input.failure.branch,
      directRetryAllowed: input.failure.directRetryAllowed,
      evidenceRefs: input.failure.evidenceRefs,
      failureClass: input.failure.failureClass,
      kind: 'recovery-diagnosis' as const,
      schemaVersion: RECOVERY_VERSIONS.diagnosisSchema,
      summary: input.failure.summary,
    }),
    policyVersion: RECOVERY_VERSIONS.policy,
    preservedFacts: input.preservedFacts ?? Object.freeze([]),
    reasonCodes: Object.freeze([...reasonCodes].sort()),
    recoveryId: input.recoveryId,
    requiresVerification,
  });

  return Object.freeze({
    data,
    kind: 'execution-plan' as const,
    schemaVersion: RECOVERY_VERSIONS.planSchema,
  });
};
