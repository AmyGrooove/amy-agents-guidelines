import { ANALYTICS_VERSIONS } from './analytics-contract.js';
import { selectAnalyticsSegments } from './analytics-selection.js';
import {
  discoverValidatedTaskArchetypes,
  getAnalyticsConfidence,
} from './task-archetypes.js';
import { validateAnalyticsInput } from './validate-analytics.js';

import type { IObservabilityPolicyRef } from '../observability/observability-contract.js';
import type { TOutcomeFailureClass } from '../outcome-intelligence/outcome-intelligence-contract.js';
import type {
  IAnalyticsEvalRunSample,
  IAnalyticsFailureClassSummary,
  IAnalyticsFinding,
  IAnalyticsInput,
  IAnalyticsMetric,
  IAnalyticsReport,
  IAnalyticsSegmentDefinition,
  IAnalyticsSegmentReport,
  IAnalyticsTaskSample,
  IAnalyticsWindow,
  ITaskArchetypeAssignment,
  TAnalyticsMetricId,
  TAnalyticsMetricUnit,
  TTaskArchetype,
} from './analytics-contract.js';

const round = (value: number, precision = 4) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const metric = (
  id: TAnalyticsMetricId,
  unit: TAnalyticsMetricUnit,
  values: readonly number[],
  aggregate: 'average' | 'count' | 'ratio' = 'average',
): Readonly<IAnalyticsMetric> => {
  const sampleSize = values.length;
  const value = aggregate === 'count'
    ? sampleSize
    : sampleSize === 0
      ? null
      : aggregate === 'ratio'
        ? round(values.reduce((sum, item) => sum + item, 0) / sampleSize)
        : round(values.reduce((sum, item) => sum + item, 0) / sampleSize, 2);

  return Object.freeze({
    confidence: getAnalyticsConfidence(sampleSize),
    id,
    sampleSize,
    unit,
    value,
  });
};

