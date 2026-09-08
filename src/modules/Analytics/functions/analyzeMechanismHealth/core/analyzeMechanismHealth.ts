import { ANALYTICS_VERSIONS } from '../../../types/analyticsContract.js';
import { selectAnalyticsSegments } from '../../selectAnalyticsSegments/core/selectAnalyticsSegments.js';
import { discoverValidatedTaskArchetypes, getAnalyticsConfidence } from '../../discoverTaskArchetypes/core/discoverTaskArchetypes.js';
import { validateAnalyticsInput } from '../../validateAnalytics/core/validateAnalytics.js';

import type { TOutcomeFailureClass, TOutcomeStatus } from '#entities/executionResult';
import type {
  IAnalyticsFailureClassSummary,
  IAnalyticsHealthReport,
  IAnalyticsHealthSegmentReport,
  IAnalyticsMechanismHealth,
  IAnalyticsMechanismOutcomeSummary,
  IAnalyticsMechanismRecoverySummary,
  IAnalyticsMechanismSignalSummary,
  IAnalyticsMechanismUsageSummary,
  IAnalyticsRoutingChoiceSummary,
  IAnalyticsRoutingCohort,
  IAnalyticsRoutingExecutionSummary,
  IAnalyticsTaskSample,
  IAnalyticsWindow,
  TAnalyticsHealthAssessment,
  TAnalyticsHealthReasonCode,
  TAnalyticsRoutingHealthDimension,
  TAnalyticsMechanismSignal,
  TTaskArchetype,
} from '../../../types/analyticsContract.js';

const SIGNALS = Object.freeze<TAnalyticsMechanismSignal[]>([
  'caught-issue',
  'recovered-failure',
  'unnecessary-invocation',
  'useful-evidence',
  'user-correction',
]);

const round = (value: number, precision = 4) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const average = (values: readonly number[], precision = 2): number | null =>
  values.length === 0
    ? null
    : round(values.reduce((sum, value) => sum + value, 0) / values.length, precision);

const rate = (statuses: readonly TOutcomeStatus[], expected: TOutcomeStatus): number | null =>
  statuses.length === 0
    ? null
    : round(statuses.filter((status) => status === expected).length / statuses.length);

const summarizeOutcomes = (
  samples: readonly Readonly<IAnalyticsTaskSample>[],
): Readonly<IAnalyticsMechanismOutcomeSummary> => {
  const outcomes = samples.flatMap(({ outcomeAssessment }) => outcomeAssessment ? [outcomeAssessment] : []);
  const statuses = outcomes.map(({ status }) => status);

  return Object.freeze({
    failureRate: rate(statuses, 'failure'),
    partialSuccessRate: rate(statuses, 'partial_success'),
    sampleSize: outcomes.length,
    successRate: rate(statuses, 'success'),
    unknownRate: rate(statuses, 'unknown'),
    unverifiedRate: rate(statuses, 'unverified'),
  });
};

const summarizeRecovery = (
  samples: readonly Readonly<IAnalyticsTaskSample>[],
): Readonly<IAnalyticsMechanismRecoverySummary> => {
  const outcomes = samples.flatMap(({ outcomeAssessment }) => outcomeAssessment ? [outcomeAssessment] : []);

  return Object.freeze({
    avgEscalations: average(outcomes.map(({ attempts }) => attempts.escalationCount)),
    avgRetries: average(outcomes.map(({ attempts }) => attempts.retryCount)),
    sampleSize: outcomes.length,
  });
};

const summarizeFailureClasses = (
  samples: readonly Readonly<IAnalyticsTaskSample>[],
): readonly Readonly<IAnalyticsFailureClassSummary>[] => {
  const counts = new Map<TOutcomeFailureClass, number>();
  for (const sample of samples) {
    for (const failure of sample.outcomeAssessment?.failures ?? []) {
      counts.set(failure.failureClass, (counts.get(failure.failureClass) ?? 0) + 1);
    }
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);

  return Object.freeze(
    [...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([failureClass, count]) => Object.freeze({
        confidence: getAnalyticsConfidence(count),
        count,
        failureClass,
        share: total === 0 ? 0 : round(count / total),
      })),
  );
};

const summarizeSignals = (
  taskCount: number,
  uses: readonly Readonly<{ signals: readonly TAnalyticsMechanismSignal[] }>[],
): readonly Readonly<IAnalyticsMechanismSignalSummary>[] => Object.freeze(
  SIGNALS.map((signal) => {
    const count = uses.filter(({ signals }) => signals.includes(signal)).length;
    return Object.freeze({
      confidence: getAnalyticsConfidence(taskCount),
      count,
      rate: taskCount === 0 ? 0 : round(count / taskCount),
      signal,
    });
  }),
);

