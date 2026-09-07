import { CapabilityRegistry } from '../capabilities/capability-registry.js';
import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { RUNTIME_VERSIONS } from '../versions.js';

import type { IAmyRuntimeConfig } from '../config/runtime-config.js';
import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { TCapabilityResolution } from '../capabilities/capability-resolution.js';
import type { IRuntimeEventBus } from '../events/runtime-event.js';
import type { IStateStore } from '../state/state-store.js';

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
