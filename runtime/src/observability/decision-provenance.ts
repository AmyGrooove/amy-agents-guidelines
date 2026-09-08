import { validateObservabilityInput } from './validate-observability.js';

import type { IComputeRoutingDecision } from '../compute-routing/compute-routing-contract.js';
import type { TContextIntelligenceSelection } from '../context-intelligence/context-intelligence-contract.js';
import type { TDecompositionPlan } from '../decomposition/decomposition-contract.js';
import type { TCompletionResult } from '../completion/completion-contract.js';
import type { TRecoveryPlan, TRecoveryBranchKind } from '../recovery/recovery-contract.js';
import type { TStrategyRoutingDecision } from '../strategy-routing/strategy-routing-contract.js';
import type { TTaskIntelligenceAnalysis } from '../task-intelligence/task-intelligence-contract.js';
import type { TVerificationResult } from '../verification/verification-contract.js';
import type {
  IObservabilityDecisionInput,
  IObservabilitySubject,
  TObservabilityDecisionKind,
} from './observability-contract.js';

interface IProvenanceSourceBase {
  provenanceId: string;
  sourceRef: string;
  taskId: string;
}

export type TDecisionProvenanceSource =
  | Readonly<IProvenanceSourceBase & {
      kind: 'completion';
      value: Readonly<TCompletionResult>;
    }>
  | Readonly<IProvenanceSourceBase & {
      kind: 'compute';
      value: Readonly<IComputeRoutingDecision>;
    }>
  | Readonly<IProvenanceSourceBase & {
      kind: 'context';
      value: Readonly<TContextIntelligenceSelection>;
    }>
  | Readonly<IProvenanceSourceBase & {
      kind: 'decomposition';
      value: Readonly<TDecompositionPlan>;
    }>
  | Readonly<IProvenanceSourceBase & {
      kind: 'recovery';
      value: Readonly<TRecoveryPlan>;
    }>
  | Readonly<IProvenanceSourceBase & {
      kind: 'strategy';
      value: Readonly<TStrategyRoutingDecision>;
    }>
  | Readonly<IProvenanceSourceBase & {
      kind: 'task-classification';
      value: Readonly<TTaskIntelligenceAnalysis>;
    }>
  | Readonly<IProvenanceSourceBase & {
      kind: 'verification';
      value: Readonly<TVerificationResult>;
    }>;

const unique = (values: readonly string[]): readonly string[] =>
  Object.freeze([...new Set(values)]);

const asDecision = (
  value: IObservabilityDecisionInput,
): Readonly<IObservabilityDecisionInput> => {
  const validated = validateObservabilityInput(value);

  if (validated.kind !== 'decision') {
    throw new TypeError('Decision provenance builder produced non-decision input');
  }

  return validated;
};

const createDecision = (props: Readonly<{
  decision: string;
  decisionKind: TObservabilityDecisionKind;
  evidenceRefs: readonly string[];
  policyOwner: string;
  policyVersion: number;
  provenanceId: string;
  reasonCodes: readonly string[];
  subject: Readonly<IObservabilitySubject>;
  confidence?: 'high' | 'low' | 'medium';
}>): Readonly<IObservabilityDecisionInput> =>
  asDecision({
    decision: props.decision,
    decisionKind: props.decisionKind,
    evidenceRefs: unique(props.evidenceRefs).slice(0, 32),
    kind: 'decision',
    policy: {
      owner: props.policyOwner,
      version: props.policyVersion,
    },
    reasonCodes: unique(props.reasonCodes),
    recordId: `${props.provenanceId}:${props.decisionKind}`,
    subject: props.subject,
    ...(props.confidence ? { confidence: props.confidence } : {}),
  });

const taskSubject = (taskId: string): Readonly<IObservabilitySubject> => ({
  id: taskId,
  kind: 'task',
});

const mapRecoverySubjectKind = (
  kind: TRecoveryBranchKind,
): IObservabilitySubject['kind'] => {
  switch (kind) {
    case 'dag-node': return 'dag-node';
    case 'task': return 'task';
    case 'verification': return 'verification';
    case 'integration': return 'recovery';
  }
};

