export type TJsonPrimitive = boolean | number | string | null;
export type TJsonValue =
  | TJsonPrimitive
  | readonly TJsonValue[]
  | { readonly [key: string]: TJsonValue };
