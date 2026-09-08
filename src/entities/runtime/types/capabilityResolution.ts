import type { IAmyCapability } from './capabilityContract.js';

export type TCapabilityResolutionStatus =
  | 'available'
  | 'disabled'
  | 'missing'
  | 'unavailable';

export type TCapabilityResolution =
  | {
      capability: IAmyCapability;
      status: 'available';
    }
  | {
      capability?: undefined;
      status: Exclude<TCapabilityResolutionStatus, 'available'>;
    };
