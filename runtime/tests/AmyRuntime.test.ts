import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import {
  AmyRuntimeError,
  MemoryStateStore,
  RuntimeEventBus,
  createAmyRuntime,
} from '../dist/index.js';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'amy-runtime-'));

  temporaryDirectories.push(directory);

  return directory;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe('AmyRuntime', () => {
  it('создаётся с минимальной конфигурацией и in-memory state', async () => {
    const projectRoot = await createTemporaryDirectory();
    const homeDirectory = await createTemporaryDirectory();
    const runtime = await createAmyRuntime({ homeDirectory, projectRoot });

    assert.equal(runtime.getStatus().lifecycle, 'created');
    assert.deepEqual(runtime.config.capabilities, {});
    assert.equal(runtime.state instanceof MemoryStateStore, true);
  });

  it('отправляет lifecycle events ровно один раз', async () => {
    const projectRoot = await createTemporaryDirectory();
    const homeDirectory = await createTemporaryDirectory();
    const runtime = await createAmyRuntime({
      homeDirectory,
      projectRoot,
      runtimeId: 'runtime-1',
    });
    const receivedTypes: string[] = [];

    runtime.events.subscribe((event) => {
      receivedTypes.push(event.type);
    });

    await runtime.start();
    await runtime.start();
    await runtime.stop();
    await runtime.stop();

    assert.deepEqual(receivedTypes, ['runtime.started', 'runtime.stopped']);
    assert.equal(runtime.getStatus().lifecycle, 'stopped');
  });

  it('не запускается повторно после остановки', async () => {
    const projectRoot = await createTemporaryDirectory();
    const homeDirectory = await createTemporaryDirectory();
    const runtime = await createAmyRuntime({ homeDirectory, projectRoot });

    await runtime.start();
    await runtime.stop();

    await assert.rejects(
      runtime.start(),
      (error: unknown) =>
        error instanceof AmyRuntimeError && error.code === 'VALIDATION_FAILURE',
    );
  });

  it('проверяет required capability во время запуска', async () => {
    const projectRoot = await createTemporaryDirectory();
    const homeDirectory = await createTemporaryDirectory();
    const runtime = await createAmyRuntime({
      homeDirectory,
      overrides: {
        capabilities: { analytics: { required: true } },
      },
      projectRoot,
    });

    await assert.rejects(
      runtime.start(),
      (error: unknown) =>
        error instanceof AmyRuntimeError &&
        error.code === 'CAPABILITY_UNAVAILABLE',
    );
  });

  it('использует явно переданные state и event ports', async () => {
    const projectRoot = await createTemporaryDirectory();
    const homeDirectory = await createTemporaryDirectory();
    const state = new MemoryStateStore();
    const events = new RuntimeEventBus();
    const runtime = await createAmyRuntime({
      events,
      homeDirectory,
      projectRoot,
      state,
    });

    assert.equal(runtime.state, state);
    assert.equal(runtime.events, events);
  });

  it('отправляет события разрешения capability без управления workflow', async () => {
    const projectRoot = await createTemporaryDirectory();
    const homeDirectory = await createTemporaryDirectory();
    const runtime = await createAmyRuntime({
      capabilities: [
        {
          api: {},
          descriptor: {
            capabilityContract: 1,
            id: 'quality',
            runtimeApi: 1,
            version: '1.0.0',
          },
        },
      ],
      homeDirectory,
      projectRoot,
      runtimeId: 'runtime-1',
    });
    const receivedTypes: string[] = [];

    runtime.events.subscribe((event) => {
      receivedTypes.push(event.type);
    });
    await runtime.start();
    await runtime.resolveOptional('quality');
    await runtime.resolveOptional('missing');

    assert.deepEqual(receivedTypes, [
      'runtime.started',
      'capability.resolved',
      'capability.failed',
    ]);
  });
});
