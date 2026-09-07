import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { RUNTIME_VERSIONS } from '../versions.js';

import type { IAmyRuntimeConfig } from '../config/runtime-config.js';
import type {
  IAmyCapability,
  ICapabilityDependency,
  ICapabilityDescriptor,
  ICapabilityListItem,
} from './capability-contract.js';
import type { TCapabilityResolution } from './capability-resolution.js';

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const getVersionMajor = (version: string) => {
  const [major] = version.split('.');

  return Number(major);
};

const freezeDescriptor = (
  descriptor: ICapabilityDescriptor,
): Readonly<ICapabilityDescriptor> =>
  Object.freeze({
    ...descriptor,
    ...(descriptor.dependencies
      ? {
          dependencies: Object.freeze({
            optional: Object.freeze([
              ...(descriptor.dependencies.optional ?? []).map((dependency) =>
                Object.freeze({ ...dependency }),
              ),
            ]),
            required: Object.freeze([
              ...(descriptor.dependencies.required ?? []).map((dependency) =>
                Object.freeze({ ...dependency }),
              ),
            ]),
          }),
        }
      : {}),
  });

export class CapabilityRegistry {
  readonly #capabilities = new Map<string, IAmyCapability>();
  readonly #config: Readonly<IAmyRuntimeConfig>;
  #isStarted = false;

  constructor(config: Readonly<IAmyRuntimeConfig>) {
    this.#config = config;
  }

  register(capability: IAmyCapability): void {
    if (this.#isStarted) {
      throw new AmyRuntimeError({
        code: 'VALIDATION_FAILURE',
        message: 'Capabilities cannot be registered after Runtime start',
      });
    }

    this.#validateDescriptor(capability.descriptor);

    if (this.#capabilities.has(capability.descriptor.id)) {
      throw new AmyRuntimeError({
        code: 'VALIDATION_FAILURE',
        details: { capabilityId: capability.descriptor.id },
        message: `Capability ${capability.descriptor.id} is already registered`,
      });
    }

    this.#capabilities.set(capability.descriptor.id, {
      ...capability,
      descriptor: freezeDescriptor(capability.descriptor),
    });
  }

  start(): void {
    if (this.#isStarted) {
      return;
    }

    this.#validateRequiredCapabilities();
    this.#validateDependencies();
    this.#isStarted = true;
  }

  list(): readonly Readonly<ICapabilityListItem>[] {
    return Object.freeze(
      [...this.#capabilities.values()]
        .map(({ descriptor }) =>
          Object.freeze({
            ...descriptor,
            isEnabled: this.#config.capabilities[descriptor.id]?.enabled !== false,
            isRequired:
              this.#config.capabilities[descriptor.id]?.required === true,
          }),
        )
        .sort(({ id: leftId }, { id: rightId }) =>
          leftId.localeCompare(rightId),
        ),
    );
  }

  async resolveOptional(id: string): Promise<TCapabilityResolution> {
    const capability = this.#capabilities.get(id);

    if (!capability) {
      return { status: 'missing' };
    }

    if (this.#config.capabilities[id]?.enabled === false) {
      return { status: 'disabled' };
    }

    if (capability.checkAvailability) {
      try {
        const isAvailable = await capability.checkAvailability();

        if (!isAvailable) {
          return { status: 'unavailable' };
        }
      } catch (cause) {
        throw new AmyRuntimeError({
          cause,
          code: 'CAPABILITY_EXECUTION_FAILURE',
          details: { capabilityId: id },
          message: `Capability ${id} availability check failed`,
        });
      }
    }

    return { capability, status: 'available' };
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

  #validateDescriptor(descriptor: ICapabilityDescriptor): void {
    if (!descriptor.id.trim() || !SEMVER_PATTERN.test(descriptor.version)) {
      throw new AmyRuntimeError({
        code: 'VALIDATION_FAILURE',
        details: { capabilityId: descriptor.id },
        message: 'Capability descriptor is invalid',
      });
    }

    if (
      descriptor.runtimeApi !== RUNTIME_VERSIONS.runtimeApi ||
      descriptor.capabilityContract !== RUNTIME_VERSIONS.capabilityContract
    ) {
      throw new AmyRuntimeError({
        code: 'INCOMPATIBLE_CAPABILITY',
        details: {
          capabilityContract: descriptor.capabilityContract,
          capabilityId: descriptor.id,
          runtimeApi: descriptor.runtimeApi,
        },
        message: `Capability ${descriptor.id} is incompatible with this Runtime`,
      });
    }
  }

  #validateRequiredCapabilities(): void {
    Object.entries(this.#config.capabilities).forEach(([id, config]) => {
      if (config.required !== true) {
        return;
      }

      if (!this.#capabilities.has(id) || config.enabled === false) {
        throw new AmyRuntimeError({
          code: 'CAPABILITY_UNAVAILABLE',
          details: { capabilityId: id },
          message: `Required capability ${id} is not enabled and registered`,
        });
      }
    });
  }

  #validateDependency(
    capabilityId: string,
    dependency: ICapabilityDependency,
  ): void {
    const registeredDependency = this.#capabilities.get(dependency.id);

    if (
      !registeredDependency ||
      this.#config.capabilities[dependency.id]?.enabled === false
    ) {
      throw new AmyRuntimeError({
        code: 'CAPABILITY_UNAVAILABLE',
        details: { capabilityId, dependencyId: dependency.id },
        message: `Capability ${capabilityId} requires ${dependency.id}`,
      });
    }

    if (getVersionMajor(registeredDependency.descriptor.version) !== dependency.versionMajor) {
      throw new AmyRuntimeError({
        code: 'INCOMPATIBLE_CAPABILITY',
        details: { capabilityId, dependencyId: dependency.id },
        message: `Capability ${capabilityId} requires another major version of ${dependency.id}`,
      });
    }
  }

  #validateDependencies(): void {
    this.#capabilities.forEach(({ descriptor }) => {
      if (this.#config.capabilities[descriptor.id]?.enabled === false) {
        return;
      }

      descriptor.dependencies?.required?.forEach((dependency) =>
        this.#validateDependency(descriptor.id, dependency),
      );
    });
  }
}
