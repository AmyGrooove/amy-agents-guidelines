import { validateAnalyticsInput } from '../analytics/validate-analytics.js';
import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { validateEvalComparisonResult } from '../eval-system/validate-eval-system.js';
import { validateStrategyRoutingDecision } from '../strategy-routing/validate-strategy-routing.js';
import { getImprovementRecommendation } from './evolution-policy.js';
import {
  EVOLUTION_LIMITS,
  EVOLUTION_VERSIONS,
} from './evolution-contract.js';

import type { TAnalyticsConfidence } from '../analytics/analytics-contract.js';
import type {
  ICounterfactualAnalysis,
  ICounterfactualAnalysisInput,
  ICounterfactualHypothesis,
  IImprovementDecisionInput,
  IImprovementProposal,
  IImprovementProposalInput,
  IShadowStrategyComparison,
  IShadowStrategyDifference,
  IShadowStrategyInput,
  TEvolutionCostMetric,
  TEvolutionCounterfactualDimension,
  TEvolutionCounterfactualReasonCode,
  TEvolutionProposalReasonCode,
  TEvolutionRecommendation,
  TEvolutionTarget,
  TEvolutionUserDecision,
  TShadowStrategyDimension,
} from './evolution-contract.js';

const CONFIDENCES = new Set<TAnalyticsConfidence>(['high', 'insufficient', 'low', 'medium']);
const TARGETS = new Set<TEvolutionTarget>([
  'agent',
  'compute-profile',
  'context-policy',
  'project-intelligence',
  'routing',
  'skill',
  'verification',
]);
const COUNTERFACTUAL_DIMENSIONS = new Set<TEvolutionCounterfactualDimension>([
  'compute-profile',
  'context-items',
  'execution',
  'reasoning-effort',
  'reviewer',
  'scout',
  'worker-count',
]);
const COST_METRICS = new Set<TEvolutionCostMetric>(['cost-units', 'duration-ms', 'tokens']);
const COUNTERFACTUAL_REASON_CODES = new Set<TEvolutionCounterfactualReasonCode>([
  'lower-cost-comparable-reliability',
]);
const SHADOW_DIMENSIONS = new Set<TShadowStrategyDimension>([
  'compute-profile',
  'escalation',
  'execution',
  'exploration',
  'fast-path',
  'planning',
  'review',
  'verification',
]);
const RECOMMENDATIONS = new Set<TEvolutionRecommendation>([
  'collect-more-evidence',
  'do-not-adopt',
  'request-user-decision',
  'run-eval',
]);
const PROPOSAL_REASON_CODES = new Set<TEvolutionProposalReasonCode>([
  'eval-candidate-regressed',
  'eval-candidate-safe',
  'eval-inconclusive',
  'eval-missing',
  'evidence-insufficient',
]);
const USER_DECISIONS = new Set<TEvolutionUserDecision>(['approved', 'deferred', 'rejected']);

const checkIsRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createValidationError = (message: string) =>
  new AmyRuntimeError({
    code: 'VALIDATION_FAILURE',
    details: { capabilityId: 'amy.evolution' },
    message,
  });

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

const validateString = (value: unknown, label: string): string => {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > EVOLUTION_LIMITS.maxStringLength
  ) {
    throw createValidationError(
      `${label} must be a non-empty string up to ${EVOLUTION_LIMITS.maxStringLength} characters`,
    );
  }

  return value.trim();
};

const validateStringList = (
  value: unknown,
  label: string,
  maxItems = EVOLUTION_LIMITS.maxListItems,
): readonly string[] => {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw createValidationError(`${label} must contain at most ${maxItems} items`);
  }

  const items = value.map((item, index) => validateString(item, `${label}[${index}]`));
  if (new Set(items).size !== items.length) {
    throw createValidationError(`${label} must not contain duplicates`);
  }

  return Object.freeze(items);
};

const validateNumber = (
  value: unknown,
  label: string,
  options: Readonly<{ integer?: boolean; max?: number; min?: number }> = {},
): number => {
  const min = options.min ?? 0;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (options.integer === true && !Number.isInteger(value))
  ) {
    throw createValidationError(`${label} must be between ${min} and ${max}`);
  }

  return value;
};

