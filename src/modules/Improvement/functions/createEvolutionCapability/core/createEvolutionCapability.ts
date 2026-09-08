import { RUNTIME_VERSIONS } from '#entities/runtime';
import { analyzeCounterfactuals } from '../../analyzeCounterfactuals/core/analyzeCounterfactuals.js';
import {
  createImprovementProposal,
  recordImprovementDecision,
} from '../../../core/Improvement.js';
import { compareShadowStrategy } from '../../compareShadowStrategy/core/compareShadowStrategy.js';

import type { IAmyCapability } from '#entities/runtime';
import type { IEvolutionApi } from '../../../types/evolutionContract.js';

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
