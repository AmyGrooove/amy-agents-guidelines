import { isRecord } from '#shared/functions/checks/isRecord';

import { validateAgentHandoff, validateAgentHandoffResult } from '#entities/agentRole';
import { AmyRuntimeError } from '#entities/runtime';
import { validateStrategyRoutingDecision } from '#entities/executionPlan';
import { validateTaskIntelligenceAnalysis } from '#entities/task';
import { VERIFICATION_VERSIONS } from '../../../types/verificationContract.js';

import type {
  IMechanicalVerificationCheck,
  IMechanicalVerificationResult,
  IReviewFinding,
  IReviewVerificationResult,
  IReviewerReport,
  ISemanticVerificationResult,
  IVerificationArtifactRefs,
  IVerificationInput,
  TVerificationResult,
  IVerifierCriterionResult,
  IVerifierReport,
  TMechanicalCheckKind,
  TMechanicalCheckStatus,
  TReviewFindingSeverity,
  TVerificationCriterionKind,
  TVerificationCriterionStatus,
  TVerificationReasonCode,
  TVerificationStageStatus,
  TVerificationStatus,
} from '../../../types/verificationContract.js';

const MECHANICAL_KINDS = new Set<TMechanicalCheckKind>([
  'build',
  'lint',
  'project-command',
  'test',
  'typecheck',
]);
const MECHANICAL_STATUSES = new Set<TMechanicalCheckStatus>([
  'failed',
  'passed',
  'skipped',
  'unavailable',
]);
const CRITERION_KINDS = new Set<TVerificationCriterionKind>([
  'acceptance-criterion',
  'goal',
  'requirement',
]);
const CRITERION_STATUSES = new Set<TVerificationCriterionStatus>([
  'met',
  'not-met',
  'unknown',
]);
const REVIEW_SEVERITIES = new Set<TReviewFindingSeverity>(['advisory', 'required']);
const VERIFICATION_STAGE_STATUSES = new Set<TVerificationStageStatus>([
  'failed',
  'not-required',
  'passed',
  'pending',
  'unverified',
]);
const VERIFICATION_STATUSES = new Set<TVerificationStatus>([
  'failed',
  'passed',
  'pending',
  'unverified',
]);
const VERIFICATION_REASON_CODES = new Set<TVerificationReasonCode>([
  'mechanical-check-failed',
  'mechanical-check-gap',
  'mechanical-checks-passed',
  'mechanical-not-requested',
  'review-finding-required',
  'review-not-required',
  'review-passed',
  'review-pending',
  'review-unverified',
  'semantic-criterion-failed',
  'semantic-criterion-gap',
  'semantic-not-required',
  'semantic-passed',
  'semantic-pending',
  'semantic-unverified',
]);


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

  const values = value.map((item) => validateNonEmptyString(item, label));

  if (new Set(values).size !== values.length) {
    throw createValidationError(`${label} must not contain duplicates`);
  }

  return Object.freeze([...values]);
};

const validateArtifacts = (value: unknown): Readonly<IVerificationArtifactRefs> => {
  if (!isRecord(value)) {
    throw createValidationError('Verification artifacts must be an object');
  }

  assertAllowedKeys(
    value,
    ['contextPacketRef', 'implementationResultRef', 'taskAnalysisRef'],
    'Verification artifacts',
  );

  const contextPacketRef = value.contextPacketRef === undefined
    ? undefined
    : validateNonEmptyString(value.contextPacketRef, 'Verification contextPacketRef');

  return Object.freeze({
    ...(contextPacketRef ? { contextPacketRef } : {}),
    implementationResultRef: validateNonEmptyString(
      value.implementationResultRef,
      'Verification implementationResultRef',
    ),
    taskAnalysisRef: validateNonEmptyString(
      value.taskAnalysisRef,
      'Verification taskAnalysisRef',
    ),
  });
};

