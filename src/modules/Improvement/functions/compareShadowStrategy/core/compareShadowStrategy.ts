import { EVOLUTION_VERSIONS } from '../../../types/evolutionContract.js';
import { validateShadowStrategyInput } from '../../validateEvolution/core/validateEvolution.js';

import type { IStrategyRoutingData } from '#entities/executionPlan';
import type {
  IShadowStrategyComparison,
  IShadowStrategyDifference,
  TShadowStrategyDimension,
} from '../../../types/evolutionContract.js';

const DIMENSIONS: readonly Readonly<{
  dimension: TShadowStrategyDimension;
  read: (data: Readonly<IStrategyRoutingData>) => boolean | string | null;
}>[] = Object.freeze([
  Object.freeze({ dimension: 'compute-profile' as const, read: (data: Readonly<IStrategyRoutingData>) => data.computeProfile ?? null }),
  Object.freeze({ dimension: 'escalation' as const, read: (data: Readonly<IStrategyRoutingData>) => data.escalation }),
  Object.freeze({ dimension: 'execution' as const, read: (data: Readonly<IStrategyRoutingData>) => data.execution }),
  Object.freeze({ dimension: 'exploration' as const, read: (data: Readonly<IStrategyRoutingData>) => data.exploration }),
  Object.freeze({ dimension: 'fast-path' as const, read: (data: Readonly<IStrategyRoutingData>) => data.fastPath }),
  Object.freeze({ dimension: 'planning' as const, read: (data: Readonly<IStrategyRoutingData>) => data.planning }),
  Object.freeze({ dimension: 'review' as const, read: (data: Readonly<IStrategyRoutingData>) => data.review }),
  Object.freeze({ dimension: 'verification' as const, read: (data: Readonly<IStrategyRoutingData>) => data.verification }),
]);

export const compareShadowStrategy = (
  value: unknown,
): Readonly<IShadowStrategyComparison> => {
  const input = validateShadowStrategyInput(value);
  const differences: IShadowStrategyDifference[] = [];

  for (const { dimension, read } of DIMENSIONS) {
    const productionValue = read(input.productionDecision.data);
    const candidateValue = read(input.candidateDecision.data);
    if (productionValue === candidateValue) continue;

    differences.push(Object.freeze({
      candidateValue,
      dimension,
      productionValue,
    }));
  }

  return Object.freeze({
    candidateDecision: input.candidateDecision,
    candidateRef: input.candidateRef,
    causalClaim: false as const,
    differences: Object.freeze(differences),
    evidenceRefs: input.evidenceRefs,
    executionPerformed: false as const,
    kind: 'shadow-strategy-comparison' as const,
    productionDecision: input.productionDecision,
    productionMutation: false as const,
    schemaVersion: EVOLUTION_VERSIONS.shadowSchema,
    shadowId: input.shadowId,
  });
};