const validateConfidence = (value: unknown, label: string): TAnalyticsConfidence => {
  if (typeof value !== 'string' || !CONFIDENCES.has(value as TAnalyticsConfidence)) {
    throw createValidationError(`${label} is invalid`);
  }

  return value as TAnalyticsConfidence;
};

export const validateCounterfactualAnalysisInput = (
  value: unknown,
): Readonly<ICounterfactualAnalysisInput> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Counterfactual analysis input must be an object');
  }

  assertAllowedKeys(value, ['analysisId', 'analyticsInput'], 'Counterfactual analysis input');

  return Object.freeze({
    analysisId: validateString(value.analysisId, 'Counterfactual analysis analysisId'),
    analyticsInput: validateAnalyticsInput(value.analyticsInput),
  });
};

const validateCounterfactualHypothesis = (
  value: unknown,
  index: number,
): Readonly<ICounterfactualHypothesis> => {
  const label = `Counterfactual hypothesis[${index}]`;
  if (!checkIsRecord(value)) {
    throw createValidationError(`${label} must be an object`);
  }

  assertAllowedKeys(value, [
    'alternativeChoice',
    'alternativeCost',
    'alternativeFailureRate',
    'alternativeSuccessRate',
    'causalClaim',
    'cohortId',
    'confidence',
    'costMetric',
    'dimension',
    'estimatedRelativeCostReduction',
    'hypothesisId',
    'observedChoice',
    'observedCost',
    'observedFailureRate',
    'observedSuccessRate',
    'reasonCodes',
    'sampleSize',
  ], label);

  if (value.causalClaim !== false) {
    throw createValidationError(`${label} causalClaim must be false`);
  }
  if (typeof value.dimension !== 'string' || !COUNTERFACTUAL_DIMENSIONS.has(value.dimension as TEvolutionCounterfactualDimension)) {
    throw createValidationError(`${label} dimension is invalid`);
  }
  if (typeof value.costMetric !== 'string' || !COST_METRICS.has(value.costMetric as TEvolutionCostMetric)) {
    throw createValidationError(`${label} costMetric is invalid`);
  }
  if (!Array.isArray(value.reasonCodes) || value.reasonCodes.length === 0) {
    throw createValidationError(`${label} reasonCodes must be a non-empty array`);
  }
  const reasonCodes = value.reasonCodes.map((item) => {
    if (typeof item !== 'string' || !COUNTERFACTUAL_REASON_CODES.has(item as TEvolutionCounterfactualReasonCode)) {
      throw createValidationError(`${label} contains an invalid reason code`);
    }
    return item as TEvolutionCounterfactualReasonCode;
  });

  return Object.freeze({
    alternativeChoice: validateString(value.alternativeChoice, `${label} alternativeChoice`),
    alternativeCost: validateNumber(value.alternativeCost, `${label} alternativeCost`),
    alternativeFailureRate: validateNumber(value.alternativeFailureRate, `${label} alternativeFailureRate`, { max: 1 }),
    alternativeSuccessRate: validateNumber(value.alternativeSuccessRate, `${label} alternativeSuccessRate`, { max: 1 }),
    causalClaim: false as const,
    cohortId: validateString(value.cohortId, `${label} cohortId`),
    confidence: validateConfidence(value.confidence, `${label} confidence`),
    costMetric: value.costMetric as TEvolutionCostMetric,
    dimension: value.dimension as TEvolutionCounterfactualDimension,
    estimatedRelativeCostReduction: validateNumber(
      value.estimatedRelativeCostReduction,
      `${label} estimatedRelativeCostReduction`,
      { max: 1 },
    ),
    hypothesisId: validateString(value.hypothesisId, `${label} hypothesisId`),
    observedChoice: validateString(value.observedChoice, `${label} observedChoice`),
    observedCost: validateNumber(value.observedCost, `${label} observedCost`),
    observedFailureRate: validateNumber(value.observedFailureRate, `${label} observedFailureRate`, { max: 1 }),
    observedSuccessRate: validateNumber(value.observedSuccessRate, `${label} observedSuccessRate`, { max: 1 }),
    reasonCodes: Object.freeze(reasonCodes),
    sampleSize: validateNumber(value.sampleSize, `${label} sampleSize`, {
      integer: true,
      max: EVOLUTION_LIMITS.maxSampleSize,
      min: 1,
    }),
  });
};

