import type { TJsonValue } from '../state/state-store.js';

export type TRuntimeDataContractKind =
  | 'context-selection'
  | 'execution-result'
  | 'execution-strategy'
  | 'project-information'
  | 'quality-result'
  | 'task-analysis';

export interface IRuntimeDataContract<
  TData extends Readonly<Record<string, TJsonValue>>,
> {
  data: TData;
  kind: TRuntimeDataContractKind;
  schemaVersion: number;
}

export type TProjectInformation<
  TData extends Readonly<Record<string, TJsonValue>>,
> = IRuntimeDataContract<TData> & { kind: 'project-information' };

export type TContextSelection<
  TData extends Readonly<Record<string, TJsonValue>>,
> = IRuntimeDataContract<TData> & { kind: 'context-selection' };

export type TTaskAnalysis<
  TData extends Readonly<Record<string, TJsonValue>>,
> = IRuntimeDataContract<TData> & { kind: 'task-analysis' };

export type TExecutionStrategy<
  TData extends Readonly<Record<string, TJsonValue>>,
> = IRuntimeDataContract<TData> & { kind: 'execution-strategy' };

export type TExecutionResult<
  TData extends Readonly<Record<string, TJsonValue>>,
> = IRuntimeDataContract<TData> & { kind: 'execution-result' };

export type TQualityResult<
  TData extends Readonly<Record<string, TJsonValue>>,
> = IRuntimeDataContract<TData> & { kind: 'quality-result' };
