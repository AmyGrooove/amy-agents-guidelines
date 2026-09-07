import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AmyRuntimeError,
  CapabilityRegistry,
} from '../dist/index.js';

const createCapability = (
  id: string,
  options: {
    available?: boolean;
    capabilityContract?: number;
    dependencies?: {
      optional?: readonly { id: string; versionMajor: number }[];
      required?: readonly { id: string; versionMajor: number }[];
    };
    runtimeApi?: number;
    version?: string;
  } = {},
) => ({
  api: { id },
  checkAvailability:
    options.available === undefined
      ? undefined
      : async () => options.available ?? false,
  descriptor: {
    capabilityContract: options.capabilityContract ?? 1,
    dependencies: options.dependencies,
    id,
    runtimeApi: options.runtimeApi ?? 1,
    version: options.version ?? '1.0.0',
  },
});

describe('CapabilityRegistry', () => {
  it('регистрирует и обнаруживает доступную capability', async () => {
    const registry = new CapabilityRegistry({ capabilities: {}, schemaVersion: 1 });

    registry.register(createCapability('quality'));
    registry.start();

    const resolution = await registry.resolveOptional('quality');

    assert.equal(resolution.status, 'available');
    assert.equal(resolution.capability?.descriptor.id, 'quality');
    assert.deepEqual(registry.list().map(({ id }) => id), ['quality']);
  });

  it('возвращает явные статусы для отсутствующей, отключённой и недоступной capability', async () => {
    const registry = new CapabilityRegistry({
      capabilities: { analytics: { enabled: false } },
      schemaVersion: 1,
    });

    registry.register(createCapability('analytics'));
    registry.register(createCapability('observer', { available: false }));
    registry.start();

    assert.equal((await registry.resolveOptional('missing')).status, 'missing');
    assert.equal((await registry.resolveOptional('analytics')).status, 'disabled');
    assert.equal((await registry.resolveOptional('observer')).status, 'unavailable');
  });

  it('отклоняет дубликаты и несовместимые capabilities', () => {
    const registry = new CapabilityRegistry({ capabilities: {}, schemaVersion: 1 });

    registry.register(createCapability('quality'));

    assert.throws(
      () => registry.register(createCapability('quality')),
      (error: unknown) =>
        error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
    assert.throws(
      () => registry.register(createCapability('future', { runtimeApi: 2 })),
      (error: unknown) =>
        error instanceof AmyRuntimeError &&
        error.code === 'INCOMPATIBLE_CAPABILITY',
    );
  });

  it('проверяет обязательные capabilities и зависимости при запуске', () => {
    const missingRequired = new CapabilityRegistry({
      capabilities: { analytics: { required: true } },
      schemaVersion: 1,
    });

    assert.throws(
      () => missingRequired.start(),
      (error: unknown) =>
        error instanceof AmyRuntimeError &&
        error.code === 'CAPABILITY_UNAVAILABLE',
    );

    const missingDependency = new CapabilityRegistry({
      capabilities: {},
      schemaVersion: 1,
    });

    missingDependency.register(
      createCapability('quality', {
        dependencies: {
          optional: [{ id: 'observer', versionMajor: 1 }],
          required: [{ id: 'project', versionMajor: 1 }],
        },
      }),
    );

    assert.throws(
      () => missingDependency.start(),
      (error: unknown) =>
        error instanceof AmyRuntimeError &&
        error.code === 'CAPABILITY_UNAVAILABLE',
    );
  });

  it('проверяет major-версию зависимости и допускает отсутствующую optional dependency', () => {
    const registry = new CapabilityRegistry({ capabilities: {}, schemaVersion: 1 });

    registry.register(createCapability('project', { version: '2.0.0' }));
    registry.register(
      createCapability('quality', {
        dependencies: {
          optional: [{ id: 'observer', versionMajor: 1 }],
          required: [{ id: 'project', versionMajor: 1 }],
        },
      }),
    );

    assert.throws(
      () => registry.start(),
      (error: unknown) =>
        error instanceof AmyRuntimeError &&
        error.code === 'INCOMPATIBLE_CAPABILITY',
    );
  });

  it('выбрасывает ошибку required resolution и запрещает регистрацию после запуска', async () => {
    const registry = new CapabilityRegistry({ capabilities: {}, schemaVersion: 1 });

    registry.start();

    await assert.rejects(
      registry.resolveRequired('missing'),
      (error: unknown) =>
        error instanceof AmyRuntimeError &&
        error.code === 'CAPABILITY_UNAVAILABLE',
    );
    assert.throws(
      () => registry.register(createCapability('late')),
      (error: unknown) =>
        error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });

  it('сохраняет immutable snapshot descriptor и dependencies', () => {
    const dependency = { id: 'project', versionMajor: 1 };
    const dependencies = {
      required: [dependency],
    };
    const capability = createCapability('quality', { dependencies });
    const registry = new CapabilityRegistry({ capabilities: {}, schemaVersion: 1 });

    registry.register(createCapability('project'));
    registry.register(capability);
    dependency.versionMajor = 2;
    registry.start();

    const quality = registry.list().find(({ id }) => id === 'quality');

    assert.equal(quality?.dependencies?.required?.[0]?.versionMajor, 1);
    assert.equal(Object.isFrozen(quality?.dependencies?.required?.[0]), true);
  });
});