const buildTaskClassification = (
  source: Extract<TDecisionProvenanceSource, { kind: 'task-classification' }>,
) => {
  const classification = source.value.data.classification;

  return Object.freeze([
    createDecision({
      confidence: classification.confidence,
      decision: [
        `mode=${classification.mode}`,
        `scope=${classification.dimensions.scope}`,
        `complexity=${classification.dimensions.complexity}`,
        `risk=${classification.dimensions.risk}`,
      ].join(';'),
      decisionKind: 'classification',
      evidenceRefs: [source.sourceRef],
      policyOwner: 'task-intelligence',
      policyVersion: classification.schemaVersion,
      provenanceId: source.provenanceId,
      reasonCodes: classification.reasonCodes,
      subject: taskSubject(source.taskId),
    }),
  ]);
};

const buildContext = (
  source: Extract<TDecisionProvenanceSource, { kind: 'context' }>,
) => {
  const { packet, resolution } = source.value.data;

  return Object.freeze([
    createDecision({
      confidence: resolution.confidence,
      decision: `exploration=${resolution.exploration};modules=${packet.modules.length};files=${packet.likelyAffectedFiles.length}`,
      decisionKind: 'context',
      evidenceRefs: [source.sourceRef],
      policyOwner: 'context-intelligence',
      policyVersion: resolution.schemaVersion,
      provenanceId: source.provenanceId,
      reasonCodes: resolution.reasonCodes,
      subject: taskSubject(source.taskId),
    }),
  ]);
};

const buildCompute = (
  source: Extract<TDecisionProvenanceSource, { kind: 'compute' }>,
) => Object.freeze([
  createDecision({
    confidence: source.value.confidence,
    decision: `profile=${source.value.profile};status=${source.value.assignment.status}`,
    decisionKind: 'compute',
    evidenceRefs: [source.sourceRef],
    policyOwner: 'compute-routing',
    policyVersion: source.value.schemaVersion,
    provenanceId: source.provenanceId,
    reasonCodes: source.value.reasonCodes,
    subject: taskSubject(source.taskId),
  }),
]);

const buildStrategy = (
  source: Extract<TDecisionProvenanceSource, { kind: 'strategy' }>,
) => {
  const data = source.value.data;
  const common = {
    confidence: data.confidence,
    evidenceRefs: [source.sourceRef],
    policyOwner: 'strategy-routing',
    policyVersion: data.policyVersion,
    provenanceId: source.provenanceId,
    reasonCodes: data.reasonCodes,
    subject: taskSubject(source.taskId),
  } as const;

  return Object.freeze([
    createDecision({
      ...common,
      decision: [
        `execution=${data.execution}`,
        `planning=${data.planning}`,
        `exploration=${data.exploration}`,
        `verification=${data.verification}`,
        `review=${data.review}`,
      ].join(';'),
      decisionKind: 'strategy',
    }),
    createDecision({
      ...common,
      decision: data.exploration === 'scout' ? 'activated' : 'not-activated',
      decisionKind: 'scout',
    }),
    createDecision({
      ...common,
      decision: data.verification === 'verifier' ? 'required' : 'not-required',
      decisionKind: 'verifier',
    }),
    createDecision({
      ...common,
      decision: data.review === 'reviewer' ? 'required' : 'not-required',
      decisionKind: 'reviewer',
    }),
  ]);
};

const buildDecomposition = (
  source: Extract<TDecisionProvenanceSource, { kind: 'decomposition' }>,
) => {
  const data = source.value.data;

  return Object.freeze([
    createDecision({
      confidence: data.confidence,
      decision: data.decision,
      decisionKind: 'decomposition',
      evidenceRefs: [source.sourceRef],
      policyOwner: 'decomposition',
      policyVersion: data.policyVersion,
      provenanceId: source.provenanceId,
      reasonCodes: data.reasonCodes,
      subject: taskSubject(source.taskId),
    }),
    createDecision({
      confidence: data.parallelism.confidence,
      decision: `mode=${data.parallelism.mode};maxConcurrency=${data.parallelism.maxConcurrency}`,
      decisionKind: 'parallelism',
      evidenceRefs: [source.sourceRef],
      policyOwner: 'decomposition',
      policyVersion: data.policyVersion,
      provenanceId: source.provenanceId,
      reasonCodes: data.parallelism.reasonCodes,
      subject: taskSubject(source.taskId),
    }),
  ]);
};

