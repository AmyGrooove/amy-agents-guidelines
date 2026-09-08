import { RUNTIME_VERSIONS } from '#entities/runtime';

import { discoverProject } from '../../../core/ProjectDiscovery.js';
import {
  analyzeProjectIntelligenceImpact,
  loadProjectIntelligenceGraph,
  rebuildProjectIntelligenceGraph,
  saveProjectIntelligenceGraph,
} from '../../buildProjectIntelligenceGraph/core/buildProjectIntelligenceGraph.js';
import {
  assessProjectIntelligenceFreshness,
  refreshProjectIntelligenceFreshness,
} from '../../assessProjectIntelligenceFreshness/core/assessProjectIntelligenceFreshness.js';
import { ProjectIntelligenceStore } from '../../../ProjectIntelligenceStore/core/ProjectIntelligenceStore.js';
import { syncAgentsRouter } from '../../syncAgentsRouter/core/syncAgentsRouter.js';
import { AmyRuntimeError } from '#entities/runtime';

import type { IAmyCapability } from '#entities/runtime';
import type { IProjectIntelligenceApi } from '#entities/project';

const withStore = async <TValue>(
  startPath: string,
  operation: (store: ProjectIntelligenceStore) => Promise<TValue>,
) => operation(await ProjectIntelligenceStore.create(startPath));

const requireKnowledge = async (store: ProjectIntelligenceStore) => {
  const knowledge = await store.load();

  if (!knowledge) {
    throw new AmyRuntimeError({
      code: 'VALIDATION_FAILURE',
      message: 'Project Intelligence knowledge is required for this operation',
    });
  }

  return knowledge;
};

export const createProjectIntelligenceCapability = (
  projectRoot: string,
): IAmyCapability<IProjectIntelligenceApi> => ({
  api: {
    analyzeImpact: async (id) =>
      withStore(projectRoot, async (store) =>
        analyzeProjectIntelligenceImpact(
          store.projectRoot,
          await requireKnowledge(store),
          id,
        ),
      ),
    assessFreshness: async (owners) =>
      withStore(projectRoot, async (store) =>
        assessProjectIntelligenceFreshness(
          store.projectRoot,
          await requireKnowledge(store),
          owners,
        ),
      ),
    discover: async () => discoverProject(projectRoot),
    getModule: async (id) =>
      withStore(projectRoot, (store) => store.getModule(id)),
    listModules: async () =>
      withStore(projectRoot, (store) => store.listModules()),
    loadGraph: async () =>
      withStore(projectRoot, (store) =>
        loadProjectIntelligenceGraph(store.projectRoot),
      ),
    loadKnowledge: async () =>
      withStore(projectRoot, (store) => store.load()),
    rebuildGraph: async () =>
      withStore(projectRoot, async (store) =>
        rebuildProjectIntelligenceGraph(
          store.projectRoot,
          await requireKnowledge(store),
        ),
      ),
    refreshFreshness: async (owners) =>
      withStore(projectRoot, async (store) =>
        refreshProjectIntelligenceFreshness(
          store.projectRoot,
          await requireKnowledge(store),
          owners,
        ),
      ),
    resolveSourceLocations: async (id) =>
      withStore(projectRoot, (store) => store.resolveSourceLocations(id)),
    saveGraph: async (value) =>
      withStore(projectRoot, async (store) =>
        saveProjectIntelligenceGraph(
          store.projectRoot,
          await requireKnowledge(store),
          value,
        ),
      ),
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
    version: '1.1.0',
  },
});
