import { TASK_INTELLIGENCE_VERSIONS } from '#entities/task';
import { validateTaskClassificationInput } from '#entities/task';

import type {
  ITaskClassification,
  TTaskIntelligenceAnalysis,
  ITaskContract,
  ITaskProjectEvidence,
  TTaskClassificationEvidenceGap,
  TTaskClassificationReasonCode,
  TTaskConfidence,
  TTaskLevel,
  TTaskScope,
} from '#entities/task';

const addScopeReason = (
  scope: TTaskScope,
  reasons: Set<TTaskClassificationReasonCode>,
) => {
  reasons.add(`scope-${scope}` as TTaskClassificationReasonCode);
};

const classifyComplexity = (
  contract: Readonly<ITaskContract>,
  reasons: Set<TTaskClassificationReasonCode>,
): TTaskLevel => {
  const requirements = contract.requirements?.length ?? 0;
  const acceptanceCriteria = contract.acceptanceCriteria?.length ?? 0;
  const taskItems = requirements + acceptanceCriteria;
  const scope = contract.affectedScope?.kind;

  if (requirements >= 4) {
    reasons.add('requirements-many');
  } else if (requirements > 0) {
    reasons.add('requirements-present');
  }

  if (acceptanceCriteria >= 3) {
    reasons.add('acceptance-criteria-many');
  } else if (acceptanceCriteria > 0) {
    reasons.add('acceptance-criteria-present');
  }

  if (scope === 'repository' || taskItems >= 6) {
    return 'high';
  }

  if (scope === 'module' || scope === 'multi-module' || taskItems >= 3) {
    return 'medium';
  }

  return 'low';
};

const classifyUncertainty = (
  contract: Readonly<ITaskContract>,
  reasons: Set<TTaskClassificationReasonCode>,
  gaps: Set<TTaskClassificationEvidenceGap>,
): TTaskLevel => {
  if (contract.uncertainties === undefined) {
    gaps.add('uncertainty');

    return 'unknown';
  }

  if (contract.uncertainties.length === 0) {
    reasons.add('uncertainties-none');

    return 'low';
  }

  if (contract.uncertainties.length >= 2) {
    reasons.add('uncertainties-many');

    return 'high';
  }

  reasons.add('uncertainties-present');

  return 'medium';
};

const classifyRisk = (
  projectEvidence: Readonly<ITaskProjectEvidence> | undefined,
  reasons: Set<TTaskClassificationReasonCode>,
  gaps: Set<TTaskClassificationEvidenceGap>,
): TTaskLevel => {
  if (!projectEvidence || projectEvidence.modules.length === 0) {
    gaps.add('project-risk');

    return 'unknown';
  }

  const risks = projectEvidence.modules.map(({ risk }) => risk ?? 'unknown');
  const isStale = projectEvidence.modules.some(
    ({ freshnessState, graphState }) =>
      freshnessState === 'stale' ||
      graphState === 'missing' ||
      graphState === 'stale',
  );
  const riskReasons = new Set(
    projectEvidence.modules.flatMap(({ riskReasons }) => riskReasons ?? []),
  );

  if (isStale) {
    reasons.add('project-evidence-stale');
    gaps.add('stale-project-evidence');
  }

  if (riskReasons.has('public-api')) {
    reasons.add('public-api-impact');
  }

  if (riskReasons.has('many-consumers')) {
    reasons.add('many-consumers');
  }

  if (riskReasons.has('critical-invariants')) {
    reasons.add('critical-invariants');
  }

  if (riskReasons.has('high-change-risk')) {
    reasons.add('high-change-risk');
  }

  if (risks.includes('high')) {
    reasons.add('project-risk-high');

    return 'high';
  }

  if (risks.includes('medium')) {
    reasons.add('project-risk-medium');

    return 'medium';
  }

  if (risks.every((risk) => risk === 'low')) {
    reasons.add('project-risk-low');

    return 'low';
  }

  gaps.add('project-risk');

  return 'unknown';
};

const classifyCoupling = (
  scope: TTaskScope,
  projectEvidence: Readonly<ITaskProjectEvidence> | undefined,
): TTaskLevel => {
  const riskReasons = new Set(
    projectEvidence?.modules.flatMap(({ riskReasons }) => riskReasons ?? []) ?? [],
  );

  if (
    riskReasons.has('public-api') ||
    riskReasons.has('many-consumers') ||
    riskReasons.has('critical-invariants')
  ) {
    return 'high';
  }

  if (scope === 'local' || scope === 'module') {
    return 'low';
  }

  if (scope === 'multi-module') {
    return 'medium';
  }

  if (scope === 'repository') {
    return 'high';
  }

  return 'unknown';
};

