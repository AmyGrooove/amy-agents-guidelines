import type { IRuntimeDataContract } from '#entities/runtime';
import type { TJsonValue } from '#shared/types/jsonValue';

export type TContextSelection<
  TData extends Readonly<Record<string, TJsonValue>>,
> = IRuntimeDataContract<TData> & { kind: 'context-selection' };
