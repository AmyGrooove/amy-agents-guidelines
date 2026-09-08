import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { validateComputeRoutingConfig } from '#modules/ComputeRouting';
import { AmyRuntimeError } from '#entities/runtime';
import { RUNTIME_VERSIONS } from '#entities/runtime';

import type { IComputeProfileBinding, IComputeRoutingConfig, TComputeProfile } from '#entities/computeProfile';
import type {
  IAmyRuntimeConfig,
  ICapabilityConfig,
  ILoadedRuntimeConfig,
  ILoadRuntimeConfigProps,
  IRuntimeConfigOverrides,
  TRuntimeConfigSource,
} from '#entities/runtime';
import { validateRuntimeConfig } from '../../validateRuntimeConfig/core/validateRuntimeConfig.js';

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

const mergeComputeProfileBinding = (
  current: Readonly<IComputeProfileBinding> | undefined,
  incoming: Readonly<IComputeProfileBinding>,
): Readonly<IComputeProfileBinding> =>
  Object.freeze({
    ...current,
    ...incoming,
    ...(incoming.fallbackModels
      ? { fallbackModels: Object.freeze([...incoming.fallbackModels]) }
      : {}),
  });

const mergeComputeConfig = (
  current: Readonly<IComputeRoutingConfig> | undefined,
  incoming: Readonly<IComputeRoutingConfig>,
): Readonly<IComputeRoutingConfig> => {
  const profiles = Object.entries(incoming.profiles ?? {}).reduce<
    Partial<Record<TComputeProfile, Readonly<IComputeProfileBinding>>>
  >(
    (nextProfiles, [profile, binding]) => ({
      ...nextProfiles,
      [profile]: mergeComputeProfileBinding(
        current?.profiles?.[profile as TComputeProfile],
        binding,
      ),
    }),
    { ...(current?.profiles ?? {}) },
  );

  return Object.freeze({
    ...(current?.defaultProfile
      ? { defaultProfile: current.defaultProfile }
      : {}),
    ...(Object.keys(profiles).length > 0
      ? { profiles: Object.freeze(profiles) }
      : {}),
    ...(incoming.defaultProfile
      ? { defaultProfile: incoming.defaultProfile }
      : {}),
  });
};

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
  const compute = layers.reduce<Readonly<IComputeRoutingConfig> | undefined>(
    (currentCompute, layer) =>
      layer.config.compute
        ? mergeComputeConfig(currentCompute, layer.config.compute)
        : currentCompute,
    undefined,
  );

  const validatedCompute = compute
    ? validateComputeRoutingConfig(compute, {
        code: 'INVALID_CONFIGURATION',
        source: 'merged',
      })
    : undefined;

  return Object.freeze({
    capabilities: Object.freeze(capabilities),
    ...(validatedCompute ? { compute: validatedCompute } : {}),
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
