export interface ICapabilityDependency {
  id: string;
  versionMajor: number;
}

export interface ICapabilityDependencies {
  optional?: readonly ICapabilityDependency[] | undefined;
  required?: readonly ICapabilityDependency[] | undefined;
}

export interface ICapabilityDescriptor {
  capabilityContract: number;
  id: string;
  runtimeApi: number;
  version: string;

  dependencies?: ICapabilityDependencies | undefined;
}

export interface IAmyCapability<TApi = unknown> {
  api: TApi;
  descriptor: ICapabilityDescriptor;

  checkAvailability?: (() => Promise<boolean>) | undefined;
}

export interface ICapabilityListItem extends ICapabilityDescriptor {
  isEnabled: boolean;
  isRequired: boolean;
}
