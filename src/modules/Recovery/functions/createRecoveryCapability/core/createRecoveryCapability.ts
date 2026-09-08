import { RUNTIME_VERSIONS } from '#entities/runtime';
import { DEFAULT_RECOVERY_POLICY } from '#entities/executionResult';
import { planRecovery } from '../../../core/Recovery.js';
import { validateRecoveryPolicy } from '#entities/executionResult';

import type { IAmyCapability } from '#entities/runtime';
import type {
  IRecoveryApi,
  IRecoveryPolicyConfig,
} from '#entities/executionResult';

export interface ICreateRecoveryCapabilityOptions {
  policy?: Readonly<IRecoveryPolicyConfig>;
}

export const createRecoveryCapability = (
  options: ICreateRecoveryCapabilityOptions = {},
): IAmyCapability<IRecoveryApi> => {
  const policy = validateRecoveryPolicy(options.policy ?? DEFAULT_RECOVERY_POLICY);

  return {
    api: {
      recover: (value) => planRecovery(value, { policy }),
    },
    descriptor: {
      capabilityContract: RUNTIME_VERSIONS.capabilityContract,
      id: 'amy.recovery',
      runtimeApi: RUNTIME_VERSIONS.runtimeApi,
      version: '1.0.0',
    },
  };
};
