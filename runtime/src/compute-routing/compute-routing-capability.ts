import { RUNTIME_VERSIONS } from '../versions.js';
import { routeCompute } from './compute-router.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type {
  IComputeRoutingApi,
  IComputeRoutingConfig,
} from './compute-routing-contract.js';

export interface ICreateComputeRoutingCapabilityOptions {
  config?: Readonly<IComputeRoutingConfig>;
}

export const createComputeRoutingCapability = (
  options: ICreateComputeRoutingCapabilityOptions = {},
): IAmyCapability<IComputeRoutingApi> => ({
  api: {
    route: (value) =>
      routeCompute(value, {
        ...(options.config ? { config: options.config } : {}),
      }),
  },
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.compute-routing',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.0.0',
  },
});
