import { AmyRuntimeError } from '../errors/amy-runtime-error.js';
import { RUNTIME_VERSIONS } from '../versions.js';

import type {
  ICapabilityConfig,
  IRuntimeConfigOverrides,
} from './runtime-config.js';

interface IValidateRuntimeConfigProps {
  source: string;
  value: unknown;

  isSchemaRequired?: boolean;
}

const checkIsRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createInvalidConfigurationError = (
  message: string,
  source: string,
) =>
  new AmyRuntimeError({
    code: 'INVALID_CONFIGURATION',
    details: { source },
    message,
  });

const validateCapabilityConfig = (
  value: unknown,
  source: string,
): Readonly<ICapabilityConfig> => {
  if (!checkIsRecord(value)) {
    throw createInvalidConfigurationError(
      `Capability configuration in ${source} must be an object`,
      source,
    );
  }

  const unknownKeys = Object.keys(value).filter(
    (key) => key !== 'enabled' && key !== 'required',
  );

  if (unknownKeys.length > 0) {
    throw createInvalidConfigurationError(
      `Unknown capability configuration fields in ${source}: ${unknownKeys.join(', ')}`,
      source,
    );
  }

  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
    throw createInvalidConfigurationError(
      `Capability enabled flag in ${source} must be boolean`,
      source,
    );
  }

  if (value.required !== undefined && typeof value.required !== 'boolean') {
    throw createInvalidConfigurationError(
      `Capability required flag in ${source} must be boolean`,
      source,
    );
  }

  return {
    ...(value.enabled === undefined ? {} : { enabled: value.enabled }),
    ...(value.required === undefined ? {} : { required: value.required }),
  };
};

export const validateRuntimeConfig = (
  props: IValidateRuntimeConfigProps,
): IRuntimeConfigOverrides => {
  if (!checkIsRecord(props.value)) {
    throw createInvalidConfigurationError(
      `Configuration in ${props.source} must be an object`,
      props.source,
    );
  }

  const allowedKeys = props.isSchemaRequired
    ? ['capabilities', 'schemaVersion']
    : ['capabilities'];
  const unknownKeys = Object.keys(props.value).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknownKeys.length > 0) {
    throw createInvalidConfigurationError(
      `Unknown configuration fields in ${props.source}: ${unknownKeys.join(', ')}`,
      props.source,
    );
  }

  if (
    props.isSchemaRequired &&
    props.value.schemaVersion !== RUNTIME_VERSIONS.configSchema
  ) {
    throw createInvalidConfigurationError(
      `Unsupported configuration schema in ${props.source}`,
      props.source,
    );
  }

  if (
    props.value.capabilities !== undefined &&
    !checkIsRecord(props.value.capabilities)
  ) {
    throw createInvalidConfigurationError(
      `Capabilities in ${props.source} must be an object`,
      props.source,
    );
  }

  const capabilities = Object.fromEntries(
    Object.entries(props.value.capabilities ?? {}).map(([id, value]) => [
      id,
      validateCapabilityConfig(value, `${props.source}:${id}`),
    ]),
  );

  return Object.keys(capabilities).length === 0 ? {} : { capabilities };
};
