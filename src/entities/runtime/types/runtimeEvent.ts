import type { TJsonValue } from './stateStore.js';

export type TRuntimeEventType =
  | 'capability.failed'
  | 'capability.resolved'
  | 'observability.recorded'
  | 'outcome.assessed'
  | 'runtime.started'
  | 'runtime.stopped';

export interface IRuntimeEvent {
  payload: Readonly<Record<string, TJsonValue>>;
  runtimeId: string;
  schemaVersion: number;
  timestamp: string;
  type: TRuntimeEventType;
}

export interface IEventDeliveryFailure {
  consumerIndex: number;
  message: string;
}

export interface IEventDeliveryResult {
  deliveredCount: number;
  failures: readonly IEventDeliveryFailure[];
}

export type TRuntimeEventConsumer = (
  event: Readonly<IRuntimeEvent>,
) => Promise<void> | void;

export interface IRuntimeEventBus {
  emit(event: Readonly<IRuntimeEvent>): Promise<IEventDeliveryResult>;
  subscribe(consumer: TRuntimeEventConsumer): () => void;
}
