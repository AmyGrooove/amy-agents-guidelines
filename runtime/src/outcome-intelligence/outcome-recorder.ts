import { RUNTIME_VERSIONS } from '../versions.js';
import { assessOutcome } from './outcome-assessor.js';

import type { IRuntimeEventBus } from '../events/runtime-event.js';
import type { TJsonValue } from '../state/state-store.js';
import type { IOutcomeRecordReceipt } from './outcome-intelligence-contract.js';

export interface IRecordOutcomeAssessmentOptions {
  events: IRuntimeEventBus;
  runtimeId: string;

  now?: () => string;
}

export const recordOutcomeAssessment = async (
  value: unknown,
  options: Readonly<IRecordOutcomeAssessmentOptions>,
): Promise<Readonly<IOutcomeRecordReceipt>> => {
  const assessment = assessOutcome(value);
  const timestamp = options.now?.() ?? new Date().toISOString();

  try {
    const delivery = await options.events.emit({
      payload: {
        assessment: assessment as unknown as TJsonValue,
      },
      runtimeId: options.runtimeId,
      schemaVersion: RUNTIME_VERSIONS.eventSchema,
      timestamp,
      type: 'outcome.assessed',
    });
    const deliveryFailures = Object.freeze(
      delivery.failures.map(({ message }) => message),
    );

    return Object.freeze({
      assessment,
      deliveredCount: delivery.deliveredCount,
      deliveryFailures,
      status: deliveryFailures.length === 0 ? 'emitted' : 'degraded',
    });
  } catch (error) {
    return Object.freeze({
      assessment,
      deliveredCount: 0,
      deliveryFailures: Object.freeze([
        error instanceof Error ? error.message : String(error),
      ]),
      status: 'dropped',
    });
  }
};
