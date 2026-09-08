export type TAmyRuntimeErrorCode =
  | 'INVALID_CONFIGURATION'
  | 'CAPABILITY_UNAVAILABLE'
  | 'INCOMPATIBLE_CAPABILITY'
  | 'CAPABILITY_EXECUTION_FAILURE'
  | 'VALIDATION_FAILURE'
  | 'RUNTIME_INTERNAL_FAILURE';

export interface IAmyRuntimeErrorProps {
  code: TAmyRuntimeErrorCode;
  message: string;

  cause?: unknown;
  details?: Readonly<Record<string, unknown>>;
}

export class AmyRuntimeError extends Error {
  readonly code: TAmyRuntimeErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(props: IAmyRuntimeErrorProps) {
    super(props.message, { cause: props.cause });

    this.name = 'AmyRuntimeError';
    this.code = props.code;
    this.details = Object.freeze({ ...props.details });
  }
}