const summarizeUsage = (
  uses: readonly Readonly<{ usage?: Readonly<{ costUnits?: number; durationMs?: number; tokens?: number }> }>[],
): Readonly<IAnalyticsMechanismUsageSummary> => Object.freeze({
  avgCostUnits: average(uses.flatMap(({ usage }) => usage?.costUnits === undefined ? [] : [usage.costUnits])),
  avgDurationMs: average(uses.flatMap(({ usage }) => usage?.durationMs === undefined ? [] : [usage.durationMs])),
  avgTokens: average(uses.flatMap(({ usage }) => usage?.tokens === undefined ? [] : [usage.tokens])),
});

const assessMechanism = (
  samples: readonly Readonly<IAnalyticsTaskSample>[],
  assignmentBySample: ReadonlyMap<string, TTaskArchetype>,
  signals: readonly Readonly<IAnalyticsMechanismSignalSummary>[],
): Readonly<{ assessment: TAnalyticsHealthAssessment; reasonCodes: readonly TAnalyticsHealthReasonCode[] }> => {
  if (samples.length < 5) {
    return Object.freeze({
      assessment: 'insufficient-evidence' as const,
      reasonCodes: Object.freeze(['insufficient-sample' as const]),
    });
  }

  const unnecessary = signals.find(({ signal }) => signal === 'unnecessary-invocation');
  if (unnecessary && unnecessary.rate >= 0.25) {
    return Object.freeze({
      assessment: 'routing-fit-suspected' as const,
      reasonCodes: Object.freeze(['unnecessary-invocation-observed' as const]),
    });
  }

  const byArchetype = new Map<TTaskArchetype, Readonly<IAnalyticsTaskSample>[]>();
  for (const sample of samples) {
    const archetype = assignmentBySample.get(sample.sampleId);
    if (!archetype) continue;
    const current = byArchetype.get(archetype) ?? [];
    byArchetype.set(archetype, [...current, sample]);
  }

  const comparable = [...byArchetype.entries()]
    .map(([archetype, archetypeSamples]) => ({
      archetype,
      failureRate: summarizeOutcomes(archetypeSamples).failureRate,
      sampleSize: archetypeSamples.filter(({ outcomeAssessment }) => outcomeAssessment !== undefined).length,
    }))
    .filter(({ failureRate, sampleSize }) => failureRate !== null && sampleSize >= 5) as Array<{
      archetype: TTaskArchetype;
      failureRate: number;
      sampleSize: number;
    }>;

  if (comparable.length >= 2) {
    const failureRates = comparable.map(({ failureRate }) => failureRate);
    const minimum = Math.min(...failureRates);
    const maximum = Math.max(...failureRates);

    if (maximum >= 0.5 && maximum - minimum >= 0.3) {
      return Object.freeze({
        assessment: 'routing-fit-suspected' as const,
        reasonCodes: Object.freeze(['failure-concentrated-by-archetype' as const]),
      });
    }

    if (failureRates.every((value) => value >= 0.5)) {
      return Object.freeze({
        assessment: 'mechanism-risk-suspected' as const,
        reasonCodes: Object.freeze(['failure-consistent-across-archetypes' as const]),
      });
    }
  }

  return Object.freeze({
    assessment: 'no-clear-risk' as const,
    reasonCodes: Object.freeze(['no-clear-risk-signal' as const]),
  });
};

