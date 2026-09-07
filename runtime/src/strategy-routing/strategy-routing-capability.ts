import { RUNTIME_VERSIONS } from '../versions.js';
import { routeStrategy } from './strategy-router.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { IStrategyRoutingApi } from './strategy-routing-contract.js';

export const createStrategyRoutingCapability = (): IAmyCapability<IStrategyRoutingApi> => ({
  api: { route: routeStrategy },
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.strategy-routing',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.0.0',
  },
});
