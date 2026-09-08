import { RUNTIME_VERSIONS } from '#entities/runtime';
import { routeStrategy } from '../../../core/StrategyRouting.js';

import type { IAmyCapability } from '#entities/runtime';
import type { IStrategyRoutingApi } from '#entities/executionPlan';

export const createStrategyRoutingCapability = (): IAmyCapability<IStrategyRoutingApi> => ({
  api: { route: routeStrategy },
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.strategy-routing',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.0.0',
  },
});
