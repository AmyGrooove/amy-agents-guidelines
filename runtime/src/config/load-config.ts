import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { RUNTIME_VERSIONS } from '../versions.js';

import type {
  IAmyRuntimeConfig,
  ICapabilityConfig,
  ILoadedRuntimeConfig,
  ILoadRuntimeConfigProps,
  IRuntimeConfigOverrides,
  TRuntimeConfigSource,
} from './runtime-config.js';
import { validateRuntimeConfig } from './validate-config.js';

interface IConfigLayer {
  config: IRuntimeConfigOverrides;
  source: TRuntimeConfigSource;
}

const checkIsMissingFileError = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

const readConfigLayer = async (
  path: string,
  source: TRuntimeConfigSource,
): Promise<IConfigLayer | undefined> => {
  try {
    const content = await readFile(path, 'utf8');
    const value: unknown = JSON.parse(content);

    return {
      config: validateRuntimeConfig({
        isSchemaRequired: true,
        source,
        value,
      }),
      source,
    };
  } catch (error) {
    if (checkIsMissingFileError(error)) {
      return undefined;
    }

    if (error instanceof AmyRuntimeError) {
      throw error;
    }

    throw new AmyRuntimeError({
      cause: error,
      code: 'INVALID_CONFIGURATION',
      details: { path, source },
      message: `Cannot read configuration from ${path}`,
    });
  }
};

const mergeCapabilityConfig = (
  current: Readonly<ICapabilityConfig> | undefined,
  incoming: Readonly<ICapabilityConfig>,
): Readonly<ICapabilityConfig> =>
  Object.freeze({
    ...current,
    ...incoming,
  });

const mergeLayers = (
  layers: readonly IConfigLayer[],
): Readonly<IAmyRuntimeConfig> => {
  const capabilities = layers.reduce<
    Readonly<Record<string, Readonly<ICapabilityConfig>>>
  >(
    (currentCapabilities, layer) =>
      Object.entries(layer.config.capabilities ?? {}).reduce(
        (nextCapabilities, [id, config]) => ({
          ...nextCapabilities,
          [id]: mergeCapabilityConfig(nextCapabilities[id], config),
        }),
        currentCapabilities,
      ),
    {},
  );

  return Object.freeze({
    capabilities: Object.freeze(capabilities),
    schemaVersion: RUNTIME_VERSIONS.configSchema,
  });
};

export const loadRuntimeConfig = async (
  props: ILoadRuntimeConfigProps,
): Promise<ILoadedRuntimeConfig> => {
  const homeDirectory = props.homeDirectory ?? homedir();
  const fileLayers = await Promise.all([
    readConfigLayer(join(homeDirectory, '.amy', 'config.json'), 'global'),
    readConfigLayer(join(props.projectRoot, '.amy', 'config.json'), 'project'),
  ]);
  const overrideLayer = props.overrides
    ? {
        config: validateRuntimeConfig({
          source: 'override',
          value: props.overrides,
        }),
        source: 'override' as const,
      }
    : undefined;
  const layers = [
    { config: {}, source: 'defaults' as const },
    ...fileLayers.filter((layer) => layer !== undefined),
    ...(overrideLayer ? [overrideLayer] : []),
  ];

  return {
    config: mergeLayers(layers),
    sources: Object.freeze(layers.map(({ source }) => source)),
  };
};
