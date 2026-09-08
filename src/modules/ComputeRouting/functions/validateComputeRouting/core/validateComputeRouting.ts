import { isRecord } from '#shared/functions/checks/isRecord';

import { COMPUTE_PROFILES } from '#entities/computeProfile';
import { AmyRuntimeError } from '#entities/runtime';
import { validateTaskIntelligenceAnalysis } from '#entities/task';

import type {
  IComputeProfileBinding,
  IComputeRoutingConfig,
  IComputeTarget,
  TComputeProfile,
} from '#entities/computeProfile';
import type { TAmyRuntimeErrorCode } from '#entities/runtime';
import type { IComputeRoutingInput, TComputeRoutingMode } from '../../../types/computeRoutingContract.js';

interface IComputeConfigValidationOptions {
  allowPartialBindings?: boolean;
  code?: Extract<TAmyRuntimeErrorCode, 'INVALID_CONFIGURATION' | 'VALIDATION_FAILURE'>;
  source?: string;
}


const checkIsProfile = (value: unknown): value is TComputeProfile =>
  typeof value === 'string' &&
  COMPUTE_PROFILES.some((profile) => profile === value);

const createValidationError = (
  message: string,
  options: IComputeConfigValidationOptions = {},
) =>
  new AmyRuntimeError({
    code: options.code ?? 'VALIDATION_FAILURE',
    details: options.source ? { source: options.source } : {},
    message,
  });

const validateNonEmptyString = (
  value: unknown,
  field: string,
  options: IComputeConfigValidationOptions = {},
) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createValidationError(`${field} must be a non-empty string`, options);
  }

  return value.trim();
};

const validateStringList = (
  value: unknown,
  field: string,
  options: IComputeConfigValidationOptions = {},
): readonly string[] => {
  if (!Array.isArray(value)) {
    throw createValidationError(`${field} must be an array`, options);
  }

  const items = value.map((item) =>
    validateNonEmptyString(item, field, options),
  );

  if (new Set(items).size !== items.length) {
    throw createValidationError(`${field} must not contain duplicates`, options);
  }

  return Object.freeze(items);
};

const validateProfileBinding = (
  value: unknown,
  profile: TComputeProfile,
  options: IComputeConfigValidationOptions,
): Readonly<IComputeProfileBinding> => {
  if (!isRecord(value)) {
    throw createValidationError(
      `Compute profile ${profile} configuration must be an object`,
      options,
    );
  }

  const allowedKeys = ['fallbackModels', 'model', 'reasoningEffort'];
  const unknownKeys = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknownKeys.length > 0) {
    throw createValidationError(
      `Unknown compute profile fields for ${profile}: ${unknownKeys.join(', ')}`,
      options,
    );
  }

  const model =
    value.model === undefined
      ? undefined
      : validateNonEmptyString(value.model, `${profile}.model`, options);
  const reasoningEffort =
    value.reasoningEffort === undefined
      ? undefined
      : validateNonEmptyString(
          value.reasoningEffort,
          `${profile}.reasoningEffort`,
          options,
        );
  const fallbackModels =
    value.fallbackModels === undefined
      ? undefined
      : validateStringList(
          value.fallbackModels,
          `${profile}.fallbackModels`,
          options,
        );

  if (
    !options.allowPartialBindings &&
    !model &&
    (reasoningEffort || fallbackModels)
  ) {
    throw createValidationError(
      `${profile}.model is required when reasoningEffort or fallbackModels are configured`,
      options,
    );
  }

  if (model && fallbackModels?.includes(model)) {
    throw createValidationError(
      `${profile}.fallbackModels must not repeat the primary model`,
      options,
    );
  }

  return Object.freeze({
    ...(fallbackModels ? { fallbackModels } : {}),
    ...(model ? { model } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
  });
};

