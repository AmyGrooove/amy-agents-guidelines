import { validateAgentHandoff } from '#entities/agentRole';
import { VERIFICATION_VERSIONS } from '#entities/verificationResult';
import { validateVerificationInput } from '#entities/verificationResult';

import type { IAgentHandoff, TAgentRole } from '#entities/agentRole';
import type { ITaskContract } from '#entities/task';
import type {
  IMechanicalVerificationResult,
  IReviewVerificationResult,
  ISemanticVerificationResult,
  IVerificationInput,
  IVerifierCriterionResult,
  TVerificationCriterionKind,
  TVerificationReasonCode,
  TVerificationResult,
  TVerificationStageStatus,
  TVerificationStatus,
} from '#entities/verificationResult';

const getRequirements = (contract: Readonly<ITaskContract>) =>
  contract.requirements && contract.requirements.length > 0
    ? contract.requirements
    : [contract.goal];

const getAcceptanceCriteria = (contract: Readonly<ITaskContract>) =>
  contract.acceptanceCriteria && contract.acceptanceCriteria.length > 0
    ? contract.acceptanceCriteria
    : [contract.goal];

const getReadTargets = (contract: Readonly<ITaskContract>) =>
  contract.affectedScope?.targets ?? [];

const createHandoff = (
  input: Readonly<IVerificationInput>,
  role: Extract<TAgentRole, 'reviewer' | 'verifier'>,
): Readonly<IAgentHandoff> => {
  const contract = input.taskAnalysis.data.contract;
  const inputs = [
    { kind: 'task-analysis' as const, ref: input.artifacts.taskAnalysisRef },
    { kind: 'implementation-result' as const, ref: input.artifacts.implementationResultRef },
    {
      kind: 'verification-evidence' as const,
      ref: `verification:${input.verificationId}:mechanical`,
    },
    ...(input.artifacts.contextPacketRef
      ? [{ kind: 'context-packet' as const, ref: input.artifacts.contextPacketRef }]
      : []),
  ];

  return validateAgentHandoff({
    acceptanceCriteria: getAcceptanceCriteria(contract),
    constraints: contract.constraints ?? [],
    expectedOutputs: [role === 'verifier' ? 'verification-result' : 'review-findings'],
    goal: role === 'verifier'
      ? `Verify task: ${contract.goal}`
      : `Review task result: ${contract.goal}`,
    handoffId: `${input.verificationId}:${role}`,
    inputs,
    kind: 'agent-handoff',
    nonGoals: contract.nonGoals ?? [],
    requirements: getRequirements(contract),
    schemaVersion: 1,
    scope: {
      readTargets: getReadTargets(contract),
      writeTargets: [],
    },
    source: { kind: 'orchestrator' },
    targetRole: role,
  });
};

const evaluateMechanical = (
  input: Readonly<IVerificationInput>,
): Readonly<IMechanicalVerificationResult> => {
  const checks = input.mechanicalChecks;
  const expectsVerification = (input.taskAnalysis.data.contract.verificationExpectations?.length ?? 0) > 0;

  if (checks.length === 0) {
    const status: TVerificationStageStatus = expectsVerification ? 'unverified' : 'not-required';
    return Object.freeze({
      checks,
      reasonCodes: Object.freeze([
        expectsVerification ? 'mechanical-check-gap' : 'mechanical-not-requested',
      ] as const),
      status,
    });
  }

  if (checks.some(({ status }) => status === 'failed')) {
    return Object.freeze({
      checks,
      reasonCodes: Object.freeze(['mechanical-check-failed'] as const),
      status: 'failed' as const,
    });
  }

  if (checks.some(({ status }) => status === 'skipped' || status === 'unavailable')) {
    return Object.freeze({
      checks,
      reasonCodes: Object.freeze(['mechanical-check-gap'] as const),
      status: 'unverified' as const,
    });
  }

  return Object.freeze({
    checks,
    reasonCodes: Object.freeze(['mechanical-checks-passed'] as const),
    status: 'passed' as const,
  });
};

const createExpectedCriteria = (
  contract: Readonly<ITaskContract>,
): readonly Readonly<Pick<IVerifierCriterionResult, 'kind' | 'subject'>>[] => {
  const criteria = [
    ...(contract.requirements ?? []).map((subject) => ({
      kind: 'requirement' as const,
      subject,
    })),
    ...(contract.acceptanceCriteria ?? []).map((subject) => ({
      kind: 'acceptance-criterion' as const,
      subject,
    })),
  ];

  if (criteria.length > 0) {
    return Object.freeze(criteria);
  }

  return Object.freeze([{ kind: 'goal' as const, subject: contract.goal }]);
};

const criterionKey = (
  criterion: Readonly<{ kind: TVerificationCriterionKind; subject: string }>,
) => `${criterion.kind}:${criterion.subject}`;

