import type { IPluginMetadataInventory } from '../compatibility/plugin-inventory.js';

export const OPERATIONS_VERSIONS = Object.freeze({
  doctorSchema: 1,
});

export type TDoctorCheckStatus = 'fail' | 'pass' | 'skipped' | 'warn';
export type TDoctorStatus = 'degraded' | 'healthy' | 'unhealthy';

export interface IDoctorCheck {
  id: string;
  message: string;
  status: TDoctorCheckStatus;

  details?: Readonly<Record<string, unknown>>;
}

export interface IAmyDoctorReport {
  checks: readonly Readonly<IDoctorCheck>[];
  kind: 'doctor-report';
  pluginRoot: string;
  projectRoot: string;
  schemaVersion: number;
  status: TDoctorStatus;

  packageVersion?: string;
  plugin?: Readonly<IPluginMetadataInventory>;
}
