import { RUNTIME_VERSIONS } from '../versions.js';
import { runCompletionProtocol } from './completion-protocol.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { ICompletionApi } from './completion-contract.js';

export const createCompletionCapability = (): IAmyCapability<ICompletionApi> => ({
  api: {
    complete: runCompletionProtocol,
  },
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.completion',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.0.0',
  },
});