const validateMechanicalCheck = (value: unknown): Readonly<IMechanicalVerificationCheck> => {
  if (!isRecord(value)) {
    throw createValidationError('Mechanical verification check must be an object');
  }

  assertAllowedKeys(
    value,
    ['evidenceRefs', 'id', 'kind', 'label', 'reason', 'status'],
    'Mechanical verification check',
  );

  if (!MECHANICAL_KINDS.has(value.kind as TMechanicalCheckKind)) {
    throw createValidationError('Mechanical verification check kind is invalid');
  }
  if (!MECHANICAL_STATUSES.has(value.status as TMechanicalCheckStatus)) {
    throw createValidationError('Mechanical verification check status is invalid');
  }

  const status = value.status as TMechanicalCheckStatus;
  const evidenceRefs = validateStringList(
    value.evidenceRefs,
    'Mechanical verification evidenceRefs',
  );
  const reason = value.reason === undefined
    ? undefined
    : validateNonEmptyString(value.reason, 'Mechanical verification reason');

  if ((status === 'passed' || status === 'failed') && evidenceRefs.length === 0) {
    throw createValidationError(`${status} mechanical verification check requires evidence`);
  }
  if ((status === 'skipped' || status === 'unavailable') && !reason) {
    throw createValidationError(`${status} mechanical verification check requires a reason`);
  }

  return Object.freeze({
    evidenceRefs,
    id: validateNonEmptyString(value.id, 'Mechanical verification check id'),
    kind: value.kind as TMechanicalCheckKind,
    label: validateNonEmptyString(value.label, 'Mechanical verification check label'),
    ...(reason ? { reason } : {}),
    status,
  });
};

const validateMechanicalChecks = (
  value: unknown,
): readonly Readonly<IMechanicalVerificationCheck>[] => {
  if (!Array.isArray(value)) {
    throw createValidationError('Verification mechanicalChecks must be an array');
  }

  const checks = value.map(validateMechanicalCheck);
  const ids = checks.map(({ id }) => id);

  if (new Set(ids).size !== ids.length) {
    throw createValidationError('Verification mechanical check ids must be unique');
  }

  return Object.freeze(checks);
};

const validateCriterion = (value: unknown): Readonly<IVerifierCriterionResult> => {
  if (!isRecord(value)) {
    throw createValidationError('Verifier criterion must be an object');
  }

  assertAllowedKeys(value, ['evidenceRefs', 'kind', 'status', 'subject'], 'Verifier criterion');

  if (!CRITERION_KINDS.has(value.kind as TVerificationCriterionKind)) {
    throw createValidationError('Verifier criterion kind is invalid');
  }
  if (!CRITERION_STATUSES.has(value.status as TVerificationCriterionStatus)) {
    throw createValidationError('Verifier criterion status is invalid');
  }

  const status = value.status as TVerificationCriterionStatus;
  const evidenceRefs = validateStringList(value.evidenceRefs, 'Verifier criterion evidenceRefs');

  if (status === 'met' && evidenceRefs.length === 0) {
    throw createValidationError('Met verifier criterion requires evidence');
  }

  return Object.freeze({
    evidenceRefs,
    kind: value.kind as TVerificationCriterionKind,
    status,
    subject: validateNonEmptyString(value.subject, 'Verifier criterion subject'),
  });
};

const validateVerifierReport = (value: unknown): Readonly<IVerifierReport> => {
  if (!isRecord(value)) {
    throw createValidationError('Verifier report must be an object');
  }

  assertAllowedKeys(value, ['criteria', 'kind', 'result', 'schemaVersion'], 'Verifier report');

  if (
    value.kind !== 'verifier-report' ||
    value.schemaVersion !== VERIFICATION_VERSIONS.reportSchema ||
    !Array.isArray(value.criteria)
  ) {
    throw createValidationError('Verifier report identity is invalid');
  }

  const result = validateAgentHandoffResult(value.result);
  if (result.role !== 'verifier') {
    throw createValidationError('Verifier report must contain a verifier result');
  }

  const criteria = value.criteria.map(validateCriterion);
  const subjects = criteria.map(({ kind, subject }) => `${kind}:${subject}`);
  if (new Set(subjects).size !== subjects.length) {
    throw createValidationError('Verifier report criteria must be unique');
  }

  return Object.freeze({
    criteria: Object.freeze(criteria),
    kind: 'verifier-report' as const,
    result,
    schemaVersion: VERIFICATION_VERSIONS.reportSchema,
  });
};

const validateFinding = (value: unknown): Readonly<IReviewFinding> => {
  if (!isRecord(value)) {
    throw createValidationError('Reviewer finding must be an object');
  }

  assertAllowedKeys(value, ['evidenceRefs', 'severity', 'summary'], 'Reviewer finding');

  if (!REVIEW_SEVERITIES.has(value.severity as TReviewFindingSeverity)) {
    throw createValidationError('Reviewer finding severity is invalid');
  }

  return Object.freeze({
    evidenceRefs: validateStringList(value.evidenceRefs, 'Reviewer finding evidenceRefs'),
    severity: value.severity as TReviewFindingSeverity,
    summary: validateNonEmptyString(value.summary, 'Reviewer finding summary'),
  });
};

