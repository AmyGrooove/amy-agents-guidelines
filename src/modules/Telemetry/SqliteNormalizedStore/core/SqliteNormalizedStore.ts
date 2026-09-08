import { isRecord } from '#shared/functions/checks/isRecord';

import { chmod, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

import { DATA_STORAGE_VERSIONS } from '../../types/dataStorageContract.js';

import type { IRuntimeEvent } from '#entities/runtime';
import type { IDataStorageRawRecord } from '../../types/dataStorageContract.js';

type TDatabaseSync = import('node:sqlite').DatabaseSync;

type TNormalizedOutcomeFailure = Readonly<{
  evidenceRefs: readonly string[];
  failureClass: string;
  failureId: string;
  source: string;
  summary: string;
  value: Readonly<Record<string, unknown>>;
}>;

type TNormalizedOutcome = Readonly<{
  confidence: string;
  escalationCount: number;
  failures: readonly TNormalizedOutcomeFailure[];
  outcomeId: string;
  retryCount: number;
  status: string;
  taskId: string;
  value: Readonly<Record<string, unknown>>;
}>;


const checkIsCorruptionError = (error: unknown) =>
  error instanceof Error && /corrupt|malformed|not a database/i.test(error.message);

const createCorruptionSuffix = (timestamp: string) =>
  timestamp.replace(/[^0-9A-Za-z-]/g, '-');

const MIGRATION_SQL = Object.freeze({
  1: `
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
  `,
  2: `
    CREATE TABLE IF NOT EXISTS outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      captured_at TEXT NOT NULL,
      assessed_at TEXT NOT NULL,
      outcome_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      status TEXT NOT NULL,
      confidence TEXT NOT NULL,
      retry_count INTEGER NOT NULL,
      escalation_count INTEGER NOT NULL,
      assessment_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_outcomes_captured_at
      ON outcomes(captured_at);
    CREATE INDEX IF NOT EXISTS idx_outcomes_outcome_id
      ON outcomes(outcome_id);
    CREATE INDEX IF NOT EXISTS idx_outcomes_task_assessed_at
      ON outcomes(task_id, assessed_at);
    CREATE INDEX IF NOT EXISTS idx_outcomes_status_assessed_at
      ON outcomes(status, assessed_at);

    CREATE TABLE IF NOT EXISTS failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      captured_at TEXT NOT NULL,
      assessed_at TEXT NOT NULL,
      outcome_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      failure_id TEXT NOT NULL,
      failure_class TEXT NOT NULL,
      source TEXT NOT NULL,
      summary TEXT NOT NULL,
      evidence_refs_json TEXT NOT NULL,
      failure_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_failures_captured_at
      ON failures(captured_at);
    CREATE INDEX IF NOT EXISTS idx_failures_outcome_id
      ON failures(outcome_id);
    CREATE INDEX IF NOT EXISTS idx_failures_task_class_assessed_at
      ON failures(task_id, failure_class, assessed_at);
    CREATE INDEX IF NOT EXISTS idx_failures_class_assessed_at
      ON failures(failure_class, assessed_at);
  `,
});

const applyMigration = (
  database: TDatabaseSync,
  version: 1 | 2,
  appliedAt: string,
) => {
  database.exec('BEGIN IMMEDIATE');

  try {
    database.exec(MIGRATION_SQL[version]);
    database
      .prepare(
        'INSERT INTO amy_storage_migrations(version, applied_at) VALUES (?, ?)',
      )
      .run(version, appliedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
};

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

  if (currentVersion < 1) {
    applyMigration(database, 1, appliedAt);
  }
  if (currentVersion < 2) {
    applyMigration(database, 2, appliedAt);
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

  if (!isRecord(record)) {
    return undefined;
  }

  const subject = record.subject;

  if (
    typeof record.recordId !== 'string' ||
    typeof record.kind !== 'string' ||
    typeof record.timestamp !== 'string' ||
    !isRecord(subject) ||
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

const getOutcomeFailure = (
  value: unknown,
): Readonly<TNormalizedOutcomeFailure> | undefined => {
  if (!isRecord(value)) return undefined;

  if (
    value.kind !== 'failure-intelligence' ||
    typeof value.failureId !== 'string' ||
    typeof value.failureClass !== 'string' ||
    typeof value.source !== 'string' ||
    typeof value.summary !== 'string' ||
    !Array.isArray(value.evidenceRefs) ||
    !value.evidenceRefs.every((ref) => typeof ref === 'string')
  ) {
    return undefined;
  }

  return Object.freeze({
    evidenceRefs: Object.freeze([...value.evidenceRefs] as string[]),
    failureClass: value.failureClass,
    failureId: value.failureId,
    source: value.source,
    summary: value.summary,
    value,
  });
};

const getOutcomeAssessment = (
  event: Readonly<IRuntimeEvent>,
): Readonly<TNormalizedOutcome> | undefined => {
  if (event.type !== 'outcome.assessed') return undefined;

  const assessment = event.payload.assessment;

  if (!isRecord(assessment) || !isRecord(assessment.attempts)) {
    return undefined;
  }
  if (
    assessment.kind !== 'outcome-assessment' ||
    typeof assessment.outcomeId !== 'string' ||
    typeof assessment.taskId !== 'string' ||
    typeof assessment.status !== 'string' ||
    typeof assessment.confidence !== 'string' ||
    !Number.isSafeInteger(assessment.attempts.retryCount) ||
    !Number.isSafeInteger(assessment.attempts.escalationCount) ||
    !Array.isArray(assessment.failures)
  ) {
    return undefined;
  }

  const failures = assessment.failures.map(getOutcomeFailure);

  if (failures.some((failure) => failure === undefined)) {
    return undefined;
  }

  return Object.freeze({
    confidence: assessment.confidence,
    escalationCount: assessment.attempts.escalationCount as number,
    failures: Object.freeze(failures as readonly TNormalizedOutcomeFailure[]),
    outcomeId: assessment.outcomeId,
    retryCount: assessment.attempts.retryCount as number,
    status: assessment.status,
    taskId: assessment.taskId,
    value: assessment,
  });
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

        const outcome = getOutcomeAssessment(record.event);

        if (outcome) {
          database
            .prepare(`
              INSERT INTO outcomes(
                captured_at,
                assessed_at,
                outcome_id,
                task_id,
                status,
                confidence,
                retry_count,
                escalation_count,
                assessment_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .run(
              record.capturedAt,
              record.event.timestamp,
              outcome.outcomeId,
              outcome.taskId,
              outcome.status,
              outcome.confidence,
              outcome.retryCount,
              outcome.escalationCount,
              JSON.stringify(outcome.value),
            );

          const insertFailure = database.prepare(`
            INSERT INTO failures(
              captured_at,
              assessed_at,
              outcome_id,
              task_id,
              failure_id,
              failure_class,
              source,
              summary,
              evidence_refs_json,
              failure_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const failure of outcome.failures) {
            insertFailure.run(
              record.capturedAt,
              record.event.timestamp,
              outcome.outcomeId,
              outcome.taskId,
              failure.failureId,
              failure.failureClass,
              failure.source,
              failure.summary,
              JSON.stringify(failure.evidenceRefs),
              JSON.stringify(failure.value),
            );
          }
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
        const failureChanges = Number(
          database
            .prepare('DELETE FROM failures WHERE captured_at < ?')
            .run(before).changes,
        );
        const outcomeChanges = Number(
          database
            .prepare('DELETE FROM outcomes WHERE captured_at < ?')
            .run(before).changes,
        );
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

        return failureChanges + outcomeChanges + observabilityChanges + runtimeChanges;
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
