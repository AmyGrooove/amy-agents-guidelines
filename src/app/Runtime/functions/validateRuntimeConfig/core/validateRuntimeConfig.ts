import { isRecord } from '#shared/functions/checks/isRecord';

import { AmyRuntimeError } from '#entities/runtime';
import { validateComputeRoutingConfig } from '#modules/ComputeRouting';
import { RUNTIME_VERSIONS } from '#entities/runtime';

import type {
  ICapabilityConfig,
  IRuntimeConfigOverrides,
} from '#entities/runtime';

interface IValidateRuntimeConfigProps {
  source: string;
  value: unknown;

  isSchemaRequired?: boolean;
}


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
  if (!isRecord(value)) {
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
  if (!isRecord(props.value)) {
    throw createInvalidConfigurationError(
      `Configuration in ${props.source} must be an object`,
      props.source,
    );
  }

  const allowedKeys = props.isSchemaRequired
    ? ['capabilities', 'compute', 'schemaVersion']
    : ['capabilities', 'compute'];
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
    !isRecord(props.value.capabilities)
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
  const compute =
    props.value.compute === undefined
      ? undefined
      : validateComputeRoutingConfig(props.value.compute, {
          allowPartialBindings: true,
          code: 'INVALID_CONFIGURATION',
          source: props.source,
        });

  return {
    ...(Object.keys(capabilities).length === 0 ? {} : { capabilities }),
    ...(compute ? { compute } : {}),
  };
};