const buildVerification = (
  source: Extract<TDecisionProvenanceSource, { kind: 'verification' }>,
) => {
  const data = source.value.data;
  const subject: Readonly<IObservabilitySubject> = {
    id: data.verificationId,
    kind: 'verification',
  };
  const semanticEvidence = data.semantic.criteria.flatMap(
    ({ evidenceRefs }) => evidenceRefs,
  );
  const reviewEvidence = data.review.findings.flatMap(
    ({ evidenceRefs }) => evidenceRefs,
  );

  return Object.freeze([
    createDecision({
      decision: `status=${data.semantic.status}`,
      decisionKind: 'verifier',
      evidenceRefs: [source.sourceRef, ...semanticEvidence],
      policyOwner: 'verification',
      policyVersion: data.policyVersion,
      provenanceId: source.provenanceId,
      reasonCodes: data.semantic.reasonCodes,
      subject,
    }),
    createDecision({
      decision: `status=${data.review.status}`,
      decisionKind: 'reviewer',
      evidenceRefs: [source.sourceRef, ...reviewEvidence],
      policyOwner: 'verification',
      policyVersion: data.policyVersion,
      provenanceId: source.provenanceId,
      reasonCodes: data.review.reasonCodes,
      subject,
    }),
  ]);
};

const buildCompletion = (
  source: Extract<TDecisionProvenanceSource, { kind: 'completion' }>,
) => {
  const data = source.value.data;

  return Object.freeze([
    createDecision({
      confidence: data.confidence,
      decision: `guard=${data.guard.decision};retriesRemaining=${data.guard.retriesRemaining}`,
      decisionKind: 'retry',
      evidenceRefs: [source.sourceRef],
      policyOwner: 'completion',
      policyVersion: data.policyVersion,
      provenanceId: source.provenanceId,
      reasonCodes: data.reasonCodes,
      subject: taskSubject(source.taskId),
    }),
  ]);
};

const buildRecovery = (
  source: Extract<TDecisionProvenanceSource, { kind: 'recovery' }>,
) => {
  const data = source.value.data;
  const subject: Readonly<IObservabilitySubject> = {
    id: data.diagnosis.branch.id,
    kind: mapRecoverySubjectKind(data.diagnosis.branch.kind),
  };
  const common = {
    decision: data.action,
    evidenceRefs: [source.sourceRef, ...data.diagnosis.evidenceRefs],
    policyOwner: 'recovery',
    policyVersion: data.policyVersion,
    provenanceId: source.provenanceId,
    reasonCodes: data.reasonCodes,
    subject,
  } as const;
  const records: Readonly<IObservabilityDecisionInput>[] = [
    createDecision({
      ...common,
      decisionKind: 'recovery',
    }),
  ];

  if (data.action === 'retry') {
    records.push(createDecision({
      ...common,
      decisionKind: 'retry',
    }));
  } else if (data.action === 'compute-escalate') {
    records.push(createDecision({
      ...common,
      decisionKind: 'escalation',
    }));
  }

  return Object.freeze(records);
};

export const buildDecisionProvenance = (
  source: Readonly<TDecisionProvenanceSource>,
): readonly Readonly<IObservabilityDecisionInput>[] => {
  switch (source.kind) {
    case 'task-classification': return buildTaskClassification(source);
    case 'context': return buildContext(source);
    case 'compute': return buildCompute(source);
    case 'strategy': return buildStrategy(source);
    case 'decomposition': return buildDecomposition(source);
    case 'verification': return buildVerification(source);
    case 'completion': return buildCompletion(source);
    case 'recovery': return buildRecovery(source);
  }
};
