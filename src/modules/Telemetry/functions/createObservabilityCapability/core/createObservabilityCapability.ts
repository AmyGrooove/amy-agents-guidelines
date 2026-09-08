import { RUNTIME_VERSIONS } from '#entities/runtime';
import { recordObservability } from '../../../core/Telemetry.js';

import type { IAmyCapability } from '#entities/runtime';
import type { IRuntimeEventBus } from '#entities/runtime';
import type { IObservabilityApi } from '../../../types/observabilityContract.js';

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
