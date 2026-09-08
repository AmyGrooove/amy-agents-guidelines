import { RUNTIME_VERSIONS } from '#entities/runtime';
import { MemoryContextExplorationCache } from '../../../ContextExplorationCache/core/ContextExplorationCache.js';
import { resolveTaskContext } from '../../../core/ContextResolution.js';

import type { IAmyCapability } from '#entities/runtime';
import type { IProjectIntelligenceApi } from '#entities/project';
import type { IContextIntelligenceApi } from '#entities/context';
import type { IContextExplorationCache } from '../../../ContextExplorationCache/core/ContextExplorationCache.js';

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
