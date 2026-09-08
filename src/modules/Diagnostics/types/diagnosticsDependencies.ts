import type {
  ILoadedRuntimeConfig,
  ILoadRuntimeConfigProps,
} from '#entities/runtime';

export type TLoadRuntimeConfig = (
  props: Readonly<ILoadRuntimeConfigProps>,
) => Promise<Readonly<ILoadedRuntimeConfig>>;
