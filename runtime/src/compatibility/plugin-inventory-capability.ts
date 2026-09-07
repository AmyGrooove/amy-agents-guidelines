import { RUNTIME_VERSIONS } from '../versions.js';

import { discoverPluginInventory } from './discover-plugin-inventory.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { IPluginInventoryApi } from './plugin-inventory.js';

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
