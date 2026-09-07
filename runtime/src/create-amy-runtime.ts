import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { CapabilityRegistry } from './capabilities/capability-registry.js';
import { createPluginInventoryCapability } from './compatibility/plugin-inventory-capability.js';
import { loadRuntimeConfig } from './config/load-config.js';
import { RuntimeEventBus } from './events/runtime-event-bus.js';
import { AmyRuntime } from './kernel/amy-runtime.js';
import { MemoryStateStore } from './state/memory-state-store.js';

import type { IAmyCapability } from './capabilities/capability-contract.js';
import type { IRuntimeConfigOverrides } from './config/runtime-config.js';
import type { IRuntimeEventBus } from './events/runtime-event.js';
import type { IStateStore } from './state/state-store.js';

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
  const defaultPluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

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
