import { discoverValidatedTaskArchetypes } from './task-archetypes.js';

import type { IObservabilityPolicyRef } from '../observability/observability-contract.js';
import type {
  IAnalyticsEvalRunSample,
  IAnalyticsInput,
  IAnalyticsTaskSample,
  IAnalyticsWindow,
  TTaskArchetype,
} from './analytics-contract.js';

export interface IAnalyticsSelectedSegment {
  evalRunSamples: readonly Readonly<IAnalyticsEvalRunSample>[];
  segmentId: string;
  taskSamples: readonly Readonly<IAnalyticsTaskSample>[];
}

export interface IAnalyticsSelection {
  overall: Readonly<IAnalyticsSelectedSegment>;
  segments: readonly Readonly<IAnalyticsSelectedSegment>[];
}

const matchesWindow = (
  observedAt: string,
  window: Readonly<IAnalyticsWindow> | undefined,
) => {
  if (!window) return true;

  const observed = Date.parse(observedAt);
  if (window.fromInclusive !== undefined && observed < Date.parse(window.fromInclusive)) return false;
  if (window.toExclusive !== undefined && observed >= Date.parse(window.toExclusive)) return false;

  return true;
};

const policyKey = ({ owner, version }: Readonly<IObservabilityPolicyRef>) => `${owner}:${version}`;

const matchesPolicies = (
  samplePolicies: readonly Readonly<IObservabilityPolicyRef>[],
  filterPolicies: readonly Readonly<IObservabilityPolicyRef>[] | undefined,
) => {
  if (!filterPolicies || filterPolicies.length === 0) return true;

  const available = new Set(samplePolicies.map(policyKey));
  return filterPolicies.every((policy) => available.has(policyKey(policy)));
};

const matchesArchetypes = (
  sampleId: string,
  assignments: ReadonlyMap<string, TTaskArchetype>,
  archetypes: readonly TTaskArchetype[] | undefined,
) => {
  if (!archetypes || archetypes.length === 0) return true;
  const archetype = assignments.get(sampleId);
  return archetype !== undefined && archetypes.includes(archetype);
};

export const selectAnalyticsSegments = (
  input: Readonly<IAnalyticsInput>,
): Readonly<IAnalyticsSelection> => {
  const taskSamples = Object.freeze(
    input.taskSamples.filter(({ observedAt }) => matchesWindow(observedAt, input.window)),
  );
  const evalRunSamples = Object.freeze(
    input.evalRunSamples.filter(({ observedAt }) => matchesWindow(observedAt, input.window)),
  );
  const discovery = discoverValidatedTaskArchetypes(taskSamples);
  const assignments = new Map(
    discovery.assignments.map(({ archetype, sampleId }) => [sampleId, archetype] as const),
  );

  const segments = input.segments.map((segment) => {
    const selectedTaskSamples = Object.freeze(taskSamples.filter((sample) =>
      matchesPolicies(sample.policyRefs, segment.policyRefs) &&
      matchesArchetypes(sample.sampleId, assignments, segment.archetypes)));
    const selectedEvalRunSamples = segment.archetypes
      ? Object.freeze([] as Readonly<IAnalyticsEvalRunSample>[])
      : Object.freeze(evalRunSamples.filter((sample) => matchesPolicies(sample.policyRefs, segment.policyRefs)));

    return Object.freeze({
      evalRunSamples: selectedEvalRunSamples,
      segmentId: segment.segmentId,
      taskSamples: selectedTaskSamples,
    });
  });

  return Object.freeze({
    overall: Object.freeze({
      evalRunSamples,
      segmentId: 'overall',
      taskSamples,
    }),
    segments: Object.freeze(segments),
  });
};
