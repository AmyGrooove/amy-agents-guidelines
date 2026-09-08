export { Improvement, createImprovementProposal, recordImprovementDecision } from './core/Improvement.js';
export { analyzeCounterfactuals } from './functions/analyzeCounterfactuals/index.js';
export { compareShadowStrategy } from './functions/compareShadowStrategy/index.js';
export { createEvolutionCapability } from './functions/createEvolutionCapability/index.js';
export { getImprovementRecommendation } from './functions/getImprovementRecommendation/index.js';
export type { IProposalRecommendation } from './functions/getImprovementRecommendation/index.js';
export {
  validateCounterfactualAnalysisInput,
  validateCounterfactualAnalysis,
  validateShadowStrategyInput,
  validateShadowStrategyComparison,
  validateImprovementProposalInput,
  validateImprovementProposal,
  validateImprovementDecisionInput,
} from './functions/validateEvolution/index.js';
export { EVOLUTION_VERSIONS, EVOLUTION_LIMITS } from './types/evolutionContract.js';
export type {
  TEvolutionTarget,
  TEvolutionCounterfactualDimension,
  TEvolutionCostMetric,
  TEvolutionCounterfactualReasonCode,
  TEvolutionRecommendation,
  TEvolutionProposalReasonCode,
  TEvolutionUserDecision,
  TShadowStrategyDimension,
  ICounterfactualAnalysisInput,
  ICounterfactualHypothesis,
  ICounterfactualAnalysis,
  IShadowStrategyInput,
  IShadowStrategyDifference,
  IShadowStrategyComparison,
  IImprovementProposalInput,
  IImprovementProposal,
  IImprovementDecisionInput,
  IImprovementDecision,
  IEvolutionApi,
} from './types/evolutionContract.js';
