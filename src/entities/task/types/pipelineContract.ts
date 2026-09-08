import type { IRuntimeDataContract } from '#entities/runtime';
import type { TJsonValue } from '#shared/types/jsonValue';

export type TTaskAnalysis<
  TData extends Readonly<Record<string, TJsonValue>>,
> = IRuntimeDataContract<TData> & { kind: 'task-analysis' };
