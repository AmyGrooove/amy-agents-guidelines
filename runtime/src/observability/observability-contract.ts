export const OBSERVABILITY_VERSIONS = Object.freeze({
  api: 1,
  policy: 1,
  recordSchema: 1,
});

export type TObservabilitySubjectKind =
  | 'agent-run'
  | 'dag-node'
  | 'recovery'
  | 'runtime'
  | 'session'
  | 'task'
  | 'tool-call'
  | 'verification';

export type TObservabilityTelemetryEvent =
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'observed'
  | 'started';

export type TObservabilityDecisionKind =
  | 'classification'
  | 'compute'
  | 'context'
  | 'decomposition'
  | 'escalation'
  | 'parallelism'
  | 'recovery'
  | 'reviewer'
  | 'retry'
  | 'scout'
  | 'strategy'
  | 'verifier';

export type TObservabilityConfidence = 'high' | 'low' | 'medium';

export type IObservabilitySubject = Readonly<{
  id: string;
  kind: TObservabilitySubjectKind;
}>;

export type IObservabilityPolicyRef = Readonly<{
  owner: string;
  version: number;
}>;

export type IObservabilityTelemetryInput = Readonly<{
  event: TObservabilityTelemetryEvent;
  kind: 'telemetry';
  recordId: string;
  subject: Readonly<IObservabilitySubject>;

  durationMs?: number;
  errorCode?: string;
  refs?: readonly string[];
}>;

export type IObservabilityDecisionInput = Readonly<{
  decision: string;
  decisionKind: TObservabilityDecisionKind;
  evidenceRefs: readonly string[];
  kind: 'decision';
  policy: Readonly<IObservabilityPolicyRef>;
  reasonCodes: readonly string[];
  recordId: string;
  subject: Readonly<IObservabilitySubject>;

  confidence?: TObservabilityConfidence;
  explanation?: string;
}>;

export type TObservabilityInput =
  | IObservabilityDecisionInput
  | IObservabilityTelemetryInput;

export type IObservabilityTelemetryRecord = Readonly<
  IObservabilityTelemetryInput & {
    schemaVersion: number;
    timestamp: string;
  }
>;

export type IObservabilityDecisionRecord = Readonly<
  IObservabilityDecisionInput & {
    schemaVersion: number;
    timestamp: string;
  }
>;

export type TObservabilityRecord =
  | IObservabilityDecisionRecord
  | IObservabilityTelemetryRecord;

export type TObservabilityDeliveryStatus = 'degraded' | 'dropped' | 'emitted';

export type IObservabilityReceipt = Readonly<{
  deliveredCount: number;
  deliveryFailures: readonly string[];
  record: Readonly<TObservabilityRecord>;
  status: TObservabilityDeliveryStatus;
}>;

export interface IObservabilityApi {
  record(value: unknown): Promise<Readonly<IObservabilityReceipt>>;
}
