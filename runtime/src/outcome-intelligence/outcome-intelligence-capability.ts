import { RUNTIME_VERSIONS } from '../versions.js';
import { assessOutcome } from './outcome-assessor.js';
import { detectUserCorrection } from './user-correction-detector.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { IOutcomeIntelligenceApi } from './outcome-intelligence-contract.js';

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
