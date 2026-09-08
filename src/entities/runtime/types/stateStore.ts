import type { TJsonValue } from '#shared/types/jsonValue';

export type { TJsonPrimitive, TJsonValue } from '#shared/types/jsonValue';

export interface IStateAddress {
  key: string;
  namespace: string;
}

export interface ISetStateProps extends IStateAddress {
  value: TJsonValue;
}

export interface IStateRecord extends IStateAddress {
  schemaVersion: number;
  updatedAt: string;
  value: TJsonValue;
}

export interface IStateStore {
  clear(namespace: string): Promise<void>;
  delete(address: IStateAddress): Promise<void>;
  get(address: IStateAddress): Promise<IStateRecord | undefined>;
  set(props: ISetStateProps): Promise<IStateRecord>;
}
