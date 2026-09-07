export type TPluginMechanismKind =
  | 'agents'
  | 'permissions'
  | 'scripts'
  | 'skills'
  | 'validators';

export interface IPluginMechanismInventory {
  isPresent: boolean;
  items: readonly string[];
  path: string;
}

export interface IPluginMetadataInventory {
  description: string;
  name: string;
  version: string;
}

export interface IPluginInventory {
  declaredPermissions: readonly string[];
  mechanisms: Readonly<
    Record<TPluginMechanismKind, Readonly<IPluginMechanismInventory>>
  >;
  plugin: Readonly<IPluginMetadataInventory>;
  schemaVersion: number;
}

export interface IPluginInventoryApi {
  load(): Promise<IPluginInventory>;
}
