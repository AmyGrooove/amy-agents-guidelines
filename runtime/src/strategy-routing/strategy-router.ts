import { STRATEGY_ROUTING_VERSIONS } from './strategy-routing-contract.js';
import { validateStrategyRoutingInput } from './validate-strategy-routing.js';

import type { ITaskClassificationDimensions, TTaskConfidence } from '../task-intelligence/task-intelligence-contract.js';
import type {
  TStrategyExecution,
  TStrategyExploration,
  TStrategyPlanning,
  TStrategyReasonCode,
  TStrategyReview,
  TStrategyRoutingDecision,
  TStrategyVerification,
} from './strategy-routing-contract.js';

const CONFIDENCE_RANK: Readonly<Record<TTaskConfidence, number>> = Object.freeze({
  high: 2,
  low: 0,
  medium: 1,
});

const minConfidence = (
  ...values: readonly TTaskConfidence[]
): TTaskConfidence =>
  values.reduce<TTaskConfidence>((current, value) =>
    CONFIDENCE_RANK[value] < CONFIDENCE_RANK[current] ? value : current,
  'high');

const checkWideScope = (dimensions: Readonly<ITaskClassificationDimensions>) =>
  dimensions.scope === 'multi-module' ||
  dimensions.scope === 'repository' ||
  dimensions.blastRadius === 'multi-module' ||
  dimensions.blastRadius === 'repository';

const deriveExploration = (
  input: ReturnType<typeof validateStrategyRoutingInput>,
  reasons: Set<TStrategyReasonCode>,
): TStrategyExploration => {
  if (input.contextResolution) {
    if (input.contextResolution.exploration === 'scout') {
      reasons.add('context-scout-required');
      return 'scout';
    }

    if (input.contextResolution.exploration === 'source-read') {
      reasons.add('context-source-read-required');
      return 'source-read';
    }

    return 'none';
  }

  const classification = input.taskAnalysis.data.classification;
  const materialGap = classification.evidenceGaps.some((gap) =>
    ['affected-scope', 'project-risk', 'uncertainty'].includes(gap),
  );

  if (classification.confidence === 'low' && materialGap) {
    reasons.add('low-task-confidence');
    return 'scout';
  }

  return 'none';
};

const derivePlanning = (
  dimensions: Readonly<ITaskClassificationDimensions>,
  reasons: Set<TStrategyReasonCode>,
): TStrategyPlanning => {
  if (
    checkWideScope(dimensions) &&
    (dimensions.complexity === 'high' || dimensions.coupling === 'high')
  ) {
    reasons.add('decomposition-recommended');
    return 'decompose';
  }

  if (
    dimensions.complexity === 'high' ||
    dimensions.coupling === 'high' ||
    dimensions.uncertainty === 'high' ||
    dimensions.risk === 'high' ||
    dimensions.scope === 'repository'
  ) {
    reasons.add('planning-recommended');
    return 'plan';
  }

  return 'none';
};

const deriveExecution = (
  dimensions: Readonly<ITaskClassificationDimensions>,
  planning: TStrategyPlanning,
  reasons: Set<TStrategyReasonCode>,
): TStrategyExecution => {
  if (
    planning === 'decompose' ||
    dimensions.complexity === 'high' ||
    dimensions.expectedContextCost === 'high' ||
    dimensions.scope === 'repository'
  ) {
    reasons.add('worker-recommended');
    return 'worker';
  }

  reasons.add('direct-execution');
  return 'direct';
};

const deriveVerification = (
  dimensions: Readonly<ITaskClassificationDimensions>,
  classificationReasonCodes: readonly string[],
  reasons: Set<TStrategyReasonCode>,
): TStrategyVerification => {
  const sensitiveContract = classificationReasonCodes.some((reason) =>
    ['critical-invariants', 'public-api-impact'].includes(reason),
  );

  if (
    dimensions.risk === 'high' ||
    dimensions.blastRadius === 'repository' ||
    sensitiveContract ||
    (dimensions.complexity === 'high' && dimensions.verificationCost !== 'low')
  ) {
    reasons.add('verifier-risk-justified');
    return 'verifier';
  }

  return 'none';
};

