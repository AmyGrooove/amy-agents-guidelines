import { RUNTIME_VERSIONS } from '#entities/runtime';
import { analyzeAmyData } from '../../../core/Analytics.js';
import { analyzeMechanismHealth } from '../../analyzeMechanismHealth/core/analyzeMechanismHealth.js';
import { discoverTaskArchetypes } from '../../discoverTaskArchetypes/core/discoverTaskArchetypes.js';
import { validateAnalyticsInput } from '../../validateAnalytics/core/validateAnalytics.js';

import type { IAmyCapability } from '#entities/runtime';
import type { IAnalyticsApi } from '../../../types/analyticsContract.js';

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
