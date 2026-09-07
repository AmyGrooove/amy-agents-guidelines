import { RUNTIME_VERSIONS } from '../versions.js';
import { MemoryContextExplorationCache } from './context-exploration-cache.js';
import { resolveTaskContext } from './context-resolver.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { IProjectIntelligenceApi } from '../project-intelligence/project-intelligence-contract.js';
import type { IContextIntelligenceApi } from './context-intelligence-contract.js';
import type { IContextExplorationCache } from './context-exploration-cache.js';

export interface ICreateContextIntelligenceCapabilityOptions {
  cache?: Readonly<IContextExplorationCache>;
  projectIntelligence?: Readonly<IProjectIntelligenceApi>;
}

export const createContextIntelligenceCapability = (
  options: ICreateContextIntelligenceCapabilityOptions = {},
): IAmyCapability<IContextIntelligenceApi> => {
  const cache = options.cache ?? new MemoryContextExplorationCache();

  return {
    api: {
      resolve: (value) =>
        resolveTaskContext(value, {
          cache,
          ...(options.projectIntelligence
            ? { projectIntelligence: options.projectIntelligence }
            : {}),
        }),
    },
    descriptor: {
      capabilityContract: RUNTIME_VERSIONS.capabilityContract,
      dependencies: {
        optional: [{ id: 'amy.project-intelligence', versionMajor: 1 }],
      },
      id: 'amy.context-intelligence',
      runtimeApi: RUNTIME_VERSIONS.runtimeApi,
      version: '1.0.0',
    },
  };
};
