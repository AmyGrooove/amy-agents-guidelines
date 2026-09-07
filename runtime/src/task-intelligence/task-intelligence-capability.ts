import { RUNTIME_VERSIONS } from '../versions.js';

import { classifyTask } from './task-classifier.js';
import { validateTaskContract } from './validate-task-intelligence.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { ITaskIntelligenceApi } from './task-intelligence-contract.js';

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
