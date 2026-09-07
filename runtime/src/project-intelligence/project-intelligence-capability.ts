import { RUNTIME_VERSIONS } from '../versions.js';

import { discoverProject } from './discover-project.js';
import {
  analyzeProjectIntelligenceImpact,
  loadProjectIntelligenceGraph,
  rebuildProjectIntelligenceGraph,
  saveProjectIntelligenceGraph,
} from './project-intelligence-graph.js';
import {
  assessProjectIntelligenceFreshness,
  refreshProjectIntelligenceFreshness,
} from './project-intelligence-freshness.js';
import { ProjectIntelligenceStore } from './project-intelligence-store.js';
import { syncAgentsRouter } from './sync-agents-router.js';
import { AmyRuntimeError } from '../errors/amy-runtime-error.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { IProjectIntelligenceApi } from './project-intelligence-contract.js';

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
