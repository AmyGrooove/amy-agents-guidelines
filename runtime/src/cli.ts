import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createAmyRuntime } from './create-amy-runtime.js';
import { AmyRuntimeError } from './errors/amy-runtime-error.js';
import { createProjectIntelligenceCapability } from './project-intelligence/project-intelligence-capability.js';

import type { AmyRuntime } from './kernel/amy-runtime.js';
import type { IPluginInventoryApi } from './compatibility/plugin-inventory.js';
import type { IProjectIntelligenceApi } from './project-intelligence/project-intelligence-contract.js';

type TCliCommand =
  | 'capabilities'
  | 'config'
  | 'intelligence-discover'
  | 'intelligence-freshness-refresh'
  | 'intelligence-freshness-show'
  | 'intelligence-graph-build'
  | 'intelligence-graph-save'
  | 'intelligence-graph-show'
  | 'intelligence-impact'
  | 'intelligence-save'
  | 'intelligence-show'
  | 'intelligence-sync-router'
  | 'inventory'
  | 'status';

interface ICliArguments {
  command: TCliCommand;
  pluginRoot?: string;
  projectRoot: string;

  inputPath?: string;
  moduleId?: string;
  owner?: string;
}

const CLI_COMMANDS: readonly TCliCommand[] = [
  'capabilities',
  'config',
  'intelligence-discover',
  'intelligence-freshness-refresh',
  'intelligence-freshness-show',
  'intelligence-graph-build',
  'intelligence-graph-save',
  'intelligence-graph-show',
  'intelligence-impact',
  'intelligence-save',
  'intelligence-show',
  'intelligence-sync-router',
  'inventory',
  'status',
];

const PROJECT_INTELLIGENCE_COMMANDS: readonly TCliCommand[] = [
  'intelligence-discover',
  'intelligence-freshness-refresh',
  'intelligence-freshness-show',
  'intelligence-graph-build',
  'intelligence-graph-save',
  'intelligence-graph-show',
  'intelligence-impact',
  'intelligence-save',
  'intelligence-show',
  'intelligence-sync-router',
];

const checkIsCliCommand = (value: string): value is TCliCommand =>
  CLI_COMMANDS.some((command) => command === value);

const getOptionValue = (args: readonly string[], name: string) => {
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

  return value;
};

const parseCliArguments = (args: readonly string[]): ICliArguments => {
  const command = args[0] ?? '';
  const inputValue = getOptionValue(args, '--input');
  const moduleValue = getOptionValue(args, '--module');
  const ownerValue = getOptionValue(args, '--owner');
  const pluginValue = getOptionValue(args, '--plugin');
  const projectValue = getOptionValue(args, '--project');
  const knownArguments = new Set([
    command,
    '--input',
    '--module',
    '--owner',
    '--plugin',
    '--project',
    inputValue,
    moduleValue,
    ownerValue,
    pluginValue,
    projectValue,
  ]);
  const unknownArguments = args.filter((argument) => !knownArguments.has(argument));

  if (!checkIsCliCommand(command) || unknownArguments.length > 0) {
    throw new AmyRuntimeError({
      code: 'VALIDATION_FAILURE',
      details: { command, unknownArguments },
      message: `Unknown Amy Runtime CLI command or option`,
    });
  }

  const inputCommands: readonly TCliCommand[] = [
    'intelligence-graph-save',
    'intelligence-save',
  ];

  if (inputCommands.includes(command) !== Boolean(inputValue)) {
    throw new AmyRuntimeError({
      code: 'VALIDATION_FAILURE',
      details: { command, inputValue },
      message:
        'CLI option --input is required only for intelligence-save and intelligence-graph-save',
    });
  }

  if (
    (command === 'intelligence-impact' && !moduleValue) ||
    (command !== 'intelligence-impact' && moduleValue)
  ) {
    throw new AmyRuntimeError({
      code: 'VALIDATION_FAILURE',
      details: { command, moduleValue },
      message: 'CLI option --module is required only for intelligence-impact',
    });
  }

  const freshnessCommands: readonly TCliCommand[] = [
    'intelligence-freshness-refresh',
    'intelligence-freshness-show',
  ];

  if (ownerValue && !freshnessCommands.includes(command)) {
    throw new AmyRuntimeError({
      code: 'VALIDATION_FAILURE',
      details: { command, ownerValue },
      message: 'CLI option --owner is supported only for freshness commands',
    });
  }

  const inputPath = inputValue ? resolve(inputValue) : undefined;
  const pluginRoot = pluginValue ? resolve(pluginValue) : undefined;

  return {
    command,
    ...(inputPath ? { inputPath } : {}),
    ...(moduleValue ? { moduleId: moduleValue } : {}),
    ...(ownerValue ? { owner: ownerValue } : {}),
    ...(pluginRoot ? { pluginRoot } : {}),
    projectRoot: projectValue ? resolve(projectValue) : process.cwd(),
  };
};

