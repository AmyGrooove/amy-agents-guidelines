import assert from 'node:assert/strict';
import { appendFile, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, it } from 'node:test';

import {
  DATA_STORAGE_VERSIONS,
  RuntimeEventBus,
  createDataStorageCapability,
  createDataStorageEventConsumer,
} from '../dist/index.js';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'amy-data-storage-'));

  temporaryDirectories.push(directory);

  return directory;
};

const createObservabilityEvent = (timestamp: string) => ({
  payload: {
    record: {
      decision: 'execution=direct',
      decisionKind: 'strategy',
      evidenceRefs: ['artifact:task-1'],
      explanation: 'authorization=Bearer secret-token',
      kind: 'decision',
      policy: { owner: 'strategy-routing', version: 1 },
      reasonCodes: ['fast-path'],
      recordId: 'decision:strategy:task-1',
      schemaVersion: 1,
      subject: { id: 'task-1', kind: 'task' },
      timestamp,
    },
  },
  runtimeId: 'runtime-stage-14',
  schemaVersion: 1,
  timestamp,
  type: 'observability.recorded',
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe('DataStorage', () => {
  it('stores sanitized raw JSONL and normalized SQLite records through an optional capability', async () => {
    const rootDirectory = await createTemporaryDirectory();
    const capability = createDataStorageCapability({
      now: () => '2026-09-08T09:00:00.000Z',
      rootDirectory,
    });

    assert.deepEqual(DATA_STORAGE_VERSIONS, {
      api: 1,
      policy: 1,
      rawRecordSchema: 1,
      sqliteSchema: 2,
    });
    assert.equal(capability.descriptor.id, 'amy.data-storage');
    assert.equal(capability.descriptor.version, '1.1.0');

    const receipt = await capability.api.capture(
      createObservabilityEvent('2026-09-08T08:59:59.000Z'),
    );

    assert.deepEqual(receipt, {
      failures: [],
      normalized: 'stored',
      raw: 'stored',
      status: 'stored',
    });

    const rawFiles = await readdir(join(rootDirectory, 'raw'));
    assert.deepEqual(rawFiles, ['2026-09-08.jsonl']);
    const rawLine = JSON.parse(
      (await readFile(join(rootDirectory, 'raw', rawFiles[0]!), 'utf8')).trim(),
    );

    assert.equal(rawLine.schemaVersion, 1);
    assert.equal(rawLine.capturedAt, '2026-09-08T09:00:00.000Z');
    assert.equal(
      rawLine.event.payload.record.explanation,
      'authorization=Bearer [redacted]',
    );

    const database = new DatabaseSync(join(rootDirectory, 'amy.sqlite'));
    const migrations = database.prepare('SELECT version FROM amy_storage_migrations ORDER BY version').all() as { version: number }[];
    const eventRow = database.prepare(
      'SELECT event_type, runtime_id, payload_json FROM runtime_events',
    ).get() as Record<string, unknown>;
    const observabilityRow = database.prepare(
      'SELECT record_id, kind, decision_kind, subject_kind, subject_id FROM observability_records',
    ).get() as Record<string, unknown>;

    assert.deepEqual(migrations.map(({ version }) => version), [1, 2]);
    assert.equal(eventRow.event_type, 'observability.recorded');
    assert.equal(eventRow.runtime_id, 'runtime-stage-14');
    assert.match(String(eventRow.payload_json), /Bearer \[redacted\]/);
    assert.deepEqual({ ...observabilityRow }, {
      decision_kind: 'strategy',
      kind: 'decision',
      record_id: 'decision:strategy:task-1',
      subject_id: 'task-1',
      subject_kind: 'task',
    });
    database.close();
  });

  it('upgrades an existing Stage 14 SQLite schema without losing normalized records', async () => {
    const rootDirectory = await createTemporaryDirectory();
    const databasePath = join(rootDirectory, 'amy.sqlite');
    const legacy = new DatabaseSync(databasePath);
    legacy.exec(`
      CREATE TABLE amy_storage_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      INSERT INTO amy_storage_migrations(version, applied_at)
      VALUES (1, '2026-09-08T08:00:00.000Z');

      CREATE TABLE runtime_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        captured_at TEXT NOT NULL,
        event_timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        runtime_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE observability_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        captured_at TEXT NOT NULL,
        record_timestamp TEXT NOT NULL,
        record_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        subject_kind TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        decision_kind TEXT,
        telemetry_event TEXT,
        record_json TEXT NOT NULL
      );
      INSERT INTO runtime_events(
        captured_at,
        event_timestamp,
        event_type,
        runtime_id,
        payload_json
      ) VALUES (
        '2026-09-08T08:00:00.000Z',
        '2026-09-08T08:00:00.000Z',
        'runtime.started',
        'runtime-stage-14',
        '{}'
      );
    `);
    legacy.close();

    const capability = createDataStorageCapability({
      now: () => '2026-09-08T09:05:00.000Z',
      rootDirectory,
    });
    const receipt = await capability.api.capture({
      payload: {},
      runtimeId: 'runtime-stage-15',
      schemaVersion: 1,
      timestamp: '2026-09-08T09:05:00.000Z',
      type: 'runtime.started',
    });

    assert.equal(receipt.status, 'stored');
    const upgraded = new DatabaseSync(databasePath);
    const migrations = upgraded.prepare(
      'SELECT version FROM amy_storage_migrations ORDER BY version',
    ).all() as { version: number }[];
    const tables = upgraded.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN ('outcomes', 'failures')
      ORDER BY name
    `).all() as { name: string }[];
    const runtimeCount = upgraded.prepare(
      'SELECT COUNT(*) AS count FROM runtime_events',
    ).get() as { count: number };

    assert.deepEqual(migrations.map(({ version }) => version), [1, 2]);
    assert.deepEqual(tables.map(({ name }) => name), ['failures', 'outcomes']);
    assert.equal(runtimeCount.count, 2);
    upgraded.close();
  });

  it('omits raw content by default and stores only redacted raw content after explicit opt-in', async () => {
    const defaultRoot = await createTemporaryDirectory();
    const optedInRoot = await createTemporaryDirectory();
    const event = {
      payload: {
        apiKey: 'top-secret',
        envPath: '/repo/.env.local',
        prompt: 'Use token=abc123 to inspect the request',
        safe: 'keep-me',
        toolPayload: { authorization: 'Bearer tool-secret', safe: 'hidden-raw' },
      },
      runtimeId: 'runtime-privacy',
      schemaVersion: 1,
      timestamp: '2026-09-08T09:10:00.000Z',
      type: 'runtime.started',
    };

    const defaultStorage = createDataStorageCapability({
      now: () => '2026-09-08T09:10:01.000Z',
      rootDirectory: defaultRoot,
      sqlite: 'disabled',
    });
    await defaultStorage.api.capture(event);

    const defaultLine = JSON.parse(
      (await readFile(join(defaultRoot, 'raw', '2026-09-08.jsonl'), 'utf8')).trim(),
    );
    assert.deepEqual(defaultLine.event.payload, {
      apiKey: '[redacted]',
      envPath: '[redacted:.env-path]',
      prompt: '[raw-content-omitted]',
      safe: 'keep-me',
      toolPayload: '[raw-content-omitted]',
    });

    const optedInStorage = createDataStorageCapability({
      now: () => '2026-09-08T09:10:01.000Z',
      privacy: { rawContent: 'redacted' },
      rootDirectory: optedInRoot,
      sqlite: 'disabled',
    });
    await optedInStorage.api.capture(event);

    const optedInLine = JSON.parse(
      (await readFile(join(optedInRoot, 'raw', '2026-09-08.jsonl'), 'utf8')).trim(),
    );
    assert.deepEqual(optedInLine.event.payload, {
      apiKey: '[redacted]',
      envPath: '[redacted:.env-path]',
      prompt: 'Use token=[redacted] to inspect the request',
      safe: 'keep-me',
      toolPayload: { authorization: '[redacted]', safe: 'hidden-raw' },
    });
  });

  it('subscribes to the canonical Runtime event boundary without turning storage failures into workflow failures', async () => {
    const invalidRoot = await createTemporaryDirectory();
    const blockingFile = join(invalidRoot, 'not-a-directory');
    await writeFile(blockingFile, 'block', 'utf8');

    const capability = createDataStorageCapability({
      rootDirectory: blockingFile,
    });
    const bus = new RuntimeEventBus();
    bus.subscribe(createDataStorageEventConsumer(capability.api));

    const delivery = await bus.emit({
      payload: {},
      runtimeId: 'runtime-fail-open',
      schemaVersion: 1,
      timestamp: '2026-09-08T09:20:00.000Z',
      type: 'runtime.started',
    });

    assert.equal(delivery.deliveredCount, 0);
    assert.equal(delivery.failures.length, 1);
    assert.match(delivery.failures[0]!.message, /Data storage capture/);
    const receipt = await capability.api.capture({
      payload: {},
      runtimeId: 'runtime-fail-open',
      schemaVersion: 1,
      timestamp: '2026-09-08T09:20:00.000Z',
      type: 'runtime.started',
    });
    assert.equal(receipt.status, 'dropped');
    assert.equal(receipt.raw, 'failed');
    assert.equal(receipt.normalized, 'failed');
    assert.ok(receipt.failures.length >= 1);
  });

  it('exports bounded sanitized raw data while reporting corrupt JSONL lines', async () => {
    const rootDirectory = await createTemporaryDirectory();
    let currentTime = '2026-09-08T09:30:00.000Z';
    const capability = createDataStorageCapability({
      now: () => currentTime,
      rootDirectory,
      sqlite: 'disabled',
    });

    await capability.api.capture({
      payload: { value: 'first' },
      runtimeId: 'runtime-export',
      schemaVersion: 1,
      timestamp: currentTime,
      type: 'runtime.started',
    });
    currentTime = '2026-09-08T09:31:00.000Z';
    await capability.api.capture({
      payload: { value: 'second' },
      runtimeId: 'runtime-export',
      schemaVersion: 1,
      timestamp: currentTime,
      type: 'runtime.stopped',
    });
    await appendFile(join(rootDirectory, 'raw', '2026-09-08.jsonl'), '{\"schemaVersion\":1,\"capturedAt\":\"2026-09-08T09:32:00.000Z\",\"event\":{}}\n{broken\n', 'utf8');

    const exported = await capability.api.exportData({ limit: 1 });

    assert.equal(exported.schemaVersion, 1);
    assert.equal(exported.records.length, 1);
    assert.equal(exported.records[0]!.event.type, 'runtime.stopped');
    assert.equal(exported.truncated, true);
    assert.equal(exported.corruptLineCount, 2);
  });

  it('quarantines a corrupt SQLite database and recreates normalized storage without losing raw capture', async () => {
    const rootDirectory = await createTemporaryDirectory();
    await writeFile(join(rootDirectory, 'amy.sqlite'), 'not-a-sqlite-database', 'utf8');
    const capability = createDataStorageCapability({
      now: () => '2026-09-08T10:00:00.000Z',
      rootDirectory,
    });

    const receipt = await capability.api.capture({
      payload: { safe: 'value' },
      runtimeId: 'runtime-corruption',
      schemaVersion: 1,
      timestamp: '2026-09-08T10:00:00.000Z',
      type: 'runtime.started',
    });

    assert.equal(receipt.status, 'stored');
    assert.equal(receipt.raw, 'stored');
    assert.equal(receipt.normalized, 'stored');
    assert.ok((await readdir(rootDirectory)).some((name) => name.startsWith('amy.sqlite.corrupt-')));

    const database = new DatabaseSync(join(rootDirectory, 'amy.sqlite'));
    assert.equal((database.prepare('SELECT COUNT(*) AS count FROM runtime_events').get() as { count: number }).count, 1);
    database.close();
  });

  it('serializes concurrent raw and SQLite writes without dropping records', async () => {
    const rootDirectory = await createTemporaryDirectory();
    const capability = createDataStorageCapability({
      now: () => '2026-09-08T10:10:00.000Z',
      rootDirectory,
    });

    const receipts = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        capability.api.capture({
          payload: { index },
          runtimeId: 'runtime-concurrent',
          schemaVersion: 1,
          timestamp: `2026-09-08T10:10:${String(index).padStart(2, '0')}.000Z`,
          type: 'runtime.started',
        }),
      ),
    );

    assert.equal(receipts.every(({ status }) => status === 'stored'), true);
    const rawLines = (await readFile(join(rootDirectory, 'raw', '2026-09-08.jsonl'), 'utf8'))
      .trim()
      .split('\n');
    assert.equal(rawLines.length, 20);

    const database = new DatabaseSync(join(rootDirectory, 'amy.sqlite'));
    assert.equal((database.prepare('SELECT COUNT(*) AS count FROM runtime_events').get() as { count: number }).count, 20);
    database.close();
  });

  it('applies retention to append-only day segments and normalized rows without rewriting live raw files', async () => {
    const rootDirectory = await createTemporaryDirectory();
    let currentTime = '2026-07-01T12:00:00.000Z';
    const capability = createDataStorageCapability({
      now: () => currentTime,
      retentionDays: 30,
      rootDirectory,
    });

    await capability.api.capture(createObservabilityEvent(currentTime));
    currentTime = '2026-09-08T12:00:00.000Z';
    await capability.api.capture({
      ...createObservabilityEvent(currentTime),
      payload: {
        record: {
          ...createObservabilityEvent(currentTime).payload.record,
          recordId: 'decision:strategy:task-2',
          subject: { id: 'task-2', kind: 'task' },
        },
      },
    });

    const cleanup = await capability.api.cleanup();

    assert.equal(cleanup.status, 'completed');
    assert.deepEqual(cleanup.removedRawFiles, ['2026-07-01.jsonl']);
    assert.equal(cleanup.removedNormalizedRecords, 2);
    assert.deepEqual(await readdir(join(rootDirectory, 'raw')), ['2026-09-08.jsonl']);

    const database = new DatabaseSync(join(rootDirectory, 'amy.sqlite'));
    assert.equal((database.prepare('SELECT COUNT(*) AS count FROM runtime_events').get() as { count: number }).count, 1);
    assert.equal((database.prepare('SELECT COUNT(*) AS count FROM observability_records').get() as { count: number }).count, 1);
    database.close();
  });
});
