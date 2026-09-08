import { appendFile, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import {
  DATA_STORAGE_VERSIONS,
} from '../../types/dataStorageContract.js';
import { sanitizeRuntimeEventForStorage } from '../../functions/sanitizeRuntimeEventForStorage/core/sanitizeRuntimeEventForStorage.js';
import { SqliteNormalizedStore } from '../../SqliteNormalizedStore/core/SqliteNormalizedStore.js';
import {
  validateDataPrivacyPolicy,
  validateExportLimit,
  validateRetentionDays,
  validateRuntimeEventForStorage,
  validateSqliteMode,
} from '../../functions/validateDataStorage/core/validateDataStorage.js';

import type {
  IDataPrivacyPolicy,
  IDataStorageApi,
  IDataStorageCaptureReceipt,
  IDataStorageCleanupReceipt,
  IDataStorageExport,
  IDataStorageExportOptions,
  IDataStorageRawRecord,
  IDataStorageStatus,
  TDataStorageWriteState,
  TSqliteStorageMode,
} from '../../types/dataStorageContract.js';

export interface IFileDataStorageOptions {
  rootDirectory: string;

  now?: () => string;
  privacy?: Readonly<Partial<IDataPrivacyPolicy>>;
  retentionDays?: number;
  sqlite?: TSqliteStorageMode;
}

const getFailureMessage = (prefix: string, error: unknown) =>
  `${prefix}: ${error instanceof Error ? error.message : String(error)}`;

const createRawRecord = (
  value: unknown,
  capturedAt: string,
  privacy: Readonly<IDataPrivacyPolicy>,
): Readonly<IDataStorageRawRecord> => {
  const event = validateRuntimeEventForStorage(value);

  return Object.freeze({
    capturedAt,
    event: sanitizeRuntimeEventForStorage(event, privacy),
    schemaVersion: DATA_STORAGE_VERSIONS.rawRecordSchema,
  });
};

const getCaptureStatus = (
  raw: 'failed' | 'stored',
  normalized: TDataStorageWriteState,
) => {
  const storedCount = Number(raw === 'stored') + Number(normalized === 'stored');
  const failedCount = Number(raw === 'failed') + Number(normalized === 'failed');

  if (storedCount === 0) {
    return 'dropped' as const;
  }

  return failedCount > 0 ? ('degraded' as const) : ('stored' as const);
};

const getCutoffIso = (now: string, retentionDays: number) => {
  const date = new Date(now);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Data storage now() must return an ISO-compatible timestamp');
  }

  date.setUTCDate(date.getUTCDate() - retentionDays);

  return date.toISOString();
};

const checkIsRawRecord = (value: unknown): value is IDataStorageRawRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (
    record.schemaVersion !== DATA_STORAGE_VERSIONS.rawRecordSchema ||
    typeof record.capturedAt !== 'string' ||
    typeof record.event !== 'object' ||
    record.event === null ||
    Array.isArray(record.event)
  ) {
    return false;
  }

  try {
    validateRuntimeEventForStorage(record.event);

    return true;
  } catch {
    return false;
  }
};

export class FileDataStorage implements IDataStorageApi {
  readonly #now: () => string;
  readonly #privacy: Readonly<IDataPrivacyPolicy>;
  readonly #retentionDays: number;
  readonly #rootDirectory: string;
  readonly #sqlite: TSqliteStorageMode;
  readonly #sqliteStore: SqliteNormalizedStore;

  constructor(options: Readonly<IFileDataStorageOptions>) {
    if (!options.rootDirectory.trim()) {
      throw new TypeError('Data storage rootDirectory is required');
    }

    this.#rootDirectory = options.rootDirectory;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#privacy = validateDataPrivacyPolicy(options.privacy);
    this.#retentionDays = validateRetentionDays(options.retentionDays);
    this.#sqlite = validateSqliteMode(options.sqlite);
    this.#sqliteStore = new SqliteNormalizedStore(
      join(this.#rootDirectory, 'amy.sqlite'),
      this.#now,
    );
  }

