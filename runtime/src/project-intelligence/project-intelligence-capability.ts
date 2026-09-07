import { RUNTIME_VERSIONS } from '../versions.js';

import { discoverProject } from './discover-project.js';
import { ProjectIntelligenceStore } from './project-intelligence-store.js';
import { syncAgentsRouter } from './sync-agents-router.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { IProjectIntelligenceApi } from './project-intelligence-contract.js';

const withStore = async <TValue>(
  startPath: string,
  operation: (store: ProjectIntelligenceStore) => Promise<TValue>,
) => operation(await ProjectIntelligenceStore.create(startPath));

export const createProjectIntelligenceCapability = (
  projectRoot: string,
): IAmyCapability<IProjectIntelligenceApi> => ({
  api: {
    discover: async () => discoverProject(projectRoot),
    getModule: async (id) =>
      withStore(projectRoot, (store) => store.getModule(id)),
    listModules: async () =>
      withStore(projectRoot, (store) => store.listModules()),
    loadKnowledge: async () =>
      withStore(projectRoot, (store) => store.load()),
    resolveSourceLocations: async (id) =>
      withStore(projectRoot, (store) => store.resolveSourceLocations(id)),
    saveKnowledge: async (value) =>
      withStore(projectRoot, (store) => store.save(value)),
    syncAgentsRouter: async () =>
      withStore(projectRoot, async (store) =>
        syncAgentsRouter(store.projectRoot, (await store.load()) !== undefined),
      ),
  },
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.project-intelligence',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.0.0',
  },
});