const summarizeMechanisms = (
  samples: readonly Readonly<IAnalyticsTaskSample>[],
): readonly Readonly<IAnalyticsMechanismHealth>[] => {
  const discovery = discoverValidatedTaskArchetypes(samples);
  const assignmentBySample = new Map(
    discovery.assignments.map(({ archetype, sampleId }) => [sampleId, archetype] as const),
  );
  const groups = new Map<string, {
    id: string;
    kind: 'agent' | 'skill';
    samples: Readonly<IAnalyticsTaskSample>[];
    uses: NonNullable<Readonly<IAnalyticsTaskSample>['mechanisms']>[number][];
    version: string;
  }>();

  for (const sample of samples) {
    for (const use of sample.mechanisms ?? []) {
      const key = `${use.kind}:${use.id}:${use.version}`;
      const group = groups.get(key) ?? {
        id: use.id,
        kind: use.kind,
        samples: [],
        uses: [],
        version: use.version,
      };
      group.samples.push(sample);
      group.uses.push(use);
      groups.set(key, group);
    }
  }

  return Object.freeze(
    [...groups.values()]
      .sort((left, right) => `${left.kind}:${left.id}:${left.version}`.localeCompare(`${right.kind}:${right.id}:${right.version}`))
      .map((group) => {
        const taskSamples = Object.freeze(group.samples);
        const signals = summarizeSignals(taskSamples.length, group.uses);
        const assessment = assessMechanism(taskSamples, assignmentBySample, signals);
        const archetypeAssignments = discovery.assignments.filter(({ sampleId }) =>
          taskSamples.some((sample) => sample.sampleId === sampleId));
        const archetypeCounts = new Map<TTaskArchetype, number>();
        for (const { archetype } of archetypeAssignments) {
          archetypeCounts.set(archetype, (archetypeCounts.get(archetype) ?? 0) + 1);
        }
        const archetypes = Object.freeze(
          [...archetypeCounts.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([archetype, count]) => Object.freeze({
              archetype,
              confidence: getAnalyticsConfidence(count),
              count,
              share: round(count / taskSamples.length),
            })),
        );

        return Object.freeze({
          archetypes,
          assessment: assessment.assessment,
          causalClaim: false as const,
          confidence: getAnalyticsConfidence(taskSamples.length),
          failureClasses: summarizeFailureClasses(taskSamples),
          id: group.id,
          invocationCount: group.uses.reduce((sum, use) => sum + use.invocationCount, 0),
          kind: group.kind,
          outcomes: summarizeOutcomes(taskSamples),
          reasonCodes: assessment.reasonCodes,
          recovery: summarizeRecovery(taskSamples),
          signals,
          taskCount: taskSamples.length,
          usage: summarizeUsage(group.uses),
          version: group.version,
        });
      }),
  );
};


const summarizeTaskUsage = (
  samples: readonly Readonly<IAnalyticsTaskSample>[],
): Readonly<IAnalyticsMechanismUsageSummary> => Object.freeze({
  avgCostUnits: average(samples.flatMap(({ usage }) => usage?.costUnits === undefined ? [] : [usage.costUnits])),
  avgDurationMs: average(samples.flatMap(({ usage }) => usage?.durationMs === undefined ? [] : [usage.durationMs])),
  avgTokens: average(samples.flatMap(({ usage }) => usage?.tokens === undefined ? [] : [usage.tokens])),
});

const summarizeExecution = (
  samples: readonly Readonly<IAnalyticsTaskSample>[],
): Readonly<IAnalyticsRoutingExecutionSummary> => Object.freeze({
  avgContextItems: average(samples.flatMap(({ execution }) =>
    execution?.contextItems === undefined ? [] : [execution.contextItems])),
  avgWorkerCount: average(samples.flatMap(({ execution }) =>
    execution?.workerCount === undefined ? [] : [execution.workerCount])),
});

const routingChoicesForSample = (
  sample: Readonly<IAnalyticsTaskSample>,
): readonly Readonly<{ dimension: TAnalyticsRoutingHealthDimension; choice: string }>[] => {
  const strategy = sample.strategyDecision?.data;
  if (!strategy) return Object.freeze([]);

  const choices: Array<Readonly<{ dimension: TAnalyticsRoutingHealthDimension; choice: string }>> = [
    Object.freeze({ dimension: 'execution' as const, choice: strategy.execution }),
    Object.freeze({ dimension: 'scout' as const, choice: strategy.exploration === 'scout' ? 'with' : 'without' }),
    Object.freeze({ dimension: 'verifier' as const, choice: strategy.verification === 'verifier' ? 'with' : 'without' }),
    Object.freeze({ dimension: 'reviewer' as const, choice: strategy.review === 'reviewer' ? 'with' : 'without' }),
  ];

  if (strategy.computeProfile !== undefined) {
    choices.push(Object.freeze({ dimension: 'compute-profile' as const, choice: strategy.computeProfile }));
  }
  if (sample.execution?.reasoningEffort !== undefined) {
    choices.push(Object.freeze({ dimension: 'reasoning-effort' as const, choice: sample.execution.reasoningEffort }));
  }
  if (sample.execution?.workerCount !== undefined) {
    choices.push(Object.freeze({ dimension: 'worker-count' as const, choice: String(sample.execution.workerCount) }));
  }
  if (sample.execution?.contextItems !== undefined) {
    choices.push(Object.freeze({ dimension: 'context-items' as const, choice: String(sample.execution.contextItems) }));
  }

  return Object.freeze(choices);
};

