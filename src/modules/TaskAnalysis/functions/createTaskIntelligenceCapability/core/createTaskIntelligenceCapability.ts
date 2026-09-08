import { RUNTIME_VERSIONS } from '#entities/runtime';

import { classifyTask } from '../../../core/TaskAnalysis.js';
import { validateTaskContract } from '#entities/task';

import type { IAmyCapability } from '#entities/runtime';
import type { ITaskIntelligenceApi } from '#entities/task';

export const createTaskIntelligenceCapability = (): IAmyCapability<ITaskIntelligenceApi> => ({
  api: {
    classify: classifyTask,
    validateContract: validateTaskContract,
  },
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.task-intelligence',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.0.0',
  },
});
