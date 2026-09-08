import { RUNTIME_VERSIONS } from '../versions.js';
import { analyzeAmyData } from './analytics-engine.js';
import { analyzeMechanismHealth } from './mechanism-health.js';
import { discoverTaskArchetypes } from './task-archetypes.js';
import { validateAnalyticsInput } from './validate-analytics.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { IAnalyticsApi } from './analytics-contract.js';

export const createAnalyticsCapability = (): IAmyCapability<IAnalyticsApi> => ({
  api: {
    analyze: analyzeAmyData,
    analyzeHealth: analyzeMechanismHealth,
    discoverArchetypes: discoverTaskArchetypes,
    validateInput: validateAnalyticsInput,
  },
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.analytics',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.1.0',
  },
});
