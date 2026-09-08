import { EVOLUTION_VERSIONS } from './evolution-contract.js';
import { getImprovementRecommendation } from './evolution-policy.js';
import {
  validateImprovementDecisionInput,
  validateImprovementProposalInput,
} from './validate-evolution.js';

import type {
  IImprovementDecision,
  IImprovementProposal,
} from './evolution-contract.js';

export const createImprovementProposal = (
  value: unknown,
): Readonly<IImprovementProposal> => {
  const input = validateImprovementProposalInput(value);
  const recommendation = getImprovementRecommendation(input);

  return Object.freeze({
    ...input,
    automaticApplication: false as const,
    causalClaim: false as const,
    kind: 'improvement-proposal' as const,
    reasonCodes: recommendation.reasonCodes,
    recommendation: recommendation.recommendation,
    schemaVersion: EVOLUTION_VERSIONS.proposalSchema,
    userDecisionRequired: true as const,
  });
};

export const recordImprovementDecision = (
  value: unknown,
): Readonly<IImprovementDecision> => {
  const input = validateImprovementDecisionInput(value);

  return Object.freeze({
    automaticApplication: false as const,
    decidedBy: 'user' as const,
    decision: input.decision,
    kind: 'improvement-decision' as const,
    ...(input.note === undefined ? {} : { note: input.note }),
    proposalId: input.proposal.proposalId,
    schemaVersion: EVOLUTION_VERSIONS.decisionSchema,
  });
};
