import { RUNTIME_VERSIONS } from '#entities/runtime';
import { assessOutcome } from '../../assessOutcome/core/assessOutcome.js';
import { detectUserCorrection } from '../../detectUserCorrection/core/detectUserCorrection.js';

import type { IAmyCapability } from '#entities/runtime';
import type { IOutcomeIntelligenceApi } from '#entities/executionResult';

export const createOutcomeIntelligenceCapability = (): IAmyCapability<IOutcomeIntelligenceApi> => ({
  api: {
    assess: assessOutcome,
    detectUserCorrection,
  },
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.outcome-intelligence',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.0.0',
  },
});
