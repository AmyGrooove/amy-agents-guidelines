import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { RUNTIME_VERSIONS } from '../versions.js';

import type {
  IEventDeliveryResult,
  IRuntimeEventBus,
  IRuntimeEvent,
  TRuntimeEventConsumer,
} from './runtime-event.js';

export class RuntimeEventBus implements IRuntimeEventBus {
  readonly #consumers = new Set<TRuntimeEventConsumer>();

  subscribe(consumer: TRuntimeEventConsumer): () => void {
    this.#consumers.add(consumer);

    return () => {
      this.#consumers.delete(consumer);
    };
  }

  async emit(event: Readonly<IRuntimeEvent>): Promise<IEventDeliveryResult> {
    if (event.schemaVersion !== RUNTIME_VERSIONS.eventSchema) {
      throw new AmyRuntimeError({
        code: 'VALIDATION_FAILURE',
        details: { schemaVersion: event.schemaVersion },
        message: 'Runtime event schema is incompatible',
      });
    }

    const deliveries = await Promise.all(
      [...this.#consumers].map(async (consumer, consumerIndex) => {
        try {
          await consumer(event);

          return { isDelivered: true } as const;
        } catch (error) {
          return {
            failure: {
              consumerIndex,
              message: error instanceof Error ? error.message : String(error),
            },
            isDelivered: false,
          } as const;
        }
      }),
    );
    const failures = deliveries.flatMap((delivery) =>
      delivery.isDelivered ? [] : [delivery.failure],
    );

    return {
      deliveredCount: deliveries.length - failures.length,
      failures,
    };
  }
}