  async capture(value: unknown): Promise<Readonly<IDataStorageCaptureReceipt>> {
    const record = createRawRecord(value, this.#now(), this.#privacy);
    const failures: string[] = [];
    let raw: 'failed' | 'stored' = 'failed';
    let normalized: TDataStorageWriteState =
      this.#sqlite === 'disabled' ? 'disabled' : 'failed';

    try {
      await this.#appendRawRecord(record);
      raw = 'stored';
    } catch (error) {
      failures.push(getFailureMessage('Raw JSONL storage failed', error));
    }

    if (this.#sqlite !== 'disabled') {
      try {
        await this.#sqliteStore.capture(record);
        normalized = 'stored';
      } catch (error) {
        failures.push(getFailureMessage('SQLite normalized storage failed', error));
      }
    }

    return Object.freeze({
      failures: Object.freeze(failures),
      normalized,
      raw,
      status: getCaptureStatus(raw, normalized),
    });
  }

  async cleanup(): Promise<Readonly<IDataStorageCleanupReceipt>> {
    const cutoff = getCutoffIso(this.#now(), this.#retentionDays);
    const cutoffDay = cutoff.slice(0, 10);
    const failures: string[] = [];
    const removedRawFiles: string[] = [];
    let removedNormalizedRecords = 0;

    try {
      const files = await readdir(this.#rawDirectory()).catch((error: unknown) => {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return [] as string[];
        }

        throw error;
      });

      for (const fileName of files.sort()) {
        if (!/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(fileName)) {
          continue;
        }

        if (fileName.slice(0, 10) < cutoffDay) {
          await rm(join(this.#rawDirectory(), fileName), { force: true });
          removedRawFiles.push(fileName);
        }
      }
    } catch (error) {
      failures.push(getFailureMessage('Raw retention cleanup failed', error));
    }

    if (this.#sqlite !== 'disabled') {
      try {
        removedNormalizedRecords = await this.#sqliteStore.cleanup(cutoff);
      } catch (error) {
        failures.push(
          getFailureMessage('SQLite retention cleanup failed', error),
        );
      }
    }

    return Object.freeze({
      failures: Object.freeze(failures),
      removedNormalizedRecords,
      removedRawFiles: Object.freeze(removedRawFiles),
      status: failures.length === 0 ? 'completed' : 'degraded',
    });
  }

  async exportData(
    options: Readonly<IDataStorageExportOptions> = {},
  ): Promise<Readonly<IDataStorageExport>> {
    const limit = validateExportLimit(options.limit);
    const records: IDataStorageRawRecord[] = [];
    let corruptLineCount = 0;
    let truncated = false;
    const files = await readdir(this.#rawDirectory()).catch((error: unknown) => {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return [] as string[];
      }

      throw error;
    });

    outer: for (const fileName of files
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))
      .sort()
      .reverse()) {
      const lines = (await readFile(join(this.#rawDirectory(), fileName), 'utf8'))
        .split('\n')
        .filter((line) => line.length > 0)
        .reverse();

      for (const line of lines) {
        try {
          const value: unknown = JSON.parse(line);

          if (!checkIsRawRecord(value)) {
            corruptLineCount += 1;
            continue;
          }

          if (records.length === limit) {
            truncated = true;
            break outer;
          }

          records.push(value);
        } catch {
          corruptLineCount += 1;
        }
      }
    }

    return Object.freeze({
      corruptLineCount,
      generatedAt: this.#now(),
      records: Object.freeze(records.map((record) => Object.freeze(record))),
      schemaVersion: DATA_STORAGE_VERSIONS.rawRecordSchema,
      truncated,
    });
  }

  getStatus(): Readonly<IDataStorageStatus> {
    return Object.freeze({
      cacheDirectory: join(this.#rootDirectory, 'cache'),
      evalArtifactsDirectory: join(this.#rootDirectory, 'evals'),
      privacy: this.#privacy,
      rawDirectory: this.#rawDirectory(),
      reportsDirectory: join(this.#rootDirectory, 'reports'),
      retentionDays: this.#retentionDays,
      rootDirectory: this.#rootDirectory,
      sqlite: this.#sqlite,
      sqlitePath: join(this.#rootDirectory, 'amy.sqlite'),
    });
  }

  async #appendRawRecord(
    record: Readonly<IDataStorageRawRecord>,
  ): Promise<void> {
    await Promise.all(
      [
        this.#rawDirectory(),
        join(this.#rootDirectory, 'cache'),
        join(this.#rootDirectory, 'evals'),
        join(this.#rootDirectory, 'reports'),
      ].map((directory) =>
        mkdir(directory, { mode: 0o700, recursive: true }),
      ),
    );
    const segment = `${record.capturedAt.slice(0, 10)}.jsonl`;

    await appendFile(
      join(this.#rawDirectory(), segment),
      `${JSON.stringify(record)}\n`,
      { encoding: 'utf8', flag: 'a', mode: 0o600 },
    );
  }

  #rawDirectory() {
    return join(this.#rootDirectory, 'raw');
  }
}
