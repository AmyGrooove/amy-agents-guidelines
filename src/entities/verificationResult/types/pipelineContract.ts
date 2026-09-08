import type { IRuntimeDataContract } from '#entities/runtime';
import type { TJsonValue } from '#shared/types/jsonValue';

export type TQualityResult<
  TData extends Readonly<Record<string, TJsonValue>>,
> = IRuntimeDataContract<TData> & { kind: 'quality-result' };
