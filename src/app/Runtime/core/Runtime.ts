import { CapabilityRegistry } from '../CapabilityRegistry/core/CapabilityRegistry.js';
import { AmyRuntimeError } from '#entities/runtime';
import { RUNTIME_VERSIONS } from '#entities/runtime';

import type { IAmyRuntimeConfig } from '#entities/runtime';
import type { IAmyCapability } from '#entities/runtime';
import type { TCapabilityResolution } from '#entities/runtime';
import type { IRuntimeEventBus } from '#entities/runtime';
import type { IStateStore } from '#entities/runtime';

export type TRuntimeLifecycle = 'created' | 'started' | 'stopped';

export interface IAmyRuntimeStatus {
  lifecycle: TRuntimeLifecycle;
  runtimeId: string;
}

export interface IAmyRuntimeProps {
  capabilities: CapabilityRegistry;
  config: Readonly<IAmyRuntimeConfig>;
  events: IRuntimeEventBus;
  runtimeId: string;
  state: IStateStore;
}

export class AmyRuntime {
  readonly capabilities: CapabilityRegistry;
  readonly config: Readonly<IAmyRuntimeConfig>;
  readonly events: IRuntimeEventBus;
  readonly state: IStateStore;

  readonly #runtimeId: string;
  #lifecycle: TRuntimeLifecycle = 'created';

  constructor(props: IAmyRuntimeProps) {
    this.capabilities = props.capabilities;
    this.config = props.config;
    this.events = props.events;
    this.state = props.state;
    this.#runtimeId = props.runtimeId;
  }

  getStatus(): Readonly<IAmyRuntimeStatus> {
    return Object.freeze({
      lifecycle: this.#lifecycle,
      runtimeId: this.#runtimeId,
    });
  }

  async resolveOptional(id: string): Promise<TCapabilityResolution> {
    const resolution = await this.capabilities.resolveOptional(id);
    const isAvailable = resolution.status === 'available';

    await this.events.emit({
      payload: { capabilityId: id, status: resolution.status },
      runtimeId: this.#runtimeId,
      schemaVersion: RUNTIME_VERSIONS.eventSchema,
      timestamp: new Date().toISOString(),
      type: isAvailable ? 'capability.resolved' : 'capability.failed',
    });

    return resolution;
  }

  async resolveRequired(id: string): Promise<IAmyCapability> {
    const resolution = await this.resolveOptional(id);

    if (resolution.status !== 'available') {
      throw new AmyRuntimeError({
        code: 'CAPABILITY_UNAVAILABLE',
        details: { capabilityId: id, status: resolution.status },
        message: `Required capability ${id} is ${resolution.status}`,
      });
    }

    return resolution.capability;
  }

  async start(): Promise<void> {
    if (this.#lifecycle === 'started') {
      return;
    }

    if (this.#lifecycle === 'stopped') {
      throw new AmyRuntimeError({
        code: 'VALIDATION_FAILURE',
        details: { runtimeId: this.#runtimeId },
        message: 'A stopped Runtime cannot be started again',
      });
    }

    this.capabilities.start();
    this.#lifecycle = 'started';
    await this.#emitLifecycleEvent('runtime.started');
  }

  async stop(): Promise<void> {
    if (this.#lifecycle === 'stopped') {
      return;
    }

    this.#lifecycle = 'stopped';
    await this.#emitLifecycleEvent('runtime.stopped');
  }

  async #emitLifecycleEvent(
    type: 'runtime.started' | 'runtime.stopped',
  ): Promise<void> {
    await this.events.emit({
      payload: {},
      runtimeId: this.#runtimeId,
      schemaVersion: RUNTIME_VERSIONS.eventSchema,
      timestamp: new Date().toISOString(),
      type,
    });
  }
}
