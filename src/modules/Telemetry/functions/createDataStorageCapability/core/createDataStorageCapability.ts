import { AmyRuntimeError } from '#entities/runtime';
import { RUNTIME_VERSIONS } from '#entities/runtime';
import { FileDataStorage } from '../../../FileDataStorage/core/FileDataStorage.js';

import type { IAmyCapability } from '#entities/runtime';
import type { TRuntimeEventConsumer } from '#entities/runtime';
import type { IDataStorageApi } from '../../../types/dataStorageContract.js';
import type { IFileDataStorageOptions } from '../../../FileDataStorage/core/FileDataStorage.js';

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
