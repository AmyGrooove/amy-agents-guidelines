import type { TComputeProfile } from '../compute-routing/compute-routing-contract.js';

export const AGENT_ROLES = Object.freeze([
  'scout',
  'worker',
  'debugger',
  'verifier',
  'reviewer',
] as const);

export const AGENT_ROLE_VERSIONS = Object.freeze({
  api: 1,
  handoffSchema: 1,
  resultSchema: 1,
  roleSchema: 1,
});

export type TAgentRole = (typeof AGENT_ROLES)[number];

export type TAgentToolPolicy = 'read-only' | 'task-execution';
export type TAgentReadPolicy = 'targeted' | 'task-scope';
export type TAgentWritePolicy = 'none' | 'task-scope';

export type TAgentRoleInputKind =
  | 'context-packet'
  | 'failure-evidence'
  | 'handoff'
  | 'implementation-result'
  | 'task-analysis'
  | 'verification-evidence';

export type TAgentRoleOutputKind =
  | 'diagnosis'
  | 'exploration-findings'
  | 'implementation-result'
  | 'review-findings'
  | 'verification-result';

export interface IAgentChildDelegationPolicy {
  allowed: boolean;
  allowedRoles: readonly TAgentRole[];
  maxChildren: number;
}

export interface IAgentRoleDescriptor {
  childDelegation: Readonly<IAgentChildDelegationPolicy>;
  completionCriteria: readonly string[];
  id: TAgentRole;
  inputs: readonly TAgentRoleInputKind[];
  nonResponsibilities: readonly string[];
  outputs: readonly TAgentRoleOutputKind[];
  readPolicy: TAgentReadPolicy;
  responsibility: string;
  schemaVersion: number;
  toolPolicy: TAgentToolPolicy;
  typicalComputeProfile: TComputeProfile;
  writePolicy: TAgentWritePolicy;
}

export interface IAgentRolesApi {
  get(role: TAgentRole): Readonly<IAgentRoleDescriptor>;
  list(): readonly Readonly<IAgentRoleDescriptor>[];
  validateHandoff(value: unknown): Readonly<IAgentHandoff>;
  validateResult(value: unknown): Readonly<IAgentHandoffResult>;
}

export type TAgentHandoffStatus = 'blocked' | 'completed' | 'failed';
export type TAgentEvidenceKind = 'check' | 'command' | 'file' | 'finding';

export interface IAgentHandoffOrchestratorSource {
  kind: 'orchestrator';
}

export interface IAgentHandoffAgentSource {
  handoffId: string;
  kind: 'agent';
  role: TAgentRole;
}

export type TAgentHandoffSource =
  | Readonly<IAgentHandoffOrchestratorSource>
  | Readonly<IAgentHandoffAgentSource>;

export interface IAgentHandoffScope {
  readTargets: readonly string[];
  writeTargets: readonly string[];
}

export interface IAgentHandoffInput {
  kind: TAgentRoleInputKind;
  ref: string;
  summary?: string;
}

export interface IAgentHandoff {
  acceptanceCriteria: readonly string[];
  computeProfile?: TComputeProfile;
  constraints: readonly string[];
  expectedOutputs: readonly TAgentRoleOutputKind[];
  goal: string;
  handoffId: string;
  inputs: readonly Readonly<IAgentHandoffInput>[];
  kind: 'agent-handoff';
  nonGoals: readonly string[];
  requirements: readonly string[];
  schemaVersion: number;
  scope: Readonly<IAgentHandoffScope>;
  source: TAgentHandoffSource;
  targetRole: TAgentRole;
}

export interface IAgentHandoffOutput {
  kind: TAgentRoleOutputKind;
  ref: string;
  summary: string;
}

export interface IAgentHandoffEvidence {
  kind: TAgentEvidenceKind;
  ref: string;
  summary: string;
}

export interface IAgentHandoffResult {
  childHandoffIds: readonly string[];
  evidence: readonly Readonly<IAgentHandoffEvidence>[];
  handoffId: string;
  kind: 'agent-handoff-result';
  outputs: readonly Readonly<IAgentHandoffOutput>[];
  role: TAgentRole;
  schemaVersion: number;
  status: TAgentHandoffStatus;
  summary: string;
  unresolvedIssues: readonly string[];
}
