import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { RUNTIME_VERSIONS } from '../versions.js';

import type {
  IPluginInventory,
  IPluginMechanismInventory,
  TPluginMechanismKind,
} from './plugin-inventory.js';

const MECHANISM_PATHS: Readonly<Record<TPluginMechanismKind, string>> =
  Object.freeze({
    agents: 'agents',
    permissions: 'permissions',
    scripts: 'scripts',
    skills: 'skills',
    validators: 'validators',
  });

const checkIsRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readManifest = async (pluginRoot: string) => {
  const manifestPath = resolve(pluginRoot, '.codex-plugin', 'plugin.json');

  try {
    const content = await readFile(manifestPath, 'utf8');
    const value: unknown = JSON.parse(content);

    if (
      !checkIsRecord(value) ||
      typeof value.name !== 'string' ||
      typeof value.version !== 'string' ||
      typeof value.description !== 'string'
    ) {
      throw new Error('Required plugin metadata is missing');
    }

    const declaredPermissions =
      checkIsRecord(value.interface) &&
      Array.isArray(value.interface.capabilities) &&
      value.interface.capabilities.every(
        (permission) => typeof permission === 'string',
      )
        ? value.interface.capabilities
        : [];

    return {
      declaredPermissions: Object.freeze([...declaredPermissions].sort()),
      plugin: Object.freeze({
        description: value.description,
        name: value.name,
        version: value.version,
      }),
    };
  } catch (cause) {
    throw new AmyRuntimeError({
      cause,
      code: 'VALIDATION_FAILURE',
      details: { manifestPath },
      message: `Cannot read plugin manifest at ${manifestPath}`,
    });
  }
};

const discoverMechanism = async (
  pluginRoot: string,
  path: string,
): Promise<Readonly<IPluginMechanismInventory>> => {
  const absolutePath = resolve(pluginRoot, path);
  const relativePath = relative(resolve(pluginRoot), absolutePath);

  if (relativePath.startsWith('..')) {
    throw new AmyRuntimeError({
      code: 'VALIDATION_FAILURE',
      details: { path },
      message: 'Plugin mechanism path must stay inside the plugin root',
    });
  }

  try {
    const entries = await readdir(absolutePath, { withFileTypes: true });
    const items = entries
      .filter((entry) => !entry.name.startsWith('.'))
      .map(({ name }) => name)
      .sort();

    return Object.freeze({
      isPresent: true,
      items: Object.freeze(items),
      path,
    });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return Object.freeze({ isPresent: false, items: [], path });
    }

    throw new AmyRuntimeError({
      cause: error,
      code: 'RUNTIME_INTERNAL_FAILURE',
      details: { path },
      message: `Cannot discover plugin mechanism at ${path}`,
    });
  }
};

export const discoverPluginInventory = async (
  pluginRoot: string,
): Promise<IPluginInventory> => {
  const manifest = await readManifest(pluginRoot);
  const mechanismEntries = await Promise.all(
    Object.entries(MECHANISM_PATHS).map(async ([kind, path]) => [
      kind,
      await discoverMechanism(pluginRoot, path),
    ]),
  );

  return Object.freeze({
    declaredPermissions: manifest.declaredPermissions,
    mechanisms: Object.freeze(Object.fromEntries(mechanismEntries)),
    plugin: manifest.plugin,
    schemaVersion: RUNTIME_VERSIONS.capabilityContract,
  });
};