const deriveReview = (
  dimensions: Readonly<ITaskClassificationDimensions>,
  classificationReasonCodes: readonly string[],
  reasons: Set<TStrategyReasonCode>,
): TStrategyReview => {
  const sensitiveContract = classificationReasonCodes.some((reason) =>
    ['critical-invariants', 'public-api-impact'].includes(reason),
  );
  const elevatedRisk = dimensions.risk === 'high' || sensitiveContract;
  const systemicChange =
    dimensions.coupling === 'high' ||
    dimensions.scope === 'repository' ||
    dimensions.blastRadius === 'repository';

  if (elevatedRisk && systemicChange) {
    reasons.add('reviewer-risk-justified');
    return 'reviewer';
  }

  return 'none';
};

const checkFastPath = (
  input: ReturnType<typeof validateStrategyRoutingInput>,
  strategy: Readonly<{
    escalation: 'compute' | 'none';
    execution: TStrategyExecution;
    exploration: TStrategyExploration;
    planning: TStrategyPlanning;
    review: TStrategyReview;
    verification: TStrategyVerification;
  }>,
) => {
  const { classification } = input.taskAnalysis.data;
  const dimensions = classification.dimensions;
  const contextConfidence = input.contextResolution?.confidence;

  return (
    classification.confidence !== 'low' &&
    contextConfidence !== 'low' &&
    dimensions.scope === 'local' &&
    dimensions.blastRadius === 'local' &&
    dimensions.complexity === 'low' &&
    dimensions.coupling === 'low' &&
    dimensions.uncertainty === 'low' &&
    dimensions.verificationCost === 'low' &&
    dimensions.risk !== 'medium' &&
    dimensions.risk !== 'high' &&
    strategy.exploration !== 'scout' &&
    strategy.planning === 'none' &&
    strategy.execution === 'direct' &&
    strategy.verification === 'none' &&
    strategy.review === 'none' &&
    strategy.escalation === 'none'
  );
};

export const routeStrategy = (
  value: unknown,
): Readonly<TStrategyRoutingDecision> => {
  const input = validateStrategyRoutingInput(value);
  const classification = input.taskAnalysis.data.classification;
  const dimensions = classification.dimensions;
  const reasons = new Set<TStrategyReasonCode>();
  const exploration = deriveExploration(input, reasons);
  const planning = derivePlanning(dimensions, reasons);
  const execution = deriveExecution(dimensions, planning, reasons);
  const verification = deriveVerification(
    dimensions,
    classification.reasonCodes,
    reasons,
  );
  const review = deriveReview(dimensions, classification.reasonCodes, reasons);
  const escalation =
    input.computeDecision?.assignment.status === 'unavailable'
      ? ('compute' as const)
      : ('none' as const);

  if (input.computeDecision) {
    reasons.add('compute-profile-provided');
  }

  if (escalation === 'compute') {
    reasons.add('compute-unavailable');
  }

  const fastPath = checkFastPath(input, {
    escalation,
    execution,
    exploration,
    planning,
    review,
    verification,
  });

  if (fastPath) {
    reasons.add('fast-path');
  }

  const confidence = escalation === 'compute'
    ? 'low'
    : minConfidence(
        classification.confidence,
        ...(input.contextResolution ? [input.contextResolution.confidence] : []),
        ...(input.computeDecision ? [input.computeDecision.confidence] : []),
      );

  return Object.freeze({
    data: Object.freeze({
      ...(input.computeDecision ? { computeProfile: input.computeDecision.profile } : {}),
      confidence,
      escalation,
      execution,
      exploration,
      fastPath,
      planning,
      policyVersion: STRATEGY_ROUTING_VERSIONS.policy,
      reasonCodes: Object.freeze([...reasons].sort()),
      review,
      verification,
    }),
    kind: 'execution-strategy',
    schemaVersion: STRATEGY_ROUTING_VERSIONS.decisionSchema,
  });
};
