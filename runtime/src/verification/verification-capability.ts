import { RUNTIME_VERSIONS } from '../versions.js';
import { runVerificationPipeline } from './verification-pipeline.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { IVerificationApi } from './verification-contract.js';

export const createVerificationCapability = (): IAmyCapability<IVerificationApi> => ({
  api: {
    verify: runVerificationPipeline,
  },
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.verification',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.0.0',
  },
});
