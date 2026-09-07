import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { RUNTIME_VERSIONS } from '../versions.js';

import type {
  ISetStateProps,
  IStateAddress,
  IStateRecord,
  IStateStore,
  TJsonValue,
} from './state-store.js';

const checkIsJsonValue = (value: unknown): value is TJsonValue => {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(checkIsJsonValue);
  }

  if (typeof value === 'object') {
    return Object.values(value).every(checkIsJsonValue);
  }

  return false;
};

const cloneJsonValue = (value: TJsonValue): TJsonValue =>
  structuredClone(value);

const createStorageKey = ({ key, namespace }: IStateAddress) =>
  `${namespace}\u0000${key}`;

const cloneRecord = (record: IStateRecord): IStateRecord => ({
  ...record,
  value: cloneJsonValue(record.value),
});

export class MemoryStateStore implements IStateStore {
  readonly #records = new Map<string, IStateRecord>();

  async get(address: IStateAddress): Promise<IStateRecord | undefined> {
    const record = this.#records.get(createStorageKey(address));

    return record ? cloneRecord(record) : undefined;
  }

  async set(props: ISetStateProps): Promise<IStateRecord> {
    if (!checkIsJsonValue(props.value)) {
      throw new AmyRuntimeError({
        code: 'VALIDATION_FAILURE',
        details: { key: props.key, namespace: props.namespace },
        message: 'Runtime state value must be JSON-compatible',
      });
    }

    const record: IStateRecord = {
      key: props.key,
      namespace: props.namespace,
      schemaVersion: RUNTIME_VERSIONS.stateSchema,
      updatedAt: new Date().toISOString(),
      value: cloneJsonValue(props.value),
    };

    this.#records.set(createStorageKey(props), record);

    return cloneRecord(record);
  }

  async delete(address: IStateAddress): Promise<void> {
    this.#records.delete(createStorageKey(address));
  }

  async clear(namespace: string): Promise<void> {
    [...this.#records.entries()]
      .filter(([, record]) => record.namespace === namespace)
      .forEach(([key]) => this.#records.delete(key));
  }
}
