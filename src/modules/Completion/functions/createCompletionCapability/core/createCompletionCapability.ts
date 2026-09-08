import { RUNTIME_VERSIONS } from '#entities/runtime';
import { runCompletionProtocol } from '../../../core/Completion.js';

import type { IAmyCapability } from '#entities/runtime';
import type { ICompletionApi } from '#entities/executionResult';

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
