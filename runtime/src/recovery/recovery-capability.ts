import { RUNTIME_VERSIONS } from '../versions.js';
import { DEFAULT_RECOVERY_POLICY } from './recovery-contract.js';
import { planRecovery } from './recovery-planner.js';
import { validateRecoveryPolicy } from './validate-recovery.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type {
  IRecoveryApi,
  IRecoveryPolicyConfig,
} from './recovery-contract.js';

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
