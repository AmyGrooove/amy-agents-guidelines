import { RUNTIME_VERSIONS } from '../versions.js';
import { OBSERVABILITY_VERSIONS } from './observability-contract.js';
import { validateObservabilityInput } from './validate-observability.js';

import type { IRuntimeEventBus } from '../events/runtime-event.js';
import type { TJsonValue } from '../state/state-store.js';
import type {
  IObservabilityReceipt,
  TObservabilityInput,
  TObservabilityRecord,
} from './observability-contract.js';

export interface IRecordObservabilityOptions {
  events: IRuntimeEventBus;
  runtimeId: string;

  now?: () => string;
}

const createRecord = (
  input: Readonly<TObservabilityInput>,
  timestamp: string,
): Readonly<TObservabilityRecord> =>
  Object.freeze({
    ...input,
    schemaVersion: OBSERVABILITY_VERSIONS.recordSchema,
    timestamp,
  }) as Readonly<TObservabilityRecord>;

const toEventPayload = (
  record: Readonly<TObservabilityRecord>,
): Readonly<Record<string, TJsonValue>> => ({
  record: record as unknown as TJsonValue,
});

export const recordObservability = async (
  value: unknown,
  options: Readonly<IRecordObservabilityOptions>,
): Promise<Readonly<IObservabilityReceipt>> => {
  const input = validateObservabilityInput(value);
  const timestamp = options.now?.() ?? new Date().toISOString();
  const record = createRecord(input, timestamp);

  try {
    const delivery = await options.events.emit({
      payload: toEventPayload(record),
      runtimeId: options.runtimeId,
      schemaVersion: RUNTIME_VERSIONS.eventSchema,
      timestamp,
      type: 'observability.recorded',
    });
    const deliveryFailures = Object.freeze(
      delivery.failures.map(({ message }) => message),
    );

    return Object.freeze({
      deliveredCount: delivery.deliveredCount,
      deliveryFailures,
      record,
      status: deliveryFailures.length === 0 ? 'emitted' : 'degraded',
    });
  } catch (error) {
    return Object.freeze({
      deliveredCount: 0,
      deliveryFailures: Object.freeze([
        error instanceof Error ? error.message : String(error),
      ]),
      record,
      status: 'dropped',
    });
  }
};