const validateReviewerReport = (value: unknown): Readonly<IReviewerReport> => {
  if (!isRecord(value)) {
    throw createValidationError('Reviewer report must be an object');
  }

  assertAllowedKeys(value, ['findings', 'kind', 'result', 'schemaVersion'], 'Reviewer report');

  if (
    value.kind !== 'reviewer-report' ||
    value.schemaVersion !== VERIFICATION_VERSIONS.reportSchema ||
    !Array.isArray(value.findings)
  ) {
    throw createValidationError('Reviewer report identity is invalid');
  }

  const result = validateAgentHandoffResult(value.result);
  if (result.role !== 'reviewer') {
    throw createValidationError('Reviewer report must contain a reviewer result');
  }

  return Object.freeze({
    findings: Object.freeze(value.findings.map(validateFinding)),
    kind: 'reviewer-report' as const,
    result,
    schemaVersion: VERIFICATION_VERSIONS.reportSchema,
  });
};

export const validateVerificationInput = (
  value: unknown,
): Readonly<IVerificationInput> => {
  if (!isRecord(value)) {
    throw createValidationError('Verification input must be an object');
  }

  assertAllowedKeys(
    value,
    [
      'artifacts',
      'mechanicalChecks',
      'reviewerReport',
      'strategyDecision',
      'taskAnalysis',
      'verificationId',
      'verifierReport',
    ],
    'Verification input',
  );

  const strategyDecision = validateStrategyRoutingDecision(value.strategyDecision);
  const verifierReport = value.verifierReport === undefined
    ? undefined
    : validateVerifierReport(value.verifierReport);
  const reviewerReport = value.reviewerReport === undefined
    ? undefined
    : validateReviewerReport(value.reviewerReport);

  if (strategyDecision.data.verification === 'none' && verifierReport) {
    throw createValidationError('Verifier report is not allowed when semantic verification is not routed');
  }
  if (strategyDecision.data.review === 'none' && reviewerReport) {
    throw createValidationError('Reviewer report is not allowed when review is not routed');
  }

  return Object.freeze({
    artifacts: validateArtifacts(value.artifacts),
    mechanicalChecks: validateMechanicalChecks(value.mechanicalChecks),
    ...(reviewerReport ? { reviewerReport } : {}),
    strategyDecision,
    taskAnalysis: validateTaskIntelligenceAnalysis(value.taskAnalysis),
    verificationId: validateNonEmptyString(value.verificationId, 'Verification id'),
    ...(verifierReport ? { verifierReport } : {}),
  });
};

const validateVerificationReasonCodes = (
  value: unknown,
  label: string,
): readonly TVerificationReasonCode[] => {
  if (!Array.isArray(value)) {
    throw createValidationError(`${label} must be an array`);
  }

  const codes = value.map((item) => {
    if (typeof item !== 'string' || !VERIFICATION_REASON_CODES.has(item as TVerificationReasonCode)) {
      throw createValidationError(`${label} contains an invalid reason code`);
    }
    return item as TVerificationReasonCode;
  });

  if (codes.length === 0 || new Set(codes).size !== codes.length) {
    throw createValidationError(`${label} must contain unique reason codes`);
  }

  return Object.freeze([...codes]);
};

const validateVerificationStageStatus = (
  value: unknown,
  label: string,
): TVerificationStageStatus => {
  if (!VERIFICATION_STAGE_STATUSES.has(value as TVerificationStageStatus)) {
    throw createValidationError(`${label} is invalid`);
  }

  return value as TVerificationStageStatus;
};

const validateMechanicalVerificationResult = (
  value: unknown,
): Readonly<IMechanicalVerificationResult> => {
  if (!isRecord(value)) {
    throw createValidationError('Mechanical verification result must be an object');
  }

  assertAllowedKeys(value, ['checks', 'reasonCodes', 'status'], 'Mechanical verification result');

  return Object.freeze({
    checks: validateMechanicalChecks(value.checks),
    reasonCodes: validateVerificationReasonCodes(
      value.reasonCodes,
      'Mechanical verification reasonCodes',
    ),
    status: validateVerificationStageStatus(value.status, 'Mechanical verification status'),
  });
};

