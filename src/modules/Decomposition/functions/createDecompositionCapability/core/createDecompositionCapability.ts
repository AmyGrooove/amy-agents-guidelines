import { RUNTIME_VERSIONS } from '#entities/runtime';
import { DEFAULT_DECOMPOSITION_POLICY } from '#entities/executionPlan';
import { planDecomposition } from '../../../core/Decomposition.js';
import { validateDecompositionPolicy } from '#entities/executionPlan';

import type { IAmyCapability } from '#entities/runtime';
import type { IDecompositionApi, IDecompositionPolicyConfig } from '#entities/executionPlan';

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
