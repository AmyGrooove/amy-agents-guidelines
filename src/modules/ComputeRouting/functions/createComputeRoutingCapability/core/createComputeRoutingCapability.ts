import { RUNTIME_VERSIONS } from '#entities/runtime';
import { routeCompute } from '../../../core/ComputeRouting.js';

import type { IAmyCapability } from '#entities/runtime';
import type { IComputeRoutingConfig } from '#entities/computeProfile';
import type { IComputeRoutingApi } from '../../../types/computeRoutingContract.js';

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
