import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { CapabilityRegistry } from '../../../CapabilityRegistry/core/CapabilityRegistry.js';
import { createPluginInventoryCapability } from '#modules/PluginInventory';
import { loadRuntimeConfig } from '../../loadRuntimeConfig/core/loadRuntimeConfig.js';
import { RuntimeEventBus } from '../../../RuntimeEventBus/core/RuntimeEventBus.js';
import { AmyRuntime } from '../../../core/Runtime.js';
import { MemoryStateStore } from '../../../MemoryStateStore/core/MemoryStateStore.js';

import type { IAmyCapability } from '#entities/runtime';
import type { IRuntimeConfigOverrides } from '#entities/runtime';
import type { IRuntimeEventBus } from '#entities/runtime';
import type { IStateStore } from '#entities/runtime';

export interface ICreateAmyRuntimeProps {
  projectRoot: string;

  capabilities?: readonly IAmyCapability[];
  events?: IRuntimeEventBus;
  homeDirectory?: string;
  overrides?: IRuntimeConfigOverrides;
  pluginRoot?: string;
  runtimeId?: string;
  state?: IStateStore;
}

export const createAmyRuntime = async (
  props: ICreateAmyRuntimeProps,
): Promise<AmyRuntime> => {
  const loadedConfig = await loadRuntimeConfig({
    ...(props.homeDirectory ? { homeDirectory: props.homeDirectory } : {}),
    ...(props.overrides ? { overrides: props.overrides } : {}),
    projectRoot: props.projectRoot,
  });
  const capabilities = new CapabilityRegistry(loadedConfig.config);
  const defaultPluginRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
  );

  capabilities.register(
    createPluginInventoryCapability(props.pluginRoot ?? defaultPluginRoot),
  );

  props.capabilities?.forEach((capability) =>
    capabilities.register(capability),
  );

  return new AmyRuntime({
    capabilities,
    config: loadedConfig.config,
    events: props.events ?? new RuntimeEventBus(),
    runtimeId: props.runtimeId ?? randomUUID(),
    state: props.state ?? new MemoryStateStore(),
  });
};
