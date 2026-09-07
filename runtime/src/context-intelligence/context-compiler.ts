import { CONTEXT_INTELLIGENCE_VERSIONS } from './context-intelligence-contract.js';

import type {
  IContextBudgetSummary,
  IContextModuleSelection,
  IContextPacket,
  IContextResolution,
  IContextSpecSelection,
  TContextConfidence,
  TContextEvidenceGap,
  TContextExploration,
  TContextIntelligenceSelection,
  TContextReasonCode,
} from './context-intelligence-contract.js';
import type { ITaskContract } from '../task-intelligence/task-intelligence-contract.js';

export interface ICompileContextSelectionProps {
  architectureDecisions?: readonly string[];
  budget: Readonly<IContextBudgetSummary>;
  canonicalExamples?: readonly string[];
  confidence: TContextConfidence;
  contract: Readonly<ITaskContract>;
  dependencies?: readonly string[];
  evidenceGaps: readonly TContextEvidenceGap[];
  exploration: TContextExploration;
  invariants?: readonly string[];
  likelyAffectedFiles: readonly string[];
  modules?: readonly Readonly<IContextModuleSelection>[];
  reasonCodes: readonly TContextReasonCode[];
  sourceReads: readonly string[];
  specs?: readonly Readonly<IContextSpecSelection>[];
  verification?: readonly string[];
}

export const compileContextSelection = (
  props: ICompileContextSelectionProps,
): Readonly<TContextIntelligenceSelection> => {
  const packet: Readonly<IContextPacket> = Object.freeze({
    acceptanceCriteria: Object.freeze([...(props.contract.acceptanceCriteria ?? [])]),
    architectureDecisions: Object.freeze([...(props.architectureDecisions ?? [])]),
    canonicalExamples: Object.freeze([...(props.canonicalExamples ?? [])]),
    constraints: Object.freeze([...(props.contract.constraints ?? [])]),
    dependencies: Object.freeze([...(props.dependencies ?? [])]),
    goal: props.contract.goal,
    invariants: Object.freeze([...(props.invariants ?? [])]),
    likelyAffectedFiles: Object.freeze([...props.likelyAffectedFiles]),
    modules: Object.freeze([...(props.modules ?? [])]),
    nonGoals: Object.freeze([...(props.contract.nonGoals ?? [])]),
    requirements: Object.freeze([...(props.contract.requirements ?? [])]),
    schemaVersion: CONTEXT_INTELLIGENCE_VERSIONS.packetSchema,
    specs: Object.freeze([...(props.specs ?? [])]),
    verification: Object.freeze([
      ...(props.contract.verificationExpectations ?? []),
      ...(props.verification ?? []),
    ]),
  });
  const resolution: Readonly<IContextResolution> = Object.freeze({
    budget: props.budget,
    confidence: props.confidence,
    evidenceGaps: Object.freeze([...props.evidenceGaps].sort()),
    exploration: props.exploration,
    reasonCodes: Object.freeze([...props.reasonCodes].sort()),
    schemaVersion: CONTEXT_INTELLIGENCE_VERSIONS.resolutionSchema,
    sourceReads: Object.freeze([...props.sourceReads]),
  });

  return Object.freeze({
    data: Object.freeze({ packet, resolution }),
    kind: 'context-selection',
    schemaVersion: CONTEXT_INTELLIGENCE_VERSIONS.resolutionSchema,
  });
};
