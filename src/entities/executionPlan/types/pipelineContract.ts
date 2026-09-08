import type { IRuntimeDataContract } from '#entities/runtime';
import type { TJsonValue } from '#shared/types/jsonValue';

export type TExecutionStrategy<
  TData extends Readonly<Record<string, TJsonValue>>,
> = IRuntimeDataContract<TData> & { kind: 'execution-strategy' };

export type TExecutionPlan<
  TData extends Readonly<Record<string, TJsonValue>>,
> = IRuntimeDataContract<TData> & { kind: 'execution-plan' };
