import { OUTCOME_INTELLIGENCE_VERSIONS } from './outcome-intelligence-contract.js';
import { validateOutcomeInput } from './validate-outcome-intelligence.js';

import type { TRecoveryFailureClass } from '../recovery/recovery-contract.js';
import type {
  IOutcomeAssessment,
  IOutcomeFailure,
  IOutcomeInput,
  TOutcomeConfidence,
  TOutcomeFailureClass,
  TOutcomeFailureSource,
  TOutcomeReasonCode,
  TOutcomeStatus,
} from './outcome-intelligence-contract.js';

type TFailureDraft = Readonly<{
  evidenceRefs: readonly string[];
  failureClass: TOutcomeFailureClass;
  source: TOutcomeFailureSource;
  summary: string;
}>;

const mapRecoveryFailureClass = (
  failureClass: TRecoveryFailureClass,
): TOutcomeFailureClass => {
  switch (failureClass) {
    case 'architecture-uncertainty': return 'planning';
    case 'context-understanding': return 'context';
    case 'implementation': return 'implementation';
    case 'integration': return 'integration';
    case 'tool': return 'tool';
    case 'verification': return 'verification';
  }
};

const getCompletionStatus = (
  input: Readonly<IOutcomeInput>,
  reasonCodes: Set<TOutcomeReasonCode>,
): TOutcomeStatus => {
  const status = input.completionResult?.data.status;

  switch (status) {
    case 'complete':
      reasonCodes.add('completion-succeeded');
      return 'success';
    case 'failed':
      reasonCodes.add('completion-failed');
      return 'failure';
    case 'incomplete':
      reasonCodes.add('completion-incomplete');
      return 'partial_success';
    case 'unverified':
      reasonCodes.add('completion-unverified');
      return 'unverified';
    case undefined:
      reasonCodes.add('completion-evidence-missing');
      return 'unknown';
  }
};

const getConfidence = (status: TOutcomeStatus): TOutcomeConfidence => {
  switch (status) {
    case 'failure':
    case 'success':
      return 'high';
    case 'partial_success':
      return 'medium';
    case 'unknown':
    case 'unverified':
      return 'low';
  }
};

const getCompletionFailures = (
  input: Readonly<IOutcomeInput>,
): readonly TFailureDraft[] => {
  const completion = input.completionResult;

  if (!completion) return Object.freeze([]);

  const drafts: TFailureDraft[] = [];
  const { execution, integration, verification } = completion.data.evidence;

  if (execution.status === 'failed' || execution.status === 'incomplete') {
    drafts.push(Object.freeze({
      evidenceRefs: execution.evidenceRefs,
      failureClass: 'implementation',
      source: 'completion',
      summary:
        execution.reason ??
        completion.data.evidence.unresolvedIssues[0] ??
        (execution.status === 'failed'
          ? 'Execution failed.'
          : 'Execution remained incomplete.'),
    }));
  }

  if (integration.status === 'failed' || integration.status === 'incomplete') {
    drafts.push(Object.freeze({
      evidenceRefs: integration.evidenceRefs,
      failureClass: 'integration',
      source: 'completion',
      summary:
        integration.reason ??
        (integration.status === 'failed'
          ? 'Integration failed.'
          : 'Integration remained incomplete.'),
    }));
  }

  if (verification.status === 'failed') {
    drafts.push(Object.freeze({
      evidenceRefs: Object.freeze([`verification:${verification.verificationId}`]),
      failureClass: 'verification',
      source: 'completion',
      summary: 'Canonical verification evidence failed.',
    }));
  }

  if (completion.data.status === 'failed' && drafts.length === 0) {
    drafts.push(Object.freeze({
      evidenceRefs: Object.freeze([`completion:${completion.data.completionId}`]),
      failureClass: 'unknown',
      source: 'completion',
      summary: 'Completion failed without a more specific failure class.',
    }));
  }

  return Object.freeze(drafts);
};

const getRecoveryFailures = (
  input: Readonly<IOutcomeInput>,
): readonly TFailureDraft[] =>
  Object.freeze(
    (input.recoveryPlans ?? []).map(({ data }) =>
      Object.freeze({
        evidenceRefs: data.diagnosis.evidenceRefs,
        failureClass: mapRecoveryFailureClass(data.diagnosis.failureClass),
        source: 'recovery' as const,
        summary: data.diagnosis.summary,
      }),
    ),
  );