export const validateCounterfactualAnalysis = (
  value: unknown,
): Readonly<ICounterfactualAnalysis> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Counterfactual analysis must be an object');
  }

  assertAllowedKeys(
    value,
    ['analysisId', 'causalClaim', 'hypotheses', 'kind', 'schemaVersion', 'sourceReportId'],
    'Counterfactual analysis',
  );

  if (
    value.kind !== 'counterfactual-analysis' ||
    value.schemaVersion !== EVOLUTION_VERSIONS.counterfactualSchema ||
    value.causalClaim !== false ||
    !Array.isArray(value.hypotheses) ||
    value.hypotheses.length > EVOLUTION_LIMITS.maxHypotheses
  ) {
    throw createValidationError('Counterfactual analysis identity is invalid');
  }

  const hypotheses = value.hypotheses.map(validateCounterfactualHypothesis);
  const ids = hypotheses.map(({ hypothesisId }) => hypothesisId);
  if (new Set(ids).size !== ids.length) {
    throw createValidationError('Counterfactual hypothesis ids must be unique');
  }

  return Object.freeze({
    analysisId: validateString(value.analysisId, 'Counterfactual analysis analysisId'),
    causalClaim: false as const,
    hypotheses: Object.freeze(hypotheses),
    kind: 'counterfactual-analysis' as const,
    schemaVersion: EVOLUTION_VERSIONS.counterfactualSchema,
    sourceReportId: validateString(value.sourceReportId, 'Counterfactual analysis sourceReportId'),
  });
};

export const validateShadowStrategyInput = (
  value: unknown,
): Readonly<IShadowStrategyInput> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Shadow strategy input must be an object');
  }

  assertAllowedKeys(
    value,
    ['candidateDecision', 'candidateRef', 'evidenceRefs', 'productionDecision', 'shadowId'],
    'Shadow strategy input',
  );

  return Object.freeze({
    candidateDecision: validateStrategyRoutingDecision(value.candidateDecision),
    candidateRef: validateString(value.candidateRef, 'Shadow strategy candidateRef'),
    evidenceRefs: validateStringList(value.evidenceRefs, 'Shadow strategy evidenceRefs', EVOLUTION_LIMITS.maxEvidenceRefs),
    productionDecision: validateStrategyRoutingDecision(value.productionDecision),
    shadowId: validateString(value.shadowId, 'Shadow strategy shadowId'),
  });
};

const validateShadowDifference = (
  value: unknown,
  index: number,
): Readonly<IShadowStrategyDifference> => {
  const label = `Shadow strategy difference[${index}]`;
  if (!checkIsRecord(value)) {
    throw createValidationError(`${label} must be an object`);
  }

  assertAllowedKeys(value, ['candidateValue', 'dimension', 'productionValue'], label);
  if (typeof value.dimension !== 'string' || !SHADOW_DIMENSIONS.has(value.dimension as TShadowStrategyDimension)) {
    throw createValidationError(`${label} dimension is invalid`);
  }

  const validateValue = (item: unknown, valueLabel: string): boolean | string | null => {
    if (item === null || typeof item === 'boolean') return item;
    if (typeof item === 'string') return validateString(item, valueLabel);
    throw createValidationError(`${valueLabel} must be a string, boolean, or null`);
  };

  return Object.freeze({
    candidateValue: validateValue(value.candidateValue, `${label} candidateValue`),
    dimension: value.dimension as TShadowStrategyDimension,
    productionValue: validateValue(value.productionValue, `${label} productionValue`),
  });
};