const summarizeRoutingChoices = (
  samples: readonly Readonly<IAnalyticsTaskSample>[],
): readonly Readonly<IAnalyticsRoutingChoiceSummary>[] => {
  const groups = new Map<string, {
    choice: string;
    dimension: TAnalyticsRoutingHealthDimension;
    samples: Readonly<IAnalyticsTaskSample>[];
  }>();

  for (const sample of samples) {
    for (const { dimension, choice } of routingChoicesForSample(sample)) {
      const key = `${dimension}:${choice}`;
      const group = groups.get(key) ?? { choice, dimension, samples: [] };
      group.samples.push(sample);
      groups.set(key, group);
    }
  }

  return Object.freeze(
    [...groups.values()]
      .sort((left, right) => `${left.dimension}:${left.choice}`.localeCompare(`${right.dimension}:${right.choice}`))
      .map(({ choice, dimension, samples: groupSamples }) => Object.freeze({
        choice,
        confidence: getAnalyticsConfidence(groupSamples.length),
        dimension,
        execution: summarizeExecution(groupSamples),
        outcomes: summarizeOutcomes(groupSamples),
        recovery: summarizeRecovery(groupSamples),
        sampleSize: groupSamples.length,
        usage: summarizeTaskUsage(groupSamples),
      })),
  );
};

const summarizeRoutingCohorts = (
  samples: readonly Readonly<IAnalyticsTaskSample>[],
): readonly Readonly<IAnalyticsRoutingCohort>[] => {
  const discovery = discoverValidatedTaskArchetypes(samples);
  const archetypeBySample = new Map(
    discovery.assignments.map(({ archetype, sampleId }) => [sampleId, archetype] as const),
  );
  type CohortGroup = {
    archetype: TTaskArchetype;
    complexity: Readonly<IAnalyticsTaskSample>['taskAnalysis']['data']['classification']['dimensions']['complexity'];
    policyVersion: number;
    risk: Readonly<IAnalyticsTaskSample>['taskAnalysis']['data']['classification']['dimensions']['risk'];
    samples: Readonly<IAnalyticsTaskSample>[];
    scope: Readonly<IAnalyticsTaskSample>['taskAnalysis']['data']['classification']['dimensions']['scope'];
  };
  const cohorts = new Map<string, CohortGroup>();

  for (const sample of samples) {
    const strategy = sample.strategyDecision?.data;
    const archetype = archetypeBySample.get(sample.sampleId);
    if (!strategy || !archetype) continue;

    const { complexity, risk, scope } = sample.taskAnalysis.data.classification.dimensions;
    const key = [archetype, scope, complexity, risk, strategy.policyVersion].join('|');
    const group = cohorts.get(key) ?? {
      archetype,
      complexity,
      policyVersion: strategy.policyVersion,
      risk,
      samples: [],
      scope,
    };
    group.samples.push(sample);
    cohorts.set(key, group);
  }

  return Object.freeze(
    [...cohorts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([cohortId, group]) => Object.freeze({
        archetype: group.archetype,
        causalClaim: false as const,
        choices: summarizeRoutingChoices(group.samples),
        cohortId,
        complexity: group.complexity,
        confidence: getAnalyticsConfidence(group.samples.length),
        policyVersion: group.policyVersion,
        risk: group.risk,
        sampleSize: group.samples.length,
        scope: group.scope,
      })),
  );
};

const createSegment = (
  segmentId: string,
  samples: readonly Readonly<IAnalyticsTaskSample>[],
): Readonly<IAnalyticsHealthSegmentReport> => Object.freeze({
  mechanisms: summarizeMechanisms(samples),
  routingCohorts: summarizeRoutingCohorts(samples),
  sampleSize: samples.length,
  segmentId,
});

export const analyzeMechanismHealth = (
  value: unknown,
): Readonly<IAnalyticsHealthReport> => {
  const input = validateAnalyticsInput(value);
  const selection = selectAnalyticsSegments(input);

  return Object.freeze({
    kind: 'analytics-health-report' as const,
    overall: createSegment(selection.overall.segmentId, selection.overall.taskSamples),
    reportId: input.reportId,
    schemaVersion: ANALYTICS_VERSIONS.healthReportSchema,
    segments: Object.freeze(selection.segments.map((segment) =>
      createSegment(segment.segmentId, segment.taskSamples))),
    ...(input.window ? { window: input.window } : {}),
  });
};