const summarizeFailures = (
  taskSamples: readonly Readonly<IAnalyticsTaskSample>[],
): readonly Readonly<IAnalyticsFailureClassSummary>[] => {
  const counts = new Map<TOutcomeFailureClass, number>();

  for (const sample of taskSamples) {
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

const createFindings = (
  taskSamples: readonly Readonly<IAnalyticsTaskSample>[],
  failureClasses: readonly Readonly<IAnalyticsFailureClassSummary>[],
  metrics: readonly Readonly<IAnalyticsMetric>[],
): readonly Readonly<IAnalyticsFinding>[] => {
  const findings: IAnalyticsFinding[] = [];

  if (taskSamples.length > 0 && taskSamples.length < 5) {
    findings.push(Object.freeze({
      causalClaim: false as const,
      confidence: 'low' as const,
      findingId: 'sample-size:small',
      metricIds: Object.freeze(['task.count' as const]),
      observation: `Selected segment contains only ${taskSamples.length} task samples.`,
      recommendation: 'Collect more comparable samples before changing Amy policy.',
      sampleSize: taskSamples.length,
    }));
  }

  const recurring = failureClasses.find(({ count, share }) => count >= 2 && share >= 0.5);

  if (recurring && taskSamples.length >= 5) {
    findings.push(Object.freeze({
      causalClaim: false as const,
      confidence: getAnalyticsConfidence(taskSamples.length),
      findingId: `recurring-failure:${recurring.failureClass}`,
      hypothesis: `The selected segment may contain a recurring ${recurring.failureClass} failure pattern.`,
      metricIds: Object.freeze(['outcome.failure-rate' as const]),
      observation: `${recurring.failureClass} accounts for ${round(recurring.share * 100, 2)}% of classified failures in the selected segment.`,
      recommendation: `Inspect representative ${recurring.failureClass} failures before proposing a routing or policy change.`,
      sampleSize: taskSamples.length,
    }));
  }

  const unverified = metrics.find(({ id }) => id === 'outcome.unverified-rate');

  if (
    unverified?.value !== null &&
    unverified !== undefined &&
    unverified.sampleSize >= 5 &&
    unverified.value >= 0.25
  ) {
    findings.push(Object.freeze({
      causalClaim: false as const,
      confidence: unverified.confidence,
      findingId: 'verification:unverified-rate',
      hypothesis: 'The selected segment may have insufficient verification evidence.',
      metricIds: Object.freeze(['outcome.unverified-rate' as const]),
      observation: `${round(unverified.value * 100, 2)}% of outcomes are unverified in the selected segment.`,
      recommendation: 'Inspect unverified task evidence before changing verification policy.',
      sampleSize: unverified.sampleSize,
    }));
  }

  return Object.freeze(findings);
};

const createMetrics = (
  taskSamples: readonly Readonly<IAnalyticsTaskSample>[],
  evalRunSamples: readonly Readonly<IAnalyticsEvalRunSample>[],
): readonly Readonly<IAnalyticsMetric>[] => {
  const outcomes = taskSamples.flatMap((sample) =>
    sample.outcomeAssessment ? [sample.outcomeAssessment] : [],
  );
  const strategies = taskSamples.flatMap((sample) =>
    sample.strategyDecision ? [sample.strategyDecision] : [],
  );
  const usage = taskSamples.flatMap((sample) => sample.usage ? [sample.usage] : []);
  const evalCases = evalRunSamples.flatMap(({ run }) => run.caseResults);

  return Object.freeze([
    metric('task.count', 'count', taskSamples.map(() => 1), 'count'),
    metric('outcome.success-rate', 'ratio', outcomes.map(({ status }) => status === 'success' ? 1 : 0), 'ratio'),
    metric('outcome.failure-rate', 'ratio', outcomes.map(({ status }) => status === 'failure' ? 1 : 0), 'ratio'),
    metric('outcome.partial-success-rate', 'ratio', outcomes.map(({ status }) => status === 'partial_success' ? 1 : 0), 'ratio'),
    metric('outcome.unverified-rate', 'ratio', outcomes.map(({ status }) => status === 'unverified' ? 1 : 0), 'ratio'),
    metric('outcome.unknown-rate', 'ratio', outcomes.map(({ status }) => status === 'unknown' ? 1 : 0), 'ratio'),
    metric('recovery.avg-retries', 'count', outcomes.map(({ attempts }) => attempts.retryCount)),
    metric('recovery.avg-escalations', 'count', outcomes.map(({ attempts }) => attempts.escalationCount)),
    metric('strategy.fast-path-rate', 'ratio', strategies.map(({ data }) => data.fastPath ? 1 : 0), 'ratio'),
    metric('strategy.scout-rate', 'ratio', strategies.map(({ data }) => data.exploration === 'scout' ? 1 : 0), 'ratio'),
    metric('strategy.verifier-rate', 'ratio', strategies.map(({ data }) => data.verification === 'verifier' ? 1 : 0), 'ratio'),
    metric('strategy.reviewer-rate', 'ratio', strategies.map(({ data }) => data.review === 'reviewer' ? 1 : 0), 'ratio'),
    metric('usage.avg-duration-ms', 'milliseconds', usage.flatMap(({ durationMs }) => durationMs === undefined ? [] : [durationMs])),
    metric('usage.avg-tokens', 'tokens', usage.flatMap(({ tokens }) => tokens === undefined ? [] : [tokens])),
    metric('usage.avg-cost-units', 'cost-units', usage.flatMap(({ costUnits }) => costUnits === undefined ? [] : [costUnits])),
    metric('eval.avg-score', 'score', evalRunSamples.map(({ run }) => run.score)),
    metric('eval.case-pass-rate', 'ratio', evalCases.map(({ status }) => status === 'passed' ? 1 : 0), 'ratio'),
  ]);
};

const createSegmentReport = (
  segmentId: string,
  taskSamples: readonly Readonly<IAnalyticsTaskSample>[],
  evalRunSamples: readonly Readonly<IAnalyticsEvalRunSample>[],
): Readonly<IAnalyticsSegmentReport> => {
  const discovery = discoverValidatedTaskArchetypes(taskSamples);
  const failureClasses = summarizeFailures(taskSamples);
  const metrics = createMetrics(taskSamples, evalRunSamples);

  return Object.freeze({
    archetypes: discovery.summaries,
    evalRunCount: evalRunSamples.length,
    failureClasses,
    findings: createFindings(taskSamples, failureClasses, metrics),
    metrics,
    sampleSize: taskSamples.length,
    segmentId,
  });
};

const buildReport = (input: Readonly<IAnalyticsInput>): Readonly<IAnalyticsReport> => {
  const selection = selectAnalyticsSegments(input);

  return Object.freeze({
    kind: 'analytics-report' as const,
    overall: createSegmentReport(
      selection.overall.segmentId,
      selection.overall.taskSamples,
      selection.overall.evalRunSamples,
    ),
    reportId: input.reportId,
    schemaVersion: ANALYTICS_VERSIONS.reportSchema,
    segments: Object.freeze(selection.segments.map((segment) => createSegmentReport(
      segment.segmentId,
      segment.taskSamples,
      segment.evalRunSamples,
    ))),
    ...(input.window === undefined ? {} : { window: input.window }),
  });
};

export const analyzeAmyData = (value: unknown): Readonly<IAnalyticsReport> =>
  buildReport(validateAnalyticsInput(value));