export const validateShadowStrategyComparison = (
  value: unknown,
): Readonly<IShadowStrategyComparison> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Shadow strategy comparison must be an object');
  }

  assertAllowedKeys(value, [
    'candidateDecision',
    'candidateRef',
    'causalClaim',
    'differences',
    'evidenceRefs',
    'executionPerformed',
    'kind',
    'productionDecision',
    'productionMutation',
    'schemaVersion',
    'shadowId',
  ], 'Shadow strategy comparison');

  if (
    value.kind !== 'shadow-strategy-comparison' ||
    value.schemaVersion !== EVOLUTION_VERSIONS.shadowSchema ||
    value.causalClaim !== false ||
    value.executionPerformed !== false ||
    value.productionMutation !== false ||
    !Array.isArray(value.differences) ||
    value.differences.length > SHADOW_DIMENSIONS.size
  ) {
    throw createValidationError('Shadow strategy comparison identity is invalid');
  }

  const differences = value.differences.map(validateShadowDifference);
  const dimensions = differences.map(({ dimension }) => dimension);
  if (new Set(dimensions).size !== dimensions.length) {
    throw createValidationError('Shadow strategy comparison dimensions must be unique');
  }

  return Object.freeze({
    candidateDecision: validateStrategyRoutingDecision(value.candidateDecision),
    candidateRef: validateString(value.candidateRef, 'Shadow strategy comparison candidateRef'),
    causalClaim: false as const,
    differences: Object.freeze(differences),
    evidenceRefs: validateStringList(value.evidenceRefs, 'Shadow strategy comparison evidenceRefs', EVOLUTION_LIMITS.maxEvidenceRefs),
    executionPerformed: false as const,
    kind: 'shadow-strategy-comparison' as const,
    productionDecision: validateStrategyRoutingDecision(value.productionDecision),
    productionMutation: false as const,
    schemaVersion: EVOLUTION_VERSIONS.shadowSchema,
    shadowId: validateString(value.shadowId, 'Shadow strategy comparison shadowId'),
  });
};

export const validateImprovementProposalInput = (
  value: unknown,
): Readonly<IImprovementProposalInput> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Improvement proposal input must be an object');
  }

  assertAllowedKeys(value, [
    'confidence',
    'counterfactualAnalysis',
    'evalResult',
    'evidenceRefs',
    'expectedBenefit',
    'hypothesis',
    'observation',
    'proposalId',
    'proposedChange',
    'risks',
    'sampleSize',
    'shadowComparison',
    'target',
  ], 'Improvement proposal input');

  if (typeof value.target !== 'string' || !TARGETS.has(value.target as TEvolutionTarget)) {
    throw createValidationError('Improvement proposal target is invalid');
  }

  return Object.freeze({
    confidence: validateConfidence(value.confidence, 'Improvement proposal confidence'),
    ...(value.counterfactualAnalysis === undefined
      ? {}
      : { counterfactualAnalysis: validateCounterfactualAnalysis(value.counterfactualAnalysis) }),
    ...(value.evalResult === undefined ? {} : { evalResult: validateEvalComparisonResult(value.evalResult) }),
    evidenceRefs: validateStringList(value.evidenceRefs, 'Improvement proposal evidenceRefs', EVOLUTION_LIMITS.maxEvidenceRefs),
    expectedBenefit: validateString(value.expectedBenefit, 'Improvement proposal expectedBenefit'),
    hypothesis: validateString(value.hypothesis, 'Improvement proposal hypothesis'),
    observation: validateString(value.observation, 'Improvement proposal observation'),
    proposalId: validateString(value.proposalId, 'Improvement proposal proposalId'),
    proposedChange: validateString(value.proposedChange, 'Improvement proposal proposedChange'),
    risks: validateStringList(value.risks, 'Improvement proposal risks'),
    sampleSize: validateNumber(value.sampleSize, 'Improvement proposal sampleSize', {
      integer: true,
      max: EVOLUTION_LIMITS.maxSampleSize,
    }),
    ...(value.shadowComparison === undefined
      ? {}
      : { shadowComparison: validateShadowStrategyComparison(value.shadowComparison) }),
    target: value.target as TEvolutionTarget,
  });
};

