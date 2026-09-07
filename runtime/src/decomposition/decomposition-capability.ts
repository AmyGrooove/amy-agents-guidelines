import { RUNTIME_VERSIONS } from '../versions.js';
import { DEFAULT_DECOMPOSITION_POLICY } from './decomposition-contract.js';
import { planDecomposition } from './decomposition-planner.js';
import { validateDecompositionPolicy } from './validate-decomposition.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { IDecompositionApi, IDecompositionPolicyConfig } from './decomposition-contract.js';

export interface ICreateDecompositionCapabilityOptions {
  policy?: Readonly<IDecompositionPolicyConfig>;
}

export const createDecompositionCapability = (
  options: ICreateDecompositionCapabilityOptions = {},
): IAmyCapability<IDecompositionApi> => {
  const policy = validateDecompositionPolicy(options.policy ?? DEFAULT_DECOMPOSITION_POLICY);

  return {
    api: {
      plan: (value) => planDecomposition(value, { policy }),
    },
    descriptor: {
      capabilityContract: RUNTIME_VERSIONS.capabilityContract,
      id: 'amy.decomposition',
      runtimeApi: RUNTIME_VERSIONS.runtimeApi,
      version: '1.0.0',
    },
  };
};
