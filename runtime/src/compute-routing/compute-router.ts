import { COMPUTE_PROFILES, COMPUTE_ROUTING_VERSIONS } from './compute-routing-contract.js';
import {
  validateComputeRoutingConfig,
  validateComputeRoutingInput,
} from './validate-compute-routing.js';

import type {
  IComputeAssignment,
  IComputeProfileBinding,
  IComputeRoutingConfig,
  IComputeRoutingDecision,
  TComputeProfile,
  TComputeReasonCode,
} from './compute-routing-contract.js';
import type { ITaskClassificationDimensions } from '../task-intelligence/task-intelligence-contract.js';

export interface IRouteComputeOptions {
  config?: Readonly<IComputeRoutingConfig>;
}

const getProfileIndex = (profile: TComputeProfile) =>
  COMPUTE_PROFILES.indexOf(profile);

const shiftProfile = (
  profile: TComputeProfile,
  direction: 'down' | 'up',
): TComputeProfile => {
  const currentIndex = getProfileIndex(profile);
  const nextIndex =
    direction === 'up'
      ? Math.min(COMPUTE_PROFILES.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);

  return COMPUTE_PROFILES[nextIndex] ?? profile;
};

const countHighSignals = (dimensions: Readonly<ITaskClassificationDimensions>) =>
  [
    dimensions.complexity,
    dimensions.coupling,
    dimensions.expectedContextCost,
    dimensions.risk,
    dimensions.uncertainty,
    dimensions.verificationCost,
  ].filter((value) => value === 'high').length;

const deriveInitialProfile = (
  dimensions: Readonly<ITaskClassificationDimensions>,
  defaultProfile: TComputeProfile,
  reasons: Set<TComputeReasonCode>,
): TComputeProfile => {
  const highSignals = countHighSignals(dimensions);

  if (
    highSignals >= 4 ||
    (dimensions.risk === 'high' && dimensions.blastRadius === 'repository')
  ) {
    reasons.add('heavy-task');

    return 'DEEP';
  }

  if (
    highSignals >= 1 ||
    dimensions.scope === 'repository' ||
    dimensions.blastRadius === 'repository'
  ) {
    reasons.add('heavy-task');

    return 'ADVANCED';
  }

  if (
    dimensions.scope === 'local' &&
    dimensions.blastRadius === 'local' &&
    dimensions.complexity === 'low' &&
    dimensions.coupling === 'low' &&
    dimensions.uncertainty === 'low' &&
    dimensions.verificationCost === 'low' &&
    dimensions.risk !== 'high' &&
    dimensions.risk !== 'medium'
  ) {
    reasons.add('lightweight-task');

    return 'FAST';
  }

  if (defaultProfile !== 'STANDARD') {
    reasons.add('default-profile');

    return defaultProfile;
  }

  reasons.add('standard-task');

  return 'STANDARD';
};

const getBindingCandidates = (
  binding: Readonly<IComputeProfileBinding> | undefined,
): readonly string[] =>
  Object.freeze([
    ...(binding?.model ? [binding.model] : []),
    ...(binding?.fallbackModels ?? []),
  ]);

const resolveAssignmentForProfile = (
  profile: TComputeProfile,
  config: Readonly<IComputeRoutingConfig>,
  unavailableModels: ReadonlySet<string>,
): Readonly<IComputeAssignment> | undefined => {
  const binding = config.profiles?.[profile];
  const candidates = getBindingCandidates(binding);

  if (candidates.length === 0) {
    return Object.freeze({ status: 'unmapped' });
  }

  const availableIndex = candidates.findIndex(
    (model) => !unavailableModels.has(model),
  );

  if (availableIndex === -1) {
    return undefined;
  }

  const model = candidates[availableIndex];

  if (!model) {
    return undefined;
  }

  return Object.freeze({
    model,
    ...(binding?.reasoningEffort
      ? { reasoningEffort: binding.reasoningEffort }
      : {}),
    status: availableIndex === 0 ? 'mapped' : 'fallback',
  });
};

