import { EVOLUTION_LIMITS } from '../../../types/evolutionContract.js';

import type { IEvalComparisonResult } from '#modules/Evaluation';
import type {
  TEvolutionProposalReasonCode,
  TEvolutionRecommendation,
} from '../../../types/evolutionContract.js';

export interface IProposalRecommendation {
  reasonCodes: readonly TEvolutionProposalReasonCode[];
  recommendation: TEvolutionRecommendation;
}

export const getImprovementRecommendation = ({
  confidence,
  evalResult,
  sampleSize,
}: Readonly<{
  confidence: 'high' | 'insufficient' | 'low' | 'medium';
  evalResult?: Readonly<IEvalComparisonResult>;
  sampleSize: number;
}>): Readonly<IProposalRecommendation> => {
  if (
    sampleSize < EVOLUTION_LIMITS.minComparableSampleSize ||
    confidence === 'insufficient' ||
    confidence === 'low'
  ) {
    return Object.freeze({
      reasonCodes: Object.freeze(['evidence-insufficient' as const]),
      recommendation: 'collect-more-evidence' as const,
    });
  }

  if (!evalResult) {
    return Object.freeze({
      reasonCodes: Object.freeze(['eval-missing' as const]),
      recommendation: 'run-eval' as const,
    });
  }

  if (evalResult.status !== 'completed' || evalResult.winner === 'inconclusive') {
    return Object.freeze({
      reasonCodes: Object.freeze(['eval-inconclusive' as const]),
      recommendation: 'collect-more-evidence' as const,
    });
  }

  if (evalResult.regressedCaseIds.length > 0 || evalResult.winner === 'baseline') {
    return Object.freeze({
      reasonCodes: Object.freeze(['eval-candidate-regressed' as const]),
      recommendation: 'do-not-adopt' as const,
    });
  }

  return Object.freeze({
    reasonCodes: Object.freeze(['eval-candidate-safe' as const]),
    recommendation: 'request-user-decision' as const,
  });
};
