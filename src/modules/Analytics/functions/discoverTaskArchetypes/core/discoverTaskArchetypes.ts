import {
  ANALYTICS_LIMITS,
  ANALYTICS_VERSIONS,
} from '../../../types/analyticsContract.js';
import { validateTaskArchetypeDiscoveryInput } from '../../validateAnalytics/core/validateAnalytics.js';

import type {
  IAnalyticsTaskSample,
  ITaskArchetypeAssignment,
  ITaskArchetypeDiscovery,
  ITaskArchetypeSummary,
  TAnalyticsConfidence,
  TTaskArchetype,
  TTaskArchetypeReasonCode,
} from '../../../types/analyticsContract.js';

const ARCHETYPE_ORDER: readonly TTaskArchetype[] = Object.freeze([
  'bug-investigation',
  'testing',
  'refactor',
  'api-propagation',
  'exploration',
  'feature-modification',
  'other',
]);

const SIGNALS: ReadonlyArray<Readonly<{
  archetype: TTaskArchetype;
  pattern: RegExp;
  reasonCode: TTaskArchetypeReasonCode;
}>> = Object.freeze([
  Object.freeze({
    archetype: 'bug-investigation' as const,
    pattern: /\b(bug|broken|error|failure|regression|fix|debug)\b|баг|ошиб|слом|регресс|исправ|почин/i,
    reasonCode: 'bug-signal' as const,
  }),
  Object.freeze({
    archetype: 'testing' as const,
    pattern: /\b(test|tests|testing|spec|coverage)\b|тест|покрыт/i,
    reasonCode: 'testing-signal' as const,
  }),
  Object.freeze({
    archetype: 'refactor' as const,
    pattern: /\b(refactor|restructure|migration|migrate|rename)\b|рефактор|реструктур|миграц|переимен/i,
    reasonCode: 'refactor-signal' as const,
  }),
  Object.freeze({
    archetype: 'api-propagation' as const,
    pattern: /\b(api|endpoint|contract|schema|dto|propagate|propagation)\b|апи|эндпоинт|контракт|схем|протян/i,
    reasonCode: 'api-signal' as const,
  }),
  Object.freeze({
    archetype: 'exploration' as const,
    pattern: /\b(explore|investigate|understand|analyze|analyse|research)\b|исслед|разбер|проанализ|изуч|найд/i,
    reasonCode: 'exploration-signal' as const,
  }),
  Object.freeze({
    archetype: 'feature-modification' as const,
    pattern: /\b(add|create|implement|feature|support|change|update)\b|добав|созда|реализ|поддерж|измен|обнов/i,
    reasonCode: 'feature-signal' as const,
  }),
]);

export const getAnalyticsConfidence = (sampleSize: number): TAnalyticsConfidence => {
  if (sampleSize === 0) return 'insufficient';
  if (sampleSize < 5) return 'low';
  if (sampleSize < 20) return 'medium';
  return 'high';
};

const createTaskText = (sample: Readonly<IAnalyticsTaskSample>) => {
  const { contract } = sample.taskAnalysis.data;

  return [
    contract.goal,
    ...(contract.requirements ?? []),
    ...(contract.acceptanceCriteria ?? []),
    ...(contract.constraints ?? []),
  ].join('\n');
};

const classifyArchetype = (
  sample: Readonly<IAnalyticsTaskSample>,
): Readonly<ITaskArchetypeAssignment> => {
  const text = createTaskText(sample);
  const signal = SIGNALS.find(({ pattern }) => pattern.test(text));

  if (!signal) {
    return Object.freeze({
      archetype: 'other' as const,
      confidence: 'low' as const,
      reasonCodes: Object.freeze(['fallback-other' as const]),
      sampleId: sample.sampleId,
    });
  }

  return Object.freeze({
    archetype: signal.archetype,
    confidence: 'medium' as const,
    reasonCodes: Object.freeze([signal.reasonCode]),
    sampleId: sample.sampleId,
  });
};

const summarize = (
  assignments: readonly Readonly<ITaskArchetypeAssignment>[],
): readonly Readonly<ITaskArchetypeSummary>[] => {
  const sampleSize = assignments.length;
  const summaries = ARCHETYPE_ORDER
    .map((archetype) => {
      const count = assignments.filter((assignment) => assignment.archetype === archetype).length;

      return Object.freeze({
        archetype,
        confidence: getAnalyticsConfidence(count),
        count,
        share: sampleSize === 0 ? 0 : Math.round((count / sampleSize) * 10_000) / 10_000,
      });
    })
    .filter(({ count }) => count > 0);

  return Object.freeze(summaries);
};

export const discoverValidatedTaskArchetypes = (
  taskSamples: readonly Readonly<IAnalyticsTaskSample>[],
): Readonly<ITaskArchetypeDiscovery> => {
  const assignments = Object.freeze(taskSamples.map(classifyArchetype));

  return Object.freeze({
    assignments,
    kind: 'task-archetype-discovery' as const,
    sampleSize: taskSamples.length,
    schemaVersion: ANALYTICS_VERSIONS.archetypeSchema,
    status:
      taskSamples.length >= ANALYTICS_LIMITS.minArchetypeSampleSize
        ? ('ready' as const)
        : ('insufficient-sample' as const),
    summaries: summarize(assignments),
  });
};

export const discoverTaskArchetypes = (
  value: unknown,
): Readonly<ITaskArchetypeDiscovery> => {
  const input = validateTaskArchetypeDiscoveryInput(value);

  return discoverValidatedTaskArchetypes(input.taskSamples);
};