const getPostTaskFailures = (
  input: Readonly<IOutcomeInput>,
): readonly TFailureDraft[] =>
  Object.freeze(
    (input.postTaskSignals ?? []).map((signal) =>
      Object.freeze({
        evidenceRefs: signal.evidenceRefs,
        failureClass: signal.failureClass ?? 'unknown',
        source: 'post-task' as const,
        summary: signal.summary,
      }),
    ),
  );

const materializeFailures = (
  outcomeId: string,
  drafts: readonly TFailureDraft[],
): readonly Readonly<IOutcomeFailure>[] =>
  Object.freeze(
    drafts.map((draft, index) =>
      Object.freeze({
        ...draft,
        failureId: `${outcomeId}:failure:${index + 1}`,
        kind: 'failure-intelligence' as const,
        schemaVersion: OUTCOME_INTELLIGENCE_VERSIONS.failureSchema,
      }),
    ),
  );

const deriveAttemptCounts = (
  input: Readonly<IOutcomeInput>,
): Readonly<{ escalationCount: number; retryCount: number }> => {
  let retryCount = input.completionResult?.data.guard.retryCount ?? 0;
  let escalationCount = 0;

  for (const { data } of input.recoveryPlans ?? []) {
    retryCount = Math.max(
      retryCount,
      data.attempt.retryCount,
      data.attempt.nextRetryCount ?? 0,
    );
    escalationCount = Math.max(
      escalationCount,
      data.attempt.escalationCount,
      data.attempt.nextEscalationCount ?? 0,
    );
  }

  return Object.freeze({ escalationCount, retryCount });
};

const getOutcomeEvidenceRefs = (
  input: Readonly<IOutcomeInput>,
): readonly string[] => {
  const refs: string[] = [];
  const completion = input.completionResult;

  if (completion) {
    refs.push(`completion:${completion.data.completionId}`);
    refs.push(...completion.data.evidence.execution.evidenceRefs);
    refs.push(...completion.data.evidence.integration.evidenceRefs);
    refs.push(`verification:${completion.data.evidence.verification.verificationId}`);

    for (const check of completion.data.evidence.checks) {
      refs.push(...check.evidenceRefs);
    }
  }

  for (const recoveryPlan of input.recoveryPlans ?? []) {
    refs.push(...recoveryPlan.data.diagnosis.evidenceRefs);
  }

  for (const signal of input.postTaskSignals ?? []) {
    refs.push(...signal.evidenceRefs);
  }

  return Object.freeze([...new Set(refs)].sort());
};

const applyPostTaskSignals = (
  status: TOutcomeStatus,
  input: Readonly<IOutcomeInput>,
  reasonCodes: Set<TOutcomeReasonCode>,
): TOutcomeStatus => {
  let hasPartial = false;

  for (const signal of input.postTaskSignals ?? []) {
    if (signal.impact === 'failure') {
      reasonCodes.add('post-task-failure-signal');
      return 'failure';
    }

    hasPartial = true;
  }

  if (hasPartial) {
    reasonCodes.add('post-task-partial-signal');

    if (status === 'success') return 'partial_success';
  }

  return status;
};

export const assessOutcome = (value: unknown): Readonly<IOutcomeAssessment> => {
  const input = validateOutcomeInput(value);
  const reasonCodes = new Set<TOutcomeReasonCode>();
  let status = getCompletionStatus(input, reasonCodes);

  status = applyPostTaskSignals(status, input, reasonCodes);

  if ((input.recoveryPlans?.length ?? 0) > 0) {
    reasonCodes.add('recovery-observed');
  }

  const failureDrafts = [
    ...getCompletionFailures(input),
    ...getRecoveryFailures(input),
    ...getPostTaskFailures(input),
  ];
  const failures = materializeFailures(input.outcomeId, failureDrafts);

  if (failures.length > 0) {
    reasonCodes.add('failure-classified');
  }

  const evidenceRefs = getOutcomeEvidenceRefs(input);
  const unresolvedIssues = Object.freeze([
    ...(input.completionResult?.data.evidence.unresolvedIssues ?? []),
  ]);
  const confidence = status === 'failure' && (input.postTaskSignals?.some(({ impact }) => impact === 'failure') ?? false)
    ? 'high'
    : getConfidence(status);

  return Object.freeze({
    attempts: deriveAttemptCounts(input),
    confidence,
    evidenceRefs,
    failures,
    kind: 'outcome-assessment',
    outcomeId: input.outcomeId,
    reasonCodes: Object.freeze([...reasonCodes].sort()),
    schemaVersion: OUTCOME_INTELLIGENCE_VERSIONS.outcomeSchema,
    status,
    taskId: input.taskId,
    unresolvedIssues,
  });
};