const validateSemanticVerificationResult = (
  value: unknown,
): Readonly<ISemanticVerificationResult> => {
  if (!isRecord(value)) {
    throw createValidationError('Semantic verification result must be an object');
  }

  assertAllowedKeys(value, ['criteria', 'handoff', 'reasonCodes', 'status'], 'Semantic verification result');
  if (!Array.isArray(value.criteria)) {
    throw createValidationError('Semantic verification criteria must be an array');
  }

  const handoff = value.handoff === undefined ? undefined : validateAgentHandoff(value.handoff);
  if (handoff && handoff.targetRole !== 'verifier') {
    throw createValidationError('Semantic verification handoff must target verifier');
  }

  return Object.freeze({
    criteria: Object.freeze(value.criteria.map(validateCriterion)),
    ...(handoff ? { handoff } : {}),
    reasonCodes: validateVerificationReasonCodes(
      value.reasonCodes,
      'Semantic verification reasonCodes',
    ),
    status: validateVerificationStageStatus(value.status, 'Semantic verification status'),
  });
};

const validateReviewVerificationResult = (
  value: unknown,
): Readonly<IReviewVerificationResult> => {
  if (!isRecord(value)) {
    throw createValidationError('Review verification result must be an object');
  }

  assertAllowedKeys(value, ['findings', 'handoff', 'reasonCodes', 'status'], 'Review verification result');
  if (!Array.isArray(value.findings)) {
    throw createValidationError('Review verification findings must be an array');
  }

  const handoff = value.handoff === undefined ? undefined : validateAgentHandoff(value.handoff);
  if (handoff && handoff.targetRole !== 'reviewer') {
    throw createValidationError('Review verification handoff must target reviewer');
  }

  return Object.freeze({
    findings: Object.freeze(value.findings.map(validateFinding)),
    ...(handoff ? { handoff } : {}),
    reasonCodes: validateVerificationReasonCodes(
      value.reasonCodes,
      'Review verification reasonCodes',
    ),
    status: validateVerificationStageStatus(value.status, 'Review verification status'),
  });
};

export const validateVerificationResult = (
  value: unknown,
): Readonly<TVerificationResult> => {
  if (!isRecord(value)) {
    throw createValidationError('Verification result must be an object');
  }

  assertAllowedKeys(value, ['data', 'kind', 'schemaVersion'], 'Verification result');
  if (
    value.kind !== 'quality-result' ||
    value.schemaVersion !== VERIFICATION_VERSIONS.resultSchema ||
    !isRecord(value.data)
  ) {
    throw createValidationError('Verification result identity is invalid');
  }

  assertAllowedKeys(
    value.data,
    ['mechanical', 'policyVersion', 'reasonCodes', 'review', 'semantic', 'status', 'verificationId'],
    'Verification result data',
  );
  if (value.data.policyVersion !== VERIFICATION_VERSIONS.policy) {
    throw createValidationError('Verification result policyVersion is unsupported');
  }
  if (!VERIFICATION_STATUSES.has(value.data.status as TVerificationStatus)) {
    throw createValidationError('Verification result status is invalid');
  }

  const mechanical = validateMechanicalVerificationResult(value.data.mechanical);
  const semantic = validateSemanticVerificationResult(value.data.semantic);
  const review = validateReviewVerificationResult(value.data.review);
  const reasonCodes = validateVerificationReasonCodes(
    value.data.reasonCodes,
    'Verification result reasonCodes',
  );
  const nestedReasonCodes = [...mechanical.reasonCodes, ...semantic.reasonCodes, ...review.reasonCodes];

  if (nestedReasonCodes.some((code) => !reasonCodes.includes(code))) {
    throw createValidationError('Verification result reasonCodes must include all stage reason codes');
  }

  return Object.freeze({
    data: Object.freeze({
      mechanical,
      policyVersion: VERIFICATION_VERSIONS.policy,
      reasonCodes,
      review,
      semantic,
      status: value.data.status as TVerificationStatus,
      verificationId: validateNonEmptyString(value.data.verificationId, 'Verification result verificationId'),
    }),
    kind: 'quality-result' as const,
    schemaVersion: VERIFICATION_VERSIONS.resultSchema,
  });
};
