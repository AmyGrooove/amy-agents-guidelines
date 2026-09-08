import { RUNTIME_VERSIONS } from '../versions.js';
import { recordObservability } from './observability-recorder.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { IRuntimeEventBus } from '../events/runtime-event.js';
import type { IObservabilityApi } from './observability-contract.js';

export interface ICreateObservabilityCapabilityOptions {
  events: IRuntimeEventBus;
  runtimeId: string;

  now?: () => string;
}

export const createObservabilityCapability = (
  options: Readonly<ICreateObservabilityCapabilityOptions>,
): IAmyCapability<IObservabilityApi> => ({
  api: {
    record: (value) => recordObservability(value, options),
  },
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.observability',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.0.0',
  },
});
