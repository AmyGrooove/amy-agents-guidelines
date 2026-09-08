import { RUNTIME_VERSIONS } from '#entities/runtime';
import { runVerificationPipeline } from '../../../core/Verification.js';

import type { IAmyCapability } from '#entities/runtime';
import type { IVerificationApi } from '#entities/verificationResult';

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
