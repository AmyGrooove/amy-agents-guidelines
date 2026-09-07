export interface ICapabilityConfig {
  enabled?: boolean;
  required?: boolean;
}

export interface IAmyRuntimeConfig {
  capabilities: Readonly<Record<string, Readonly<ICapabilityConfig>>>;
  schemaVersion: number;
}

export interface IRuntimeConfigOverrides {
  capabilities?: Readonly<Record<string, Readonly<ICapabilityConfig>>>;
}

export type TRuntimeConfigSource =
  | 'defaults'
  | 'global'
  | 'project'
  | 'override';

export interface ILoadedRuntimeConfig {
  config: Readonly<IAmyRuntimeConfig>;
  sources: readonly TRuntimeConfigSource[];
}

export interface ILoadRuntimeConfigProps {
  projectRoot: string;

  homeDirectory?: string;
  overrides?: IRuntimeConfigOverrides;
}