export const validateImprovementProposal = (
  value: unknown,
): Readonly<IImprovementProposal> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Improvement proposal must be an object');
  }

  assertAllowedKeys(value, [
    'automaticApplication',
    'causalClaim',
    'confidence',
    'counterfactualAnalysis',
    'evalResult',
    'evidenceRefs',
    'expectedBenefit',
    'hypothesis',
    'kind',
    'observation',
    'proposalId',
    'proposedChange',
    'reasonCodes',
    'recommendation',
    'risks',
    'sampleSize',
    'schemaVersion',
    'shadowComparison',
    'target',
    'userDecisionRequired',
  ], 'Improvement proposal');

  if (
    value.kind !== 'improvement-proposal' ||
    value.schemaVersion !== EVOLUTION_VERSIONS.proposalSchema ||
    value.automaticApplication !== false ||
    value.causalClaim !== false ||
    value.userDecisionRequired !== true ||
    typeof value.recommendation !== 'string' ||
    !RECOMMENDATIONS.has(value.recommendation as TEvolutionRecommendation) ||
    !Array.isArray(value.reasonCodes) ||
    value.reasonCodes.length === 0
  ) {
    throw createValidationError('Improvement proposal identity is invalid');
  }

  const input = validateImprovementProposalInput({
    confidence: value.confidence,
    ...(value.counterfactualAnalysis === undefined ? {} : { counterfactualAnalysis: value.counterfactualAnalysis }),
    ...(value.evalResult === undefined ? {} : { evalResult: value.evalResult }),
    evidenceRefs: value.evidenceRefs,
    expectedBenefit: value.expectedBenefit,
    hypothesis: value.hypothesis,
    observation: value.observation,
    proposalId: value.proposalId,
    proposedChange: value.proposedChange,
    risks: value.risks,
    sampleSize: value.sampleSize,
    ...(value.shadowComparison === undefined ? {} : { shadowComparison: value.shadowComparison }),
    target: value.target,
  });
  const reasonCodes = value.reasonCodes.map((item) => {
    if (typeof item !== 'string' || !PROPOSAL_REASON_CODES.has(item as TEvolutionProposalReasonCode)) {
      throw createValidationError('Improvement proposal contains an invalid reason code');
    }
    return item as TEvolutionProposalReasonCode;
  });
  const expected = getImprovementRecommendation(input);
  if (
    value.recommendation !== expected.recommendation ||
    JSON.stringify(reasonCodes) !== JSON.stringify(expected.reasonCodes)
  ) {
    throw createValidationError('Improvement proposal recommendation does not match proposal evidence policy');
  }

  return Object.freeze({
    ...input,
    automaticApplication: false as const,
    causalClaim: false as const,
    kind: 'improvement-proposal' as const,
    reasonCodes: Object.freeze(reasonCodes),
    recommendation: value.recommendation as TEvolutionRecommendation,
    schemaVersion: EVOLUTION_VERSIONS.proposalSchema,
    userDecisionRequired: true as const,
  });
};

export const validateImprovementDecisionInput = (
  value: unknown,
): Readonly<IImprovementDecisionInput> => {
  if (!checkIsRecord(value)) {
    throw createValidationError('Improvement decision input must be an object');
  }

  assertAllowedKeys(value, ['decidedBy', 'decision', 'note', 'proposal'], 'Improvement decision input');
  if (value.decidedBy !== 'user') {
    throw createValidationError('Improvement decision decidedBy must be user');
  }
  if (typeof value.decision !== 'string' || !USER_DECISIONS.has(value.decision as TEvolutionUserDecision)) {
    throw createValidationError('Improvement decision is invalid');
  }

  return Object.freeze({
    decidedBy: 'user' as const,
    decision: value.decision as TEvolutionUserDecision,
    ...(value.note === undefined ? {} : { note: validateString(value.note, 'Improvement decision note') }),
    proposal: validateImprovementProposal(value.proposal),
  });
};