const checkIsPluginInventoryApi = (
  value: unknown,
): value is IPluginInventoryApi =>
  typeof value === 'object' &&
  value !== null &&
  'load' in value &&
  typeof value.load === 'function';

const checkIsProjectIntelligenceApi = (
  value: unknown,
): value is IProjectIntelligenceApi =>
  typeof value === 'object' &&
  value !== null &&
  'discover' in value &&
  typeof value.discover === 'function' &&
  'assessFreshness' in value &&
  typeof value.assessFreshness === 'function' &&
  'refreshFreshness' in value &&
  typeof value.refreshFreshness === 'function' &&
  'rebuildGraph' in value &&
  typeof value.rebuildGraph === 'function' &&
  'loadGraph' in value &&
  typeof value.loadGraph === 'function' &&
  'saveGraph' in value &&
  typeof value.saveGraph === 'function' &&
  'analyzeImpact' in value &&
  typeof value.analyzeImpact === 'function' &&
  'saveKnowledge' in value &&
  typeof value.saveKnowledge === 'function' &&
  'loadKnowledge' in value &&
  typeof value.loadKnowledge === 'function' &&
  'syncAgentsRouter' in value &&
  typeof value.syncAgentsRouter === 'function';

const writeJson = (value: unknown, stream: NodeJS.WriteStream) => {
  stream.write(`${JSON.stringify(value, undefined, 2)}\n`);
};

const executeCommand = async (
  runtime: AmyRuntime,
  command: TCliCommand,
  inputPath?: string,
  moduleId?: string,
  owner?: string,
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

  if (PROJECT_INTELLIGENCE_COMMANDS.includes(command)) {
    const capability = await runtime.resolveRequired(
      'amy.project-intelligence',
    );

    if (!checkIsProjectIntelligenceApi(capability.api)) {
      throw new AmyRuntimeError({
        code: 'INCOMPATIBLE_CAPABILITY',
        details: { capabilityId: capability.descriptor.id },
        message: 'Project Intelligence capability API is incompatible',
      });
    }

    if (command === 'intelligence-discover') {
      return capability.api.discover();
    }

    if (command === 'intelligence-show') {
      return capability.api.loadKnowledge();
    }

    if (command === 'intelligence-graph-build') {
      return capability.api.rebuildGraph();
    }

    if (command === 'intelligence-graph-show') {
      return capability.api.loadGraph();
    }

    if (command === 'intelligence-freshness-refresh') {
      return capability.api.refreshFreshness(owner ? [owner] : undefined);
    }

    if (command === 'intelligence-freshness-show') {
      return capability.api.assessFreshness(owner ? [owner] : undefined);
    }

    if (command === 'intelligence-impact') {
      return capability.api.analyzeImpact(moduleId ?? '');
    }

    if (command === 'intelligence-sync-router') {
      return capability.api.syncAgentsRouter();
    }

    try {
      const value: unknown = JSON.parse(await readFile(inputPath ?? '', 'utf8'));

      return command === 'intelligence-graph-save'
        ? capability.api.saveGraph(value)
        : capability.api.saveKnowledge(value);
    } catch (error) {
      if (error instanceof AmyRuntimeError) {
        throw error;
      }

      throw new AmyRuntimeError({
        cause: error,
        code: 'VALIDATION_FAILURE',
        details: { inputPath },
        message: `Cannot read Project Intelligence input at ${inputPath}`,
      });
    }
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
      ...(PROJECT_INTELLIGENCE_COMMANDS.includes(cliArguments.command)
        ? {
            capabilities: [
              createProjectIntelligenceCapability(cliArguments.projectRoot),
            ],
          }
        : {}),
      ...(cliArguments.pluginRoot
        ? { pluginRoot: cliArguments.pluginRoot }
        : {}),
      projectRoot: cliArguments.projectRoot,
    });
    const result = await executeCommand(
      runtime,
      cliArguments.command,
      cliArguments.inputPath,
      cliArguments.moduleId,
      cliArguments.owner,
    );

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