const evaluateSemantic = (
  input: Readonly<IVerificationInput>,
): Readonly<ISemanticVerificationResult> => {
  if (input.strategyDecision.data.verification === 'none') {
    return Object.freeze({
      criteria: Object.freeze([]),
      reasonCodes: Object.freeze(['semantic-not-required'] as const),
      status: 'not-required' as const,
    });
  }

  const handoff = createHandoff(input, 'verifier');
  const report = input.verifierReport;

  if (!report) {
    return Object.freeze({
      criteria: Object.freeze([]),
      handoff,
      reasonCodes: Object.freeze(['semantic-pending'] as const),
      status: 'pending' as const,
    });
  }

  if (report.result.handoffId !== handoff.handoffId) {
    return Object.freeze({
      criteria: report.criteria,
      handoff,
      reasonCodes: Object.freeze(['semantic-unverified'] as const),
      status: 'unverified' as const,
    });
  }

  if (report.result.status !== 'completed' || report.result.unresolvedIssues.length > 0) {
    return Object.freeze({
      criteria: report.criteria,
      handoff,
      reasonCodes: Object.freeze(['semantic-unverified'] as const),
      status: 'unverified' as const,
    });
  }

  const expected = createExpectedCriteria(input.taskAnalysis.data.contract);
  const reportedByKey = new Map(report.criteria.map((criterion) => [criterionKey(criterion), criterion] as const));
  const missing = expected.some((criterion) => !reportedByKey.has(criterionKey(criterion)));
  const failed = report.criteria.some(({ status }) => status === 'not-met');
  const unknown = report.criteria.some(({ status }) => status === 'unknown');

  if (failed) {
    return Object.freeze({
      criteria: report.criteria,
      handoff,
      reasonCodes: Object.freeze(['semantic-criterion-failed'] as const),
      status: 'failed' as const,
    });
  }

  if (missing || unknown) {
    return Object.freeze({
      criteria: report.criteria,
      handoff,
      reasonCodes: Object.freeze(['semantic-criterion-gap'] as const),
      status: 'unverified' as const,
    });
  }

  return Object.freeze({
    criteria: report.criteria,
    handoff,
    reasonCodes: Object.freeze(['semantic-passed'] as const),
    status: 'passed' as const,
  });
};

const evaluateReview = (
  input: Readonly<IVerificationInput>,
): Readonly<IReviewVerificationResult> => {
  if (input.strategyDecision.data.review === 'none') {
    return Object.freeze({
      findings: Object.freeze([]),
      reasonCodes: Object.freeze(['review-not-required'] as const),
      status: 'not-required' as const,
    });
  }

  const handoff = createHandoff(input, 'reviewer');
  const report = input.reviewerReport;

  if (!report) {
    return Object.freeze({
      findings: Object.freeze([]),
      handoff,
      reasonCodes: Object.freeze(['review-pending'] as const),
      status: 'pending' as const,
    });
  }

  if (
    report.result.handoffId !== handoff.handoffId ||
    report.result.status !== 'completed' ||
    report.result.unresolvedIssues.length > 0
  ) {
    return Object.freeze({
      findings: report.findings,
      handoff,
      reasonCodes: Object.freeze(['review-unverified'] as const),
      status: 'unverified' as const,
    });
  }

  if (report.findings.some(({ severity }) => severity === 'required')) {
    return Object.freeze({
      findings: report.findings,
      handoff,
      reasonCodes: Object.freeze(['review-finding-required'] as const),
      status: 'failed' as const,
    });
  }

  return Object.freeze({
    findings: report.findings,
    handoff,
    reasonCodes: Object.freeze(['review-passed'] as const),
    status: 'passed' as const,
  });
};

const deriveStatus = (
  statuses: readonly TVerificationStageStatus[],
): TVerificationStatus => {
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('pending')) return 'pending';
  if (statuses.includes('unverified')) return 'unverified';
  return 'passed';
};

export const Verification = (
  value: unknown,
): Readonly<TVerificationResult> => {
  const input = validateVerificationInput(value);
  const mechanical = evaluateMechanical(input);
  const semantic = evaluateSemantic(input);
  const review = evaluateReview(input);
  const reasonCodes = new Set<TVerificationReasonCode>([
    ...mechanical.reasonCodes,
    ...semantic.reasonCodes,
    ...review.reasonCodes,
  ]);

  return Object.freeze({
    data: Object.freeze({
      mechanical,
      policyVersion: VERIFICATION_VERSIONS.policy,
      reasonCodes: Object.freeze([...reasonCodes].sort()),
      review,
      semantic,
      status: deriveStatus([mechanical.status, semantic.status, review.status]),
      verificationId: input.verificationId,
    }),
    kind: 'quality-result' as const,
    schemaVersion: VERIFICATION_VERSIONS.resultSchema,
  });
};

export { Verification as runVerificationPipeline };
