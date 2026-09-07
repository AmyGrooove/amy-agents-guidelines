import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MemoryStateStore,
  RuntimeEventBus,
} from '../dist/index.js';

describe('StateAndEvents', () => {
  it('хранит изолированные копии versioned state по namespace', async () => {
    const state = new MemoryStateStore();
    const value = { count: 1, nested: ['a'] };

    await state.set({ key: 'status', namespace: 'quality', value });
    value.count = 2;

    const qualityRecord = await state.get({
      key: 'status',
      namespace: 'quality',
    });
    const analyticsRecord = await state.get({
      key: 'status',
      namespace: 'analytics',
    });

    assert.equal(qualityRecord?.schemaVersion, 1);
    assert.deepEqual(qualityRecord?.value, { count: 1, nested: ['a'] });
    assert.equal(analyticsRecord, undefined);
  });

  it('удаляет отдельную запись и очищает namespace', async () => {
    const state = new MemoryStateStore();

    await state.set({ key: 'first', namespace: 'quality', value: true });
    await state.set({ key: 'second', namespace: 'quality', value: false });
    await state.delete({ key: 'first', namespace: 'quality' });

    assert.equal(
      await state.get({ key: 'first', namespace: 'quality' }),
      undefined,
    );

    await state.clear('quality');

    assert.equal(
      await state.get({ key: 'second', namespace: 'quality' }),
      undefined,
    );
  });

  it('доставляет lifecycle event подписчику', async () => {
    const events = new RuntimeEventBus();
    const receivedTypes: string[] = [];

    events.subscribe((event) => {
      receivedTypes.push(event.type);
    });

    const result = await events.emit({
      payload: {},
      runtimeId: 'runtime-1',
      schemaVersion: 1,
      timestamp: '2026-09-07T00:00:00.000Z',
      type: 'runtime.started',
    });

    assert.deepEqual(receivedTypes, ['runtime.started']);
    assert.deepEqual(result, { deliveredCount: 1, failures: [] });
  });

  it('не ломает выполнение без consumers и изолирует их ошибки', async () => {
    const emptyEvents = new RuntimeEventBus();
    const emptyResult = await emptyEvents.emit({
      payload: {},
      runtimeId: 'runtime-1',
      schemaVersion: 1,
      timestamp: '2026-09-07T00:00:00.000Z',
      type: 'runtime.started',
    });

    assert.deepEqual(emptyResult, { deliveredCount: 0, failures: [] });

    const events = new RuntimeEventBus();
    const receivedTypes: string[] = [];

    events.subscribe(() => {
      throw new Error('observer failed');
    });
    events.subscribe((event) => {
      receivedTypes.push(event.type);
    });

    const result = await events.emit({
      payload: {},
      runtimeId: 'runtime-1',
      schemaVersion: 1,
      timestamp: '2026-09-07T00:00:00.000Z',
      type: 'runtime.started',
    });

    assert.deepEqual(receivedTypes, ['runtime.started']);
    assert.equal(result.deliveredCount, 1);
    assert.deepEqual(result.failures, [
      { consumerIndex: 0, message: 'observer failed' },
    ]);
  });
});