const escalateScope = (scope: TTaskScope): TTaskScope => {
  if (scope === 'local') {
    return 'module';
  }

  if (scope === 'module') {
    return 'multi-module';
  }

  if (scope === 'multi-module') {
    return 'repository';
  }

  return scope;
};

const classifyVerificationCost = (
  contract: Readonly<ITaskContract>,
  scope: TTaskScope,
  reasons: Set<TTaskClassificationReasonCode>,
  gaps: Set<TTaskClassificationEvidenceGap>,
): TTaskLevel => {
  if (contract.verificationExpectations === undefined) {
    gaps.add('verification');

    return 'unknown';
  }

  if (contract.verificationExpectations.length === 0) {
    reasons.add('verification-none');

    return 'low';
  }

  if (contract.verificationExpectations.length >= 3) {
    reasons.add('verification-many');

    return 'high';
  }

  reasons.add('verification-explicit');

  return scope === 'local' ? 'low' : 'medium';
};

const classifyConfidence = (
  contract: Readonly<ITaskContract>,
  risk: TTaskLevel,
  hasStaleEvidence: boolean,
): TTaskConfidence => {
  const knownTaskSignals = [
    contract.affectedScope !== undefined && contract.affectedScope.kind !== 'unknown',
    contract.uncertainties !== undefined,
    contract.verificationExpectations !== undefined,
  ].filter(Boolean).length;

  if (knownTaskSignals === 3 && risk !== 'unknown' && !hasStaleEvidence) {
    return 'high';
  }

  if (knownTaskSignals >= 2) {
    return 'medium';
  }

  return 'low';
};

export const TaskAnalysis = (
  value: unknown,
): Readonly<TTaskIntelligenceAnalysis> => {
  const { contract, projectEvidence } = validateTaskClassificationInput(value);
  const reasons = new Set<TTaskClassificationReasonCode>();
  const gaps = new Set<TTaskClassificationEvidenceGap>();
  const scope = contract.affectedScope?.kind ?? 'unknown';

  if (scope === 'unknown') {
    gaps.add('affected-scope');
  }
  addScopeReason(scope, reasons);

  const complexity = classifyComplexity(contract, reasons);
  const uncertainty = classifyUncertainty(contract, reasons, gaps);
  const risk = classifyRisk(projectEvidence, reasons, gaps);
  const coupling = classifyCoupling(scope, projectEvidence);
  const blastRadius = risk === 'high' ? escalateScope(scope) : scope;
  const expectedContextCost =
    scope === 'local'
      ? 'low'
      : scope === 'module'
        ? 'medium'
        : scope === 'multi-module' || scope === 'repository'
          ? 'high'
          : 'unknown';
  const verificationCost = classifyVerificationCost(
    contract,
    scope,
    reasons,
    gaps,
  );
  const parallelizability =
    scope === 'local' || scope === 'module' ? 'low' : 'unknown';

  if (parallelizability === 'unknown') {
    gaps.add('parallel-independence');
  }

  gaps.add('novelty');

  const hasStaleEvidence = gaps.has('stale-project-evidence');

  const classification: Readonly<ITaskClassification> = Object.freeze({
    confidence: classifyConfidence(contract, risk, hasStaleEvidence),
    dimensions: Object.freeze({
      blastRadius,
      complexity,
      coupling,
      expectedContextCost,
      novelty: 'unknown',
      parallelizability,
      risk,
      scope,
      uncertainty,
      verificationCost,
    }),
    evidenceGaps: Object.freeze([...gaps].sort()),
    mode: projectEvidence ? 'project-assisted' : 'text-only',
    reasonCodes: Object.freeze([...reasons].sort()),
    schemaVersion: TASK_INTELLIGENCE_VERSIONS.classificationSchema,
  });

  return Object.freeze({
    data: Object.freeze({ contract, classification }),
    kind: 'task-analysis',
    schemaVersion: TASK_INTELLIGENCE_VERSIONS.analysisSchema,
  });
};

export { TaskAnalysis as classifyTask };
