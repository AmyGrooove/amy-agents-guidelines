import type { IRuntimeEvent } from '#entities/runtime';

export const DATA_STORAGE_VERSIONS = Object.freeze({
  api: 1,
  policy: 1,
  rawRecordSchema: 1,
  sqliteSchema: 2,
});

export const DATA_STORAGE_LIMITS = Object.freeze({
  defaultExportRecords: 500,
  maxExportRecords: 5_000,
  maxRetentionDays: 3_650,
  minRetentionDays: 1,
});

export const DEFAULT_DATA_STORAGE_POLICY = Object.freeze({
  privacy: Object.freeze({ rawContent: 'omit' as const }),
  retentionDays: 30,
  sqlite: 'auto' as const,
});

export type TRawContentStoragePolicy = 'omit' | 'redacted';
export type TSqliteStorageMode = 'auto' | 'disabled';
export type TDataStorageWriteState = 'disabled' | 'failed' | 'stored';
export type TDataStorageCaptureStatus = 'degraded' | 'dropped' | 'stored';
export type TDataStorageCleanupStatus = 'completed' | 'degraded';

export interface IDataPrivacyPolicy {
  rawContent: TRawContentStoragePolicy;
}

export interface IDataStorageRawRecord {
  capturedAt: string;
  event: Readonly<IRuntimeEvent>;
  schemaVersion: number;
}

export interface IDataStorageCaptureReceipt {
  failures: readonly string[];
  normalized: TDataStorageWriteState;
  raw: Exclude<TDataStorageWriteState, 'disabled'>;
  status: TDataStorageCaptureStatus;
}

export interface IDataStorageCleanupReceipt {
  failures: readonly string[];
  removedNormalizedRecords: number;
  removedRawFiles: readonly string[];
  status: TDataStorageCleanupStatus;
}

export interface IDataStorageExportOptions {
  limit?: number;
}

export interface IDataStorageExport {
  corruptLineCount: number;
  generatedAt: string;
  records: readonly Readonly<IDataStorageRawRecord>[];
  schemaVersion: number;
  truncated: boolean;
}

export interface IDataStorageStatus {
  cacheDirectory: string;
  evalArtifactsDirectory: string;
  privacy: Readonly<IDataPrivacyPolicy>;
  rawDirectory: string;
  reportsDirectory: string;
  retentionDays: number;
  rootDirectory: string;
  sqlite: TSqliteStorageMode;
  sqlitePath: string;
}

export interface IDataStorageApi {
  capture(value: unknown): Promise<Readonly<IDataStorageCaptureReceipt>>;
  cleanup(): Promise<Readonly<IDataStorageCleanupReceipt>>;
  exportData(options?: Readonly<IDataStorageExportOptions>): Promise<Readonly<IDataStorageExport>>;
  getStatus(): Readonly<IDataStorageStatus>;
}