const resolveMappedAssignment = (
  initialProfile: TComputeProfile,
  config: Readonly<IComputeRoutingConfig>,
  unavailableModels: ReadonlySet<string>,
  reasons: Set<TComputeReasonCode>,
): Readonly<{
  assignment: Readonly<IComputeAssignment>;
  profile: TComputeProfile;
}> => {
  const initialBinding = config.profiles?.[initialProfile];
  const initialCandidates = getBindingCandidates(initialBinding);
  const initialAssignment = resolveAssignmentForProfile(
    initialProfile,
    config,
    unavailableModels,
  );

  if (initialAssignment) {
    if (initialAssignment.status === 'mapped') {
      reasons.add('model-mapped');
    } else if (initialAssignment.status === 'fallback') {
      reasons.add('model-fallback');
    }

    return Object.freeze({
      assignment: initialAssignment,
      profile: initialProfile,
    });
  }

  if (initialCandidates.length === 0) {
    return Object.freeze({
      assignment: Object.freeze({ status: 'unmapped' as const }),
      profile: initialProfile,
    });
  }

  reasons.add('model-unavailable');

  const initialIndex = getProfileIndex(initialProfile);

  for (let index = initialIndex + 1; index < COMPUTE_PROFILES.length; index += 1) {
    const profile = COMPUTE_PROFILES[index];

    if (!profile) {
      continue;
    }

    const binding = config.profiles?.[profile];
    const candidates = getBindingCandidates(binding);

    if (candidates.length === 0) {
      continue;
    }

    const assignment = resolveAssignmentForProfile(
      profile,
      config,
      unavailableModels,
    );

    if (!assignment || assignment.status === 'unmapped') {
      continue;
    }

    if (assignment.status === 'fallback') {
      reasons.add('model-fallback');
    }
    reasons.add('profile-escalated');

    return Object.freeze({
      assignment: Object.freeze({
        ...(assignment.model ? { model: assignment.model } : {}),
        ...(assignment.reasoningEffort
          ? { reasoningEffort: assignment.reasoningEffort }
          : {}),
        status: 'escalated',
      }),
      profile,
    });
  }

  return Object.freeze({
    assignment: Object.freeze({ status: 'unavailable' as const }),
    profile: initialProfile,
  });
};

export const routeCompute = (
  value: unknown,
  options: IRouteComputeOptions = {},
): Readonly<IComputeRoutingDecision> => {
  const input = validateComputeRoutingInput(value);
  const config = validateComputeRoutingConfig(options.config ?? {});
  const reasons = new Set<TComputeReasonCode>();
  const defaultProfile = config.defaultProfile ?? 'STANDARD';
  const mode = input.mode ?? 'initial';
  let profile: TComputeProfile;

  if (mode === 'upgrade') {
    profile = shiftProfile(input.currentProfile ?? defaultProfile, 'up');
    reasons.add('profile-upgraded');
  } else if (mode === 'downgrade') {
    profile = shiftProfile(input.currentProfile ?? defaultProfile, 'down');
    reasons.add('profile-downgraded');
  } else if (input.requestedProfile) {
    profile = input.requestedProfile;
    reasons.add('profile-requested');
  } else {
    profile = deriveInitialProfile(
      input.taskAnalysis.data.classification.dimensions,
      defaultProfile,
      reasons,
    );
  }

  const unavailableModels = new Set(input.unavailableModels ?? []);
  const resolved = resolveMappedAssignment(
    profile,
    config,
    unavailableModels,
    reasons,
  );

  return Object.freeze({
    assignment: resolved.assignment,
    confidence: input.taskAnalysis.data.classification.confidence,
    profile: resolved.profile,
    reasonCodes: Object.freeze([...reasons].sort()),
    schemaVersion: COMPUTE_ROUTING_VERSIONS.decisionSchema,
    target: input.target ?? Object.freeze({ kind: 'task' as const }),
  });
};
