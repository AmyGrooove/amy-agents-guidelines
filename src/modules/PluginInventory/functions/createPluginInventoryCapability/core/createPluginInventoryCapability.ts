import { RUNTIME_VERSIONS } from '#entities/runtime';

import { discoverPluginInventory } from '../../../core/PluginInventory.js';

import type { IAmyCapability } from '#entities/runtime';
import type { IPluginInventoryApi } from '../../../types/pluginInventory.js';

export const createPluginInventoryCapability = (
  pluginRoot: string,
): IAmyCapability<IPluginInventoryApi> => ({
  api: {
    load: async () => discoverPluginInventory(pluginRoot),
  },
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.plugin-inventory',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.0.0',
  },
});
