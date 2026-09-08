import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { RUNTIME_VERSIONS } from '../versions.js';
import {
  DATA_STORAGE_LIMITS,
  DEFAULT_DATA_STORAGE_POLICY,
} from './data-storage-contract.js';

import type { IRuntimeEvent, TRuntimeEventType } from '../events/runtime-event.js';
import type { TJsonValue } from '../state/state-store.js';
import type {
  IDataPrivacyPolicy,
  TSqliteStorageMode,
} from './data-storage-contract.js';

const RUNTIME_EVENT_TYPES: readonly TRuntimeEventType[] = [
  'capability.failed',
  'capability.resolved',
  'observability.recorded',
  'runtime.started',
  'runtime.stopped',
];

const checkIsRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const checkIsJsonValue = (value: unknown): value is TJsonValue => {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return Number.isFinite(value as number) || typeof value !== 'number';
  }

  if (Array.isArray(value)) {
    return value.every((entry) => checkIsJsonValue(entry));
  }

  if (checkIsRecord(value)) {
    return Object.values(value).every((entry) => checkIsJsonValue(entry));
  }

  return false;
};

const validationError = (message: string) =>
  new AmyRuntimeError({
    code: 'VALIDATION_FAILURE',
    message,
  });

export const validateRuntimeEventForStorage = (
  value: unknown,
): Readonly<IRuntimeEvent> => {
  if (!checkIsRecord(value)) {
    throw validationError('Data storage Runtime event must be an object');
  }

  const unknownKeys = Object.keys(value).filter(
    (key) =>
      !['payload', 'runtimeId', 'schemaVersion', 'timestamp', 'type'].includes(
        key,
      ),
  );

  if (unknownKeys.length > 0) {
    throw validationError(
      `Unknown Data storage Runtime event fields: ${unknownKeys.join(', ')}`,
    );
  }

  if (value.schemaVersion !== RUNTIME_VERSIONS.eventSchema) {
    throw validationError('Data storage Runtime event schema is incompatible');
  }

  if (
    typeof value.runtimeId !== 'string' ||
    !value.runtimeId.trim() ||
    typeof value.timestamp !== 'string' ||
    !value.timestamp.trim() ||
    typeof value.type !== 'string' ||
    !RUNTIME_EVENT_TYPES.some((type) => type === value.type) ||
    !checkIsRecord(value.payload) ||
    !checkIsJsonValue(value.payload)
  ) {
    throw validationError('Data storage Runtime event is invalid');
  }

  return Object.freeze({
    payload: value.payload as Readonly<Record<string, TJsonValue>>,
    runtimeId: value.runtimeId,
    schemaVersion: value.schemaVersion,
    timestamp: value.timestamp,
    type: value.type as TRuntimeEventType,
  });
};

export const validateDataPrivacyPolicy = (
  value: Readonly<Partial<IDataPrivacyPolicy>> | undefined,
): Readonly<IDataPrivacyPolicy> => {
  const rawContent = value?.rawContent ?? DEFAULT_DATA_STORAGE_POLICY.privacy.rawContent;

  if (rawContent !== 'omit' && rawContent !== 'redacted') {
    throw validationError('Data storage rawContent privacy policy is invalid');
  }

  return Object.freeze({ rawContent });
};

export const validateRetentionDays = (value: number | undefined): number => {
  const retentionDays = value ?? DEFAULT_DATA_STORAGE_POLICY.retentionDays;

  if (
    !Number.isInteger(retentionDays) ||
    retentionDays < DATA_STORAGE_LIMITS.minRetentionDays ||
    retentionDays > DATA_STORAGE_LIMITS.maxRetentionDays
  ) {
    throw validationError(
      `Data storage retentionDays must be an integer between ${DATA_STORAGE_LIMITS.minRetentionDays} and ${DATA_STORAGE_LIMITS.maxRetentionDays}`,
    );
  }

  return retentionDays;
};

export const validateSqliteMode = (
  value: TSqliteStorageMode | undefined,
): TSqliteStorageMode => {
  const sqlite = value ?? DEFAULT_DATA_STORAGE_POLICY.sqlite;

  if (sqlite !== 'auto' && sqlite !== 'disabled') {
    throw validationError('Data storage sqlite mode is invalid');
  }

  return sqlite;
};

export const validateExportLimit = (value: number | undefined): number => {
  const limit = value ?? DATA_STORAGE_LIMITS.defaultExportRecords;

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > DATA_STORAGE_LIMITS.maxExportRecords
  ) {
    throw validationError(
      `Data storage export limit must be an integer between 1 and ${DATA_STORAGE_LIMITS.maxExportRecords}`,
    );
  }

  return limit;
};
