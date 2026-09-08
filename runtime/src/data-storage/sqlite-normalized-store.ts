import { chmod, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

import { DATA_STORAGE_VERSIONS } from './data-storage-contract.js';

import type { IRuntimeEvent } from '../events/runtime-event.js';
import type { IDataStorageRawRecord } from './data-storage-contract.js';

type TDatabaseSync = import('node:sqlite').DatabaseSync;

const checkIsRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const checkIsCorruptionError = (error: unknown) =>
  error instanceof Error && /corrupt|malformed|not a database/i.test(error.message);

const createCorruptionSuffix = (timestamp: string) =>
  timestamp.replace(/[^0-9A-Za-z-]/g, '-');

const migrateDatabase = (database: TDatabaseSync, appliedAt: string) => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS amy_storage_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const current = database
    .prepare('SELECT MAX(version) AS version FROM amy_storage_migrations')
    .get() as { version?: number | null } | undefined;
  const currentVersion = current?.version ?? 0;

  if (currentVersion > DATA_STORAGE_VERSIONS.sqliteSchema) {
    throw new Error(
      `SQLite schema ${currentVersion} is newer than supported ${DATA_STORAGE_VERSIONS.sqliteSchema}`,
    );
  }

  if (currentVersion === DATA_STORAGE_VERSIONS.sqliteSchema) {
    return;
  }

  database.exec('BEGIN IMMEDIATE');

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS runtime_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        captured_at TEXT NOT NULL,
        event_timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        runtime_id TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_runtime_events_captured_at
        ON runtime_events(captured_at);
      CREATE INDEX IF NOT EXISTS idx_runtime_events_type_timestamp
        ON runtime_events(event_type, event_timestamp);
      CREATE INDEX IF NOT EXISTS idx_runtime_events_runtime_timestamp
        ON runtime_events(runtime_id, event_timestamp);

      CREATE TABLE IF NOT EXISTS observability_records (
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

      CREATE INDEX IF NOT EXISTS idx_observability_records_captured_at
        ON observability_records(captured_at);
      CREATE INDEX IF NOT EXISTS idx_observability_records_kind_timestamp
        ON observability_records(kind, record_timestamp);
      CREATE INDEX IF NOT EXISTS idx_observability_records_subject_timestamp
        ON observability_records(subject_kind, subject_id, record_timestamp);
      CREATE INDEX IF NOT EXISTS idx_observability_records_record_id
        ON observability_records(record_id);
    `);
    database
      .prepare(
        'INSERT INTO amy_storage_migrations(version, applied_at) VALUES (?, ?)',
      )
      .run(DATA_STORAGE_VERSIONS.sqliteSchema, appliedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
};

const configureDatabase = (
  database: TDatabaseSync,
  appliedAt: string,
) => {
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA busy_timeout = 5000');
  database.exec('PRAGMA synchronous = NORMAL');
  migrateDatabase(database, appliedAt);
};

const getObservabilityRecord = (event: Readonly<IRuntimeEvent>) => {
  if (event.type !== 'observability.recorded') {
    return undefined;
  }

  const record = event.payload.record;

  if (!checkIsRecord(record)) {
    return undefined;
  }

  const subject = record.subject;

  if (
    typeof record.recordId !== 'string' ||
    typeof record.kind !== 'string' ||
    typeof record.timestamp !== 'string' ||
    !checkIsRecord(subject) ||
    typeof subject.kind !== 'string' ||
    typeof subject.id !== 'string'
  ) {
    return undefined;
  }

  return {
    decisionKind:
      typeof record.decisionKind === 'string' ? record.decisionKind : null,
    kind: record.kind,
    recordId: record.recordId,
    recordTimestamp: record.timestamp,
    subjectId: subject.id,
    subjectKind: subject.kind,
    telemetryEvent: typeof record.event === 'string' ? record.event : null,
  };
};

export class SqliteNormalizedStore {
  readonly #databasePath: string;
  readonly #now: () => string;

  constructor(databasePath: string, now: () => string) {
    this.#databasePath = databasePath;
    this.#now = now;
  }

  async capture(record: Readonly<IDataStorageRawRecord>): Promise<void> {
    await this.#withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        database
          .prepare(`
            INSERT INTO runtime_events(
              captured_at,
              event_timestamp,
              event_type,
              runtime_id,
              payload_json
            ) VALUES (?, ?, ?, ?, ?)
          `)
          .run(
            record.capturedAt,
            record.event.timestamp,
            record.event.type,
            record.event.runtimeId,
            JSON.stringify(record.event.payload),
          );

        const observability = getObservabilityRecord(record.event);

        if (observability) {
          database
            .prepare(`
              INSERT INTO observability_records(
                captured_at,
                record_timestamp,
                record_id,
                kind,
                subject_kind,
                subject_id,
                decision_kind,
                telemetry_event,
                record_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .run(
              record.capturedAt,
              observability.recordTimestamp,
              observability.recordId,
              observability.kind,
              observability.subjectKind,
              observability.subjectId,
              observability.decisionKind,
              observability.telemetryEvent,
              JSON.stringify(record.event.payload.record),
            );
        }

        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });
  }

  async cleanup(before: string): Promise<number> {
    return this.#withDatabase((database) => {
      database.exec('BEGIN IMMEDIATE');

      try {
        const observabilityChanges = Number(
          database
            .prepare('DELETE FROM observability_records WHERE captured_at < ?')
            .run(before).changes,
        );
        const runtimeChanges = Number(
          database
            .prepare('DELETE FROM runtime_events WHERE captured_at < ?')
            .run(before).changes,
        );

        database.exec('COMMIT');

        return observabilityChanges + runtimeChanges;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });
  }

  async #withDatabase<TValue>(
    operation: (database: TDatabaseSync) => TValue,
    hasRecovered = false,
  ): Promise<TValue> {
    await mkdir(dirname(this.#databasePath), { mode: 0o700, recursive: true });

    let database: TDatabaseSync | undefined;

    try {
      const { DatabaseSync } = await import('node:sqlite');
      database = new DatabaseSync(this.#databasePath);
      configureDatabase(database, this.#now());
      const result = operation(database);

      database.close();
      database = undefined;
      await chmod(this.#databasePath, 0o600).catch(() => undefined);

      return result;
    } catch (error) {
      if (database) {
        try {
          database.close();
        } catch {
          // Best effort only; the original storage failure remains authoritative.
        }
      }

      if (!hasRecovered && checkIsCorruptionError(error)) {
        const quarantinePath = `${this.#databasePath}.corrupt-${createCorruptionSuffix(this.#now())}`;

        await rename(this.#databasePath, quarantinePath);

        return this.#withDatabase(operation, true);
      }

      throw error;
    }
  }
}
