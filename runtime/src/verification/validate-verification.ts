import { validateAgentHandoffResult } from '../agent-roles/validate-agent-handoff.js';
import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { validateStrategyRoutingDecision } from '../strategy-routing/validate-strategy-routing.js';
import { validateTaskIntelligenceAnalysis } from '../task-intelligence/validate-task-intelligence.js';
import { VERIFICATION_VERSIONS } from './verification-contract.js';

import type {
  IMechanicalVerificationCheck,
  IReviewFinding,
  IReviewerReport,
  IVerificationArtifactRefs,
  IVerificationInput,
  IVerifierCriterionResult,
  IVerifierReport,
  TMechanicalCheckKind,
  TMechanicalCheckStatus,
  TReviewFindingSeverity,
  TVerificationCriterionKind,
  TVerificationCriterionStatus,
} from './verification-contract.js';

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

const checkIsRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
  if (!checkIsRecord(value)) {
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
  if (!checkIsRecord(value)) {
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
  if (!checkIsRecord(value)) {
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
  if (!checkIsRecord(value)) {
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
  if (!checkIsRecord(value)) {
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
  if (!checkIsRecord(value)) {
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
  if (!checkIsRecord(value)) {
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
