import type { TJsonValue } from '#shared/types/jsonValue';

export type TRuntimeDataContractKind =
  | 'context-selection'
  | 'execution-plan'
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
