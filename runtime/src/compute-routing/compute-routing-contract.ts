import type { TTaskConfidence, TTaskIntelligenceAnalysis } from '../task-intelligence/task-intelligence-contract.js';

export const COMPUTE_ROUTING_VERSIONS = Object.freeze({
  api: 1,
  decisionSchema: 1,
});

export const COMPUTE_PROFILES = Object.freeze([
  'FAST',
  'STANDARD',
  'ADVANCED',
  'DEEP',
  'EXPERT',
] as const);

export type TComputeProfile = (typeof COMPUTE_PROFILES)[number];
export type TComputeRoutingMode = 'downgrade' | 'initial' | 'upgrade';
export type TComputeTargetKind = 'dag-node' | 'task';
export type TComputeAssignmentStatus =
  | 'escalated'
  | 'fallback'
  | 'mapped'
  | 'unavailable'
  | 'unmapped';

export type TComputeReasonCode =
  | 'default-profile'
  | 'heavy-task'
  | 'lightweight-task'
  | 'model-fallback'
  | 'model-mapped'
  | 'model-unavailable'
  | 'profile-downgraded'
  | 'profile-escalated'
  | 'profile-requested'
  | 'profile-upgraded'
  | 'standard-task';

export type IComputeProfileBinding = Readonly<{
  fallbackModels?: readonly string[];
  model?: string;
  reasoningEffort?: string;
}>;

export type IComputeRoutingConfig = Readonly<{
  defaultProfile?: TComputeProfile;
  profiles?: Readonly<Partial<Record<TComputeProfile, Readonly<IComputeProfileBinding>>>>;
}>;

export type IComputeTarget = Readonly<{
  kind: TComputeTargetKind;
  id?: string;
}>;

export type IComputeAssignment = Readonly<{
  status: TComputeAssignmentStatus;
  model?: string;
  reasoningEffort?: string;
}>;

export type IComputeRoutingDecision = Readonly<{
  assignment: Readonly<IComputeAssignment>;
  confidence: TTaskConfidence;
  profile: TComputeProfile;
  reasonCodes: readonly TComputeReasonCode[];
  schemaVersion: number;
  target: Readonly<IComputeTarget>;
}>;

export type IComputeRoutingInput = Readonly<{
  taskAnalysis: Readonly<TTaskIntelligenceAnalysis>;

  currentProfile?: TComputeProfile;
  mode?: TComputeRoutingMode;
  requestedProfile?: TComputeProfile;
  target?: Readonly<IComputeTarget>;
  unavailableModels?: readonly string[];
}>;

export interface IComputeRoutingApi {
  route(value: unknown): Readonly<IComputeRoutingDecision>;
}
