import { resolve } from 'node:path';

import { createAmyRuntime } from './create-amy-runtime.js';
import { AmyRuntimeError } from './errors/amy-runtime-error.js';

import type { AmyRuntime } from './kernel/amy-runtime.js';
import type { IPluginInventoryApi } from './compatibility/plugin-inventory.js';

type TCliCommand = 'capabilities' | 'config' | 'inventory' | 'status';

interface ICliArguments {
  command: TCliCommand;
  pluginRoot?: string;
  projectRoot: string;
}

const CLI_COMMANDS: readonly TCliCommand[] = [
  'capabilities',
  'config',
  'inventory',
  'status',
];

const checkIsCliCommand = (value: string): value is TCliCommand =>
  CLI_COMMANDS.some((command) => command === value);

const getOption = (args: readonly string[], name: string) => {
  const optionIndex = args.indexOf(name);

  if (optionIndex === -1) {
    return undefined;
  }

  const value = args[optionIndex + 1];

  if (!value || value.startsWith('--')) {
    throw new AmyRuntimeError({
      code: 'VALIDATION_FAILURE',
      details: { option: name },
      message: `CLI option ${name} requires a value`,
    });
  }

  return resolve(value);
};

const parseCliArguments = (args: readonly string[]): ICliArguments => {
  const command = args[0] ?? '';
  const knownArguments = new Set([
    command,
    '--plugin',
    '--project',
    getOption(args, '--plugin'),
    getOption(args, '--project'),
  ]);
  const unknownArguments = args.filter((argument) => !knownArguments.has(argument));

  if (!checkIsCliCommand(command) || unknownArguments.length > 0) {
    throw new AmyRuntimeError({
      code: 'VALIDATION_FAILURE',
      details: { command, unknownArguments },
      message: `Unknown Amy Runtime CLI command or option`,
    });
  }

  const pluginRoot = getOption(args, '--plugin');

  return {
    command,
    ...(pluginRoot ? { pluginRoot } : {}),
    projectRoot: getOption(args, '--project') ?? process.cwd(),
  };
};

const checkIsPluginInventoryApi = (
  value: unknown,
): value is IPluginInventoryApi =>
  typeof value === 'object' &&
  value !== null &&
  'load' in value &&
  typeof value.load === 'function';

const writeJson = (value: unknown, stream: NodeJS.WriteStream) => {
  stream.write(`${JSON.stringify(value, undefined, 2)}\n`);
};

const executeCommand = async (
  runtime: AmyRuntime,
  command: TCliCommand,
) => {
  if (command === 'config') {
    return runtime.config;
  }

  await runtime.start();

  if (command === 'status') {
    return runtime.getStatus();
  }

  if (command === 'capabilities') {
    return runtime.capabilities.list();
  }

  const capability = await runtime.resolveRequired('amy.plugin-inventory');

  if (!checkIsPluginInventoryApi(capability.api)) {
    throw new AmyRuntimeError({
      code: 'INCOMPATIBLE_CAPABILITY',
      details: { capabilityId: capability.descriptor.id },
      message: 'Plugin inventory capability API is incompatible',
    });
  }

  return capability.api.load();
};

const getExitCode = (error: AmyRuntimeError) => {
  if (
    error.code === 'INVALID_CONFIGURATION' ||
    error.code === 'VALIDATION_FAILURE'
  ) {
    return 2;
  }

  if (
    error.code === 'CAPABILITY_UNAVAILABLE' ||
    error.code === 'INCOMPATIBLE_CAPABILITY' ||
    error.code === 'CAPABILITY_EXECUTION_FAILURE'
  ) {
    return 3;
  }

  return 1;
};

export const runCli = async (args: readonly string[]) => {
  try {
    const cliArguments = parseCliArguments(args);
    const runtime = await createAmyRuntime({
      ...(cliArguments.pluginRoot
        ? { pluginRoot: cliArguments.pluginRoot }
        : {}),
      projectRoot: cliArguments.projectRoot,
    });
    const result = await executeCommand(runtime, cliArguments.command);

    writeJson(result, process.stdout);

    return 0;
  } catch (error) {
    const runtimeError =
      error instanceof AmyRuntimeError
        ? error
        : new AmyRuntimeError({
            cause: error,
            code: 'RUNTIME_INTERNAL_FAILURE',
            message: 'Amy Runtime CLI failed',
          });

    writeJson(
      {
        code: runtimeError.code,
        details: runtimeError.details,
        message: runtimeError.message,
      },
      process.stderr,
    );

    return getExitCode(runtimeError);
  }
};

process.exitCode = await runCli(process.argv.slice(2));
