import { RUNTIME_VERSIONS } from '../versions.js';
import { analyzeCounterfactuals } from './counterfactual-analysis.js';
import {
  createImprovementProposal,
  recordImprovementDecision,
} from './improvement-proposal.js';
import { compareShadowStrategy } from './shadow-routing.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { IEvolutionApi } from './evolution-contract.js';

export const createEvolutionCapability = (): IAmyCapability<IEvolutionApi> => ({
  api: {
    analyzeCounterfactuals,
    compareShadowStrategy,
    createProposal: createImprovementProposal,
    recordDecision: recordImprovementDecision,
  },
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.evolution',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.0.0',
  },
});