export const validateComputeRoutingConfig = (
  value: unknown,
  options: IComputeConfigValidationOptions = {},
): Readonly<IComputeRoutingConfig> => {
  if (!isRecord(value)) {
    throw createValidationError('Compute configuration must be an object', options);
  }

  const allowedKeys = ['defaultProfile', 'profiles'];
  const unknownKeys = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknownKeys.length > 0) {
    throw createValidationError(
      `Unknown compute configuration fields: ${unknownKeys.join(', ')}`,
      options,
    );
  }

  if (
    value.defaultProfile !== undefined &&
    !checkIsProfile(value.defaultProfile)
  ) {
    throw createValidationError('Compute defaultProfile is invalid', options);
  }

  if (value.profiles !== undefined && !isRecord(value.profiles)) {
    throw createValidationError('Compute profiles must be an object', options);
  }

  const rawProfiles = value.profiles ?? {};
  const unknownProfiles = Object.keys(rawProfiles).filter(
    (profile) => !checkIsProfile(profile),
  );

  if (unknownProfiles.length > 0) {
    throw createValidationError(
      `Unknown compute profiles: ${unknownProfiles.join(', ')}`,
      options,
    );
  }

  const profiles = Object.fromEntries(
    Object.entries(rawProfiles).map(([profile, binding]) => [
      profile,
      validateProfileBinding(binding, profile as TComputeProfile, options),
    ]),
  ) as Partial<Record<TComputeProfile, Readonly<IComputeProfileBinding>>>;

  return Object.freeze({
    ...(value.defaultProfile
      ? { defaultProfile: value.defaultProfile as TComputeProfile }
      : {}),
    ...(Object.keys(profiles).length > 0
      ? { profiles: Object.freeze(profiles) }
      : {}),
  });
};

const validateTarget = (value: unknown): Readonly<IComputeTarget> => {
  if (!isRecord(value)) {
    throw createValidationError('Compute routing target must be an object');
  }

  const allowedKeys = ['id', 'kind'];
  const unknownKeys = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknownKeys.length > 0) {
    throw createValidationError(
      `Unknown compute routing target fields: ${unknownKeys.join(', ')}`,
    );
  }

  if (value.kind !== 'task' && value.kind !== 'dag-node') {
    throw createValidationError('Compute routing target kind is invalid');
  }

  if (value.kind === 'dag-node') {
    return Object.freeze({
      id: validateNonEmptyString(value.id, 'target.id'),
      kind: 'dag-node',
    });
  }

  if (value.id !== undefined) {
    throw createValidationError('Task compute routing target must not have an id');
  }

  return Object.freeze({ kind: 'task' });
};

const checkIsMode = (value: unknown): value is TComputeRoutingMode =>
  value === 'initial' || value === 'upgrade' || value === 'downgrade';

export const validateComputeRoutingInput = (
  value: unknown,
): Readonly<IComputeRoutingInput> => {
  if (!isRecord(value)) {
    throw createValidationError('Compute routing input must be an object');
  }

  const allowedKeys = [
    'currentProfile',
    'mode',
    'requestedProfile',
    'target',
    'taskAnalysis',
    'unavailableModels',
  ];
  const unknownKeys = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknownKeys.length > 0) {
    throw createValidationError(
      `Unknown compute routing input fields: ${unknownKeys.join(', ')}`,
    );
  }

  const taskAnalysis = validateTaskIntelligenceAnalysis(value.taskAnalysis);
  const mode = value.mode ?? 'initial';

  if (!checkIsMode(mode)) {
    throw createValidationError('Compute routing mode is invalid');
  }

  if (
    value.currentProfile !== undefined &&
    !checkIsProfile(value.currentProfile)
  ) {
    throw createValidationError('Compute currentProfile is invalid');
  }

  if (
    value.requestedProfile !== undefined &&
    !checkIsProfile(value.requestedProfile)
  ) {
    throw createValidationError('Compute requestedProfile is invalid');
  }

  if (mode === 'initial' && value.currentProfile !== undefined) {
    throw createValidationError(
      'currentProfile is supported only for upgrade or downgrade routing',
    );
  }

  if (mode !== 'initial' && value.currentProfile === undefined) {
    throw createValidationError(
      'currentProfile is required for upgrade or downgrade routing',
    );
  }

  if (mode !== 'initial' && value.requestedProfile !== undefined) {
    throw createValidationError(
      'requestedProfile cannot be combined with upgrade or downgrade routing',
    );
  }

  const unavailableModels =
    value.unavailableModels === undefined
      ? undefined
      : validateStringList(value.unavailableModels, 'unavailableModels');
  const target =
    value.target === undefined
      ? Object.freeze({ kind: 'task' as const })
      : validateTarget(value.target);

  return Object.freeze({
    taskAnalysis,
    ...(value.currentProfile
      ? { currentProfile: value.currentProfile as TComputeProfile }
      : {}),
    ...(mode === 'initial' ? {} : { mode }),
    ...(value.requestedProfile
      ? { requestedProfile: value.requestedProfile as TComputeProfile }
      : {}),
    ...(value.target === undefined ? {} : { target }),
    ...(unavailableModels ? { unavailableModels } : {}),
  });
};
