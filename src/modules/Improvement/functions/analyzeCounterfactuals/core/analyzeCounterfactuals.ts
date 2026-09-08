import { analyzeMechanismHealth } from '#modules/Analytics';
import {
  EVOLUTION_LIMITS,
  EVOLUTION_VERSIONS,
} from '../../../types/evolutionContract.js';
import { validateCounterfactualAnalysisInput } from '../../validateEvolution/core/validateEvolution.js';

import type {
  IAnalyticsRoutingChoiceSummary,
  IAnalyticsRoutingCohort,
  TAnalyticsConfidence,
} from '#modules/Analytics';
import type {
  ICounterfactualAnalysis,
  ICounterfactualHypothesis,
  TEvolutionCostMetric,
  TEvolutionCounterfactualDimension,
} from '../../../types/evolutionContract.js';

const EXCLUDED_DIMENSIONS = new Set(['verifier']);
const CONFIDENCE_RANK: Readonly<Record<TAnalyticsConfidence, number>> = Object.freeze({
  high: 3,
  insufficient: 0,
  low: 1,
  medium: 2,
});

const minConfidence = (
  left: TAnalyticsConfidence,
  right: TAnalyticsConfidence,
): TAnalyticsConfidence =>
  CONFIDENCE_RANK[left] <= CONFIDENCE_RANK[right] ? left : right;

const round = (value: number, precision = 4) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const getCost = (
  observed: Readonly<IAnalyticsRoutingChoiceSummary>,
  alternative: Readonly<IAnalyticsRoutingChoiceSummary>,
): Readonly<{ metric: TEvolutionCostMetric; observed: number; alternative: number }> | undefined => {
  if (observed.usage.avgCostUnits !== null && alternative.usage.avgCostUnits !== null) {
    return Object.freeze({
      alternative: alternative.usage.avgCostUnits,
      metric: 'cost-units' as const,
      observed: observed.usage.avgCostUnits,
    });
  }
  if (observed.usage.avgTokens !== null && alternative.usage.avgTokens !== null) {
    return Object.freeze({
      alternative: alternative.usage.avgTokens,
      metric: 'tokens' as const,
      observed: observed.usage.avgTokens,
    });
  }
  if (observed.usage.avgDurationMs !== null && alternative.usage.avgDurationMs !== null) {
    return Object.freeze({
      alternative: alternative.usage.avgDurationMs,
      metric: 'duration-ms' as const,
      observed: observed.usage.avgDurationMs,
    });
  }

  return undefined;
};

const hasComparableReliability = (
  observed: Readonly<IAnalyticsRoutingChoiceSummary>,
  alternative: Readonly<IAnalyticsRoutingChoiceSummary>,
) => {
  const observedSuccess = observed.outcomes.successRate;
  const alternativeSuccess = alternative.outcomes.successRate;
  const observedFailure = observed.outcomes.failureRate;
  const alternativeFailure = alternative.outcomes.failureRate;

  if (
    observedSuccess === null ||
    alternativeSuccess === null ||
    observedFailure === null ||
    alternativeFailure === null
  ) {
    return false;
  }

  return (
    alternativeSuccess >= observedSuccess - EVOLUTION_LIMITS.reliabilityTolerance &&
    alternativeFailure <= observedFailure + EVOLUTION_LIMITS.reliabilityTolerance
  );
};

const createHypothesesForCohort = (
  cohort: Readonly<IAnalyticsRoutingCohort>,
): readonly Readonly<ICounterfactualHypothesis>[] => {
  const hypotheses: ICounterfactualHypothesis[] = [];
  const choicesByDimension = new Map<string, IAnalyticsRoutingChoiceSummary[]>();

  for (const choice of cohort.choices) {
    if (EXCLUDED_DIMENSIONS.has(choice.dimension)) continue;
    const choices = choicesByDimension.get(choice.dimension) ?? [];
    choices.push(choice);
    choicesByDimension.set(choice.dimension, choices);
  }

  for (const [dimension, choices] of choicesByDimension) {
    for (const observed of choices) {
      for (const alternative of choices) {
        if (observed.choice === alternative.choice) continue;
        if (
          observed.sampleSize < EVOLUTION_LIMITS.minComparableSampleSize ||
          alternative.sampleSize < EVOLUTION_LIMITS.minComparableSampleSize
        ) {
          continue;
        }

        const cost = getCost(observed, alternative);
        if (!cost || cost.observed <= 0 || cost.alternative >= cost.observed) continue;

        const relativeReduction = (cost.observed - cost.alternative) / cost.observed;
        if (relativeReduction < EVOLUTION_LIMITS.minRelativeCostReduction) continue;
        if (!hasComparableReliability(observed, alternative)) continue;

        hypotheses.push(Object.freeze({
          alternativeChoice: alternative.choice,
          alternativeCost: cost.alternative,
          alternativeFailureRate: alternative.outcomes.failureRate as number,
          alternativeSuccessRate: alternative.outcomes.successRate as number,
          causalClaim: false as const,
          cohortId: cohort.cohortId,
          confidence: minConfidence(observed.confidence, alternative.confidence),
          costMetric: cost.metric,
          dimension: dimension as TEvolutionCounterfactualDimension,
          estimatedRelativeCostReduction: round(relativeReduction),
          hypothesisId: [
            cohort.cohortId,
            dimension,
            observed.choice,
            'to',
            alternative.choice,
          ].join(':'),
          observedChoice: observed.choice,
          observedCost: cost.observed,
          observedFailureRate: observed.outcomes.failureRate as number,
          observedSuccessRate: observed.outcomes.successRate as number,
          reasonCodes: Object.freeze(['lower-cost-comparable-reliability' as const]),
          sampleSize: Math.min(observed.sampleSize, alternative.sampleSize),
        }));
      }
    }
  }

  return Object.freeze(hypotheses);
};

export const analyzeCounterfactuals = (
  value: unknown,
): Readonly<ICounterfactualAnalysis> => {
  const input = validateCounterfactualAnalysisInput(value);
  const health = analyzeMechanismHealth(input.analyticsInput);
  const hypotheses = Object.freeze(
    health.overall.routingCohorts
      .flatMap(createHypothesesForCohort)
      .sort((left, right) => left.hypothesisId.localeCompare(right.hypothesisId))
      .slice(0, EVOLUTION_LIMITS.maxHypotheses),
  );

  return Object.freeze({
    analysisId: input.analysisId,
    causalClaim: false as const,
    hypotheses,
    kind: 'counterfactual-analysis' as const,
    schemaVersion: EVOLUTION_VERSIONS.counterfactualSchema,
    sourceReportId: health.reportId,
  });
};
