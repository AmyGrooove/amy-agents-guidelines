import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { RUNTIME_VERSIONS } from '../versions.js';
import { FileDataStorage } from './file-data-storage.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { TRuntimeEventConsumer } from '../events/runtime-event.js';
import type { IDataStorageApi } from './data-storage-contract.js';
import type { IFileDataStorageOptions } from './file-data-storage.js';

export interface ICreateDataStorageCapabilityOptions
  extends IFileDataStorageOptions {}

export const createDataStorageCapability = (
  options: Readonly<ICreateDataStorageCapabilityOptions>,
): IAmyCapability<IDataStorageApi> => ({
  api: new FileDataStorage(options),
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.data-storage',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.1.0',
  },
});

export const createDataStorageEventConsumer = (
  api: IDataStorageApi,
): TRuntimeEventConsumer =>
  async (event) => {
    const receipt = await api.capture(event);

    if (receipt.status === 'stored') {
      return;
    }

    throw new AmyRuntimeError({
      code: 'CAPABILITY_EXECUTION_FAILURE',
      details: {
        failures: receipt.failures,
        normalized: receipt.normalized,
        raw: receipt.raw,
        status: receipt.status,
      },
      message: `Data storage capture ${receipt.status}`,
    });
  };
