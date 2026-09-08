import {
  COMPLETION_VERSIONS,
  DEFAULT_COMPLETION_POLICY,
} from './completion-contract.js';
import { validateCompletionInput } from './validate-completion.js';

import type {
  ICompletionInput,
  ICompletionResultData,
  TCompletionConfidence,
  TCompletionGuardDecision,
  TCompletionReasonCode,
  TCompletionResult,
  TCompletionStatus,
} from './completion-contract.js';

const getRequirements = (input: Readonly<ICompletionInput>) => {
  const { goal, requirements } = input.taskAnalysis.data.contract;
  return requirements && requirements.length > 0 ? requirements : [goal];
};

const getAcceptanceCriteria = (input: Readonly<ICompletionInput>) => {
  const { acceptanceCriteria, goal } = input.taskAnalysis.data.contract;
  return acceptanceCriteria && acceptanceCriteria.length > 0 ? acceptanceCriteria : [goal];
};

const deriveStatus = (input: Readonly<ICompletionInput>): TCompletionStatus => {
  const verificationStatus = input.verificationResult.data.status;

  if (
    input.execution.status === 'failed' ||
    input.integration.status === 'failed' ||
    verificationStatus === 'failed'
  ) {
    return 'failed';
  }

  if (
    input.execution.status === 'unverified' ||
    input.integration.status === 'unverified' ||
    verificationStatus === 'unverified'
  ) {
    return 'unverified';
  }

  if (
    input.execution.status === 'incomplete' ||
    input.integration.status === 'incomplete' ||
    verificationStatus === 'pending' ||
    input.execution.unresolvedIssues.length > 0
  ) {
    return 'incomplete';
  }

  return 'complete';
};

const getConfidence = (status: TCompletionStatus): TCompletionConfidence => {
  if (status === 'unverified') return 'low';
  if (status === 'incomplete') return 'medium';
  return 'high';
};

const getExecutionReason = (status: ICompletionInput['execution']['status']): TCompletionReasonCode => {
  switch (status) {
    case 'completed': return 'execution-completed';
    case 'failed': return 'execution-failed';
    case 'incomplete': return 'execution-incomplete';
    case 'unverified': return 'execution-unverified';
  }
};

const getIntegrationReason = (
  status: ICompletionInput['integration']['status'],
): TCompletionReasonCode => {
  switch (status) {
    case 'completed': return 'integration-completed';
    case 'failed': return 'integration-failed';
    case 'incomplete': return 'integration-incomplete';
    case 'not-required': return 'integration-not-required';
    case 'unverified': return 'integration-unverified';
  }
};

const getVerificationReason = (
  status: ICompletionInput['verificationResult']['data']['status'],
): TCompletionReasonCode => {
  switch (status) {
    case 'failed': return 'verification-failed';
    case 'passed': return 'verification-passed';
    case 'pending': return 'verification-pending';
    case 'unverified': return 'verification-unverified';
  }
};

const getGuardDecision = (
  status: TCompletionStatus,
  retryCount: number,
  maxRetries: number,
): TCompletionGuardDecision => {
  if (status === 'complete') return 'complete';
  if (retryCount < maxRetries) return 'retry';
  if (status === 'failed') return 'stop-failed';
  if (status === 'unverified') return 'stop-unverified';
  return 'stop-incomplete';
};

const getUnresolvedIssues = (input: Readonly<ICompletionInput>) => {
  const issues = [...input.execution.unresolvedIssues];

  if (input.execution.status !== 'completed' && input.execution.reason) {
    issues.push(input.execution.reason);
  }
  if (
    input.integration.status !== 'completed' &&
    input.integration.status !== 'not-required' &&
    input.integration.reason
  ) {
    issues.push(input.integration.reason);
  }

  return Object.freeze([...new Set(issues)]);
};

const getEvidenceGaps = (input: Readonly<ICompletionInput>) => {
  const gaps: string[] = [];

  if (input.execution.status === 'unverified') {
    gaps.push(`execution:${input.execution.reason ?? 'unverified'}`);
  }
  if (input.integration.status === 'unverified') {
    gaps.push(`integration:${input.integration.reason ?? 'unverified'}`);
  }
  if (input.verificationResult.data.status === 'unverified') {
    input.verificationResult.data.reasonCodes
      .filter((code) => code.includes('gap') || code.includes('unverified'))
      .forEach((code) => gaps.push(`verification:${code}`));
  }

  return Object.freeze([...new Set(gaps)].sort());
};

export const runCompletionProtocol = (value: unknown): Readonly<TCompletionResult> => {
  const input = validateCompletionInput(value);
  const checks = input.verificationResult.data.mechanical.checks;
  const maxRetries = input.guard?.maxRetries ?? DEFAULT_COMPLETION_POLICY.maxGuardRetries;
  const retryCount = input.guard?.retryCount ?? 0;
  const status = deriveStatus(input);
  const decision = getGuardDecision(status, retryCount, maxRetries);
  const reasonCodes = new Set<TCompletionReasonCode>([
    getExecutionReason(input.execution.status),
    getIntegrationReason(input.integration.status),
    getVerificationReason(input.verificationResult.data.status),
  ]);

  const unresolvedIssues = getUnresolvedIssues(input);

  if (unresolvedIssues.length > 0) {
    reasonCodes.add('unresolved-issues');
  }
  if (status === 'complete') {
    reasonCodes.add('completion-evidence-sufficient');
  } else if (decision === 'retry') {
    reasonCodes.add('guard-retry-allowed');
  } else {
    reasonCodes.add('guard-retry-exhausted');
  }

  const data: ICompletionResultData = Object.freeze({
    completionId: input.completionId,
    confidence: getConfidence(status),
    evidence: Object.freeze({
      acceptanceCriteria: Object.freeze([...getAcceptanceCriteria(input)]),
      checks,
      evidenceGaps: getEvidenceGaps(input),
      execution: input.execution,
      integration: input.integration,
      kind: 'completion-evidence' as const,
      requirements: Object.freeze([...getRequirements(input)]),
      schemaVersion: COMPLETION_VERSIONS.evidenceSchema,
      skippedChecks: Object.freeze(
        checks.filter(({ status: checkStatus }) =>
          checkStatus === 'skipped' || checkStatus === 'unavailable'),
      ),
      unresolvedIssues,
      verification: Object.freeze({
        reasonCodes: input.verificationResult.data.reasonCodes,
        status: input.verificationResult.data.status,
        verificationId: input.verificationResult.data.verificationId,
      }),
    }),
    guard: Object.freeze({
      decision,
      maxRetries,
      retriesRemaining: Math.max(0, maxRetries - retryCount),
      retryCount,
    }),
    policyVersion: COMPLETION_VERSIONS.policy,
    reasonCodes: Object.freeze([...reasonCodes].sort()),
    status,
  });

  return Object.freeze({
    data,
    kind: 'quality-result' as const,
    schemaVersion: COMPLETION_VERSIONS.resultSchema,
  });
};
