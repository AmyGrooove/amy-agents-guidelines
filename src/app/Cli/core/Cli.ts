import { isRecord } from '#shared/functions/checks/isRecord';

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createAmyRuntime } from '#app/Runtime';
import { createAnalyticsCapability } from '#modules/Analytics';
import { createCompletionCapability } from '#modules/Completion';
import { createComputeRoutingCapability } from '#modules/ComputeRouting';
import { createContextIntelligenceCapability } from '#modules/ContextResolution';
import { createDecompositionCapability } from '#modules/Decomposition';
import { createEvalSystemCapability } from '#modules/Evaluation';
import { AmyRuntimeError } from '#entities/runtime';
import { createObservabilityCapability } from '#modules/Telemetry';
import { runAmyDoctor } from '#app/Runtime';
import { createProjectIntelligenceCapability } from '#modules/ProjectDiscovery';
import { createRecoveryCapability } from '#modules/Recovery';
import { createTaskIntelligenceCapability } from '#modules/TaskAnalysis';
import { createStrategyRoutingCapability } from '#modules/StrategyRouting';
import { createVerificationCapability } from '#modules/Verification';

import type { AmyRuntime } from '#app/Runtime';
import type { IAnalyticsApi } from '#modules/Analytics';
import type { ICompletionApi } from '#entities/executionResult';
import type { IComputeRoutingApi } from '#modules/ComputeRouting';
import type { IContextIntelligenceApi } from '#entities/context';
import type { IDecompositionApi } from '#entities/executionPlan';
import type { IEvalSystemApi } from '#modules/Evaluation';
import type { IObservabilityApi } from '#modules/Telemetry';
import type { IPluginInventoryApi } from '#modules/PluginInventory';
import type { IProjectIntelligenceApi } from '#entities/project';
import type { IRecoveryApi } from '#modules/Recovery';
import type { ITaskIntelligenceApi } from '#entities/task';
import type { IStrategyRoutingApi } from '#entities/executionPlan';
import type { IVerificationApi } from '#entities/verificationResult';

type TCliCommand =
  | 'analyze'
  | 'capabilities'
  | 'config'
  | 'completion-evaluate'
  | 'compute-route'
  | 'context-resolve'
  | 'decomposition-plan'
  | 'doctor'
  | 'eval'
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
  | 'observability-record'
  | 'recovery-plan'
  | 'status'
  | 'strategy-route'
  | 'task-classify'
  | 'task-contract-validate'
  | 'verification-evaluate';

interface ICliArguments {
  command: TCliCommand;
  pluginRoot?: string;
  projectRoot: string;

  inputPath?: string;
  moduleId?: string;
  owner?: string;
}

const CLI_COMMANDS: readonly TCliCommand[] = [
  'analyze',
  'capabilities',
  'config',
  'completion-evaluate',
  'compute-route',
  'context-resolve',
  'decomposition-plan',
  'doctor',
  'eval',
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
  'observability-record',
  'recovery-plan',
  'status',
  'strategy-route',
  'task-classify',
  'task-contract-validate',
  'verification-evaluate',
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

const TASK_INTELLIGENCE_COMMANDS: readonly TCliCommand[] = [
  'task-classify',
  'task-contract-validate',
];

const CONTEXT_INTELLIGENCE_COMMANDS: readonly TCliCommand[] = [
  'context-resolve',
];

const COMPUTE_ROUTING_COMMANDS: readonly TCliCommand[] = [
  'compute-route',
];

const STRATEGY_ROUTING_COMMANDS: readonly TCliCommand[] = [
  'strategy-route',
];

const DECOMPOSITION_COMMANDS: readonly TCliCommand[] = [
  'decomposition-plan',
];

const VERIFICATION_COMMANDS: readonly TCliCommand[] = [
  'verification-evaluate',
];

const COMPLETION_COMMANDS: readonly TCliCommand[] = [
  'completion-evaluate',
];

const OBSERVABILITY_COMMANDS: readonly TCliCommand[] = [
  'observability-record',
];

const RECOVERY_COMMANDS: readonly TCliCommand[] = [
  'recovery-plan',
];

const ANALYTICS_COMMANDS: readonly TCliCommand[] = [
  'analyze',
];

const EVAL_COMMANDS: readonly TCliCommand[] = [
  'eval',
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
    'analyze',
    'completion-evaluate',
    'observability-record',
    'recovery-plan',
    'intelligence-graph-save',
    'intelligence-save',
    'context-resolve',
    'compute-route',
    'decomposition-plan',
    'eval',
    'strategy-route',
    'task-classify',
    'task-contract-validate',
    'verification-evaluate',
  ];

  if (inputCommands.includes(command) !== Boolean(inputValue)) {
    throw new AmyRuntimeError({
      code: 'VALIDATION_FAILURE',
      details: { command, inputValue },
      message:
        'CLI option --input is required only for commands that consume an input file',
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

const checkIsTaskIntelligenceApi = (
  value: unknown,
): value is ITaskIntelligenceApi =>
  typeof value === 'object' &&
  value !== null &&
  'validateContract' in value &&
  typeof value.validateContract === 'function' &&
  'classify' in value &&
  typeof value.classify === 'function';

const checkIsContextIntelligenceApi = (
  value: unknown,
): value is IContextIntelligenceApi =>
  typeof value === 'object' &&
  value !== null &&
  'resolve' in value &&
  typeof value.resolve === 'function';

const checkIsComputeRoutingApi = (
  value: unknown,
): value is IComputeRoutingApi =>
  typeof value === 'object' &&
  value !== null &&
  'route' in value &&
  typeof value.route === 'function';

const checkIsStrategyRoutingApi = (
  value: unknown,
): value is IStrategyRoutingApi =>
  typeof value === 'object' &&
  value !== null &&
  'route' in value &&
  typeof value.route === 'function';

const checkIsDecompositionApi = (
  value: unknown,
): value is IDecompositionApi =>
  typeof value === 'object' &&
  value !== null &&
  'plan' in value &&
  typeof value.plan === 'function';

const checkIsVerificationApi = (
  value: unknown,
): value is IVerificationApi =>
  typeof value === 'object' &&
  value !== null &&
  'verify' in value &&
  typeof value.verify === 'function';

const checkIsCompletionApi = (
  value: unknown,
): value is ICompletionApi =>
  typeof value === 'object' &&
  value !== null &&
  'complete' in value &&
  typeof value.complete === 'function';

const checkIsObservabilityApi = (
  value: unknown,
): value is IObservabilityApi =>
  typeof value === 'object' &&
  value !== null &&
  'record' in value &&
  typeof value.record === 'function';

const checkIsRecoveryApi = (
  value: unknown,
): value is IRecoveryApi =>
  typeof value === 'object' &&
  value !== null &&
  'recover' in value &&
  typeof value.recover === 'function';

const checkIsAnalyticsApi = (
  value: unknown,
): value is IAnalyticsApi =>
  typeof value === 'object' &&
  value !== null &&
  'analyze' in value &&
  typeof value.analyze === 'function';

const checkIsEvalSystemApi = (
  value: unknown,
): value is IEvalSystemApi =>
  typeof value === 'object' &&
  value !== null &&
  'runCorpus' in value &&
  typeof value.runCorpus === 'function';


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

  if (ANALYTICS_COMMANDS.includes(command)) {
    const capability = await runtime.resolveRequired('amy.analytics');

    if (!checkIsAnalyticsApi(capability.api)) {
      throw new AmyRuntimeError({
        code: 'INCOMPATIBLE_CAPABILITY',
        details: { capabilityId: capability.descriptor.id },
        message: 'Analytics capability API is incompatible',
      });
    }

    try {
      const value: unknown = JSON.parse(await readFile(inputPath ?? '', 'utf8'));

      return capability.api.analyze(value);
    } catch (error) {
      if (error instanceof AmyRuntimeError) {
        throw error;
      }

      throw new AmyRuntimeError({
        cause: error,
        code: 'VALIDATION_FAILURE',
        details: { inputPath },
        message: `Cannot read Analytics input at ${inputPath}`,
      });
    }
  }

  if (EVAL_COMMANDS.includes(command)) {
    const capability = await runtime.resolveRequired('amy.eval-system');

    if (!checkIsEvalSystemApi(capability.api)) {
      throw new AmyRuntimeError({
        code: 'INCOMPATIBLE_CAPABILITY',
        details: { capabilityId: capability.descriptor.id },
        message: 'Eval System capability API is incompatible',
      });
    }

    try {
      const value: unknown = JSON.parse(await readFile(inputPath ?? '', 'utf8'));

      if (!isRecord(value) || !isRecord(value.observations) || value.run === undefined) {
        throw new AmyRuntimeError({
          code: 'VALIDATION_FAILURE',
          details: { inputPath },
          message: 'Eval CLI input must contain run and observations',
        });
      }

      const observations = value.observations;

      return capability.api.runCorpus(value.run, async ({ case: evalCase }) => {
        if (!(evalCase.caseId in observations)) {
          throw new Error(`Missing precomputed observation for eval case ${evalCase.caseId}`);
        }

        return observations[evalCase.caseId];
      });
    } catch (error) {
      if (error instanceof AmyRuntimeError) {
        throw error;
      }

      throw new AmyRuntimeError({
        cause: error,
        code: 'VALIDATION_FAILURE',
        details: { inputPath },
        message: `Cannot read Eval input at ${inputPath}`,
      });
    }
  }

  if (OBSERVABILITY_COMMANDS.includes(command)) {
    const capability = await runtime.resolveRequired('amy.observability');

    if (!checkIsObservabilityApi(capability.api)) {
      throw new AmyRuntimeError({
        code: 'INCOMPATIBLE_CAPABILITY',
        details: { capabilityId: capability.descriptor.id },
        message: 'Observability capability API is incompatible',
      });
    }

    try {
      const value: unknown = JSON.parse(await readFile(inputPath ?? '', 'utf8'));

      return capability.api.record(value);
    } catch (error) {
      if (error instanceof AmyRuntimeError) {
        throw error;
      }

      throw new AmyRuntimeError({
        cause: error,
        code: 'VALIDATION_FAILURE',
        details: { inputPath },
        message: `Cannot read Observability input at ${inputPath}`,
      });
    }
  }

  if (RECOVERY_COMMANDS.includes(command)) {
    const capability = await runtime.resolveRequired('amy.recovery');

    if (!checkIsRecoveryApi(capability.api)) {
      throw new AmyRuntimeError({
        code: 'INCOMPATIBLE_CAPABILITY',
        details: { capabilityId: capability.descriptor.id },
        message: 'Recovery capability API is incompatible',
      });
    }

    try {
      const value: unknown = JSON.parse(await readFile(inputPath ?? '', 'utf8'));

      return capability.api.recover(value);
    } catch (error) {
      if (error instanceof AmyRuntimeError) {
        throw error;
      }

      throw new AmyRuntimeError({
        cause: error,
        code: 'VALIDATION_FAILURE',
        details: { inputPath },
        message: `Cannot read Recovery input at ${inputPath}`,
      });
    }
  }

  if (COMPLETION_COMMANDS.includes(command)) {
    const capability = await runtime.resolveRequired('amy.completion');

    if (!checkIsCompletionApi(capability.api)) {
      throw new AmyRuntimeError({
        code: 'INCOMPATIBLE_CAPABILITY',
        details: { capabilityId: capability.descriptor.id },
        message: 'Completion capability API is incompatible',
      });
    }

    try {
      const value: unknown = JSON.parse(await readFile(inputPath ?? '', 'utf8'));

      return capability.api.complete(value);
    } catch (error) {
      if (error instanceof AmyRuntimeError) {
        throw error;
      }

      throw new AmyRuntimeError({
        cause: error,
        code: 'VALIDATION_FAILURE',
        details: { inputPath },
        message: `Cannot read Completion input at ${inputPath}`,
      });
    }
  }

  if (VERIFICATION_COMMANDS.includes(command)) {
    const capability = await runtime.resolveRequired('amy.verification');

    if (!checkIsVerificationApi(capability.api)) {
      throw new AmyRuntimeError({
        code: 'INCOMPATIBLE_CAPABILITY',
        details: { capabilityId: capability.descriptor.id },
        message: 'Verification capability API is incompatible',
      });
    }

    try {
      const value: unknown = JSON.parse(await readFile(inputPath ?? '', 'utf8'));

      return capability.api.verify(value);
    } catch (error) {
      if (error instanceof AmyRuntimeError) {
        throw error;
      }

      throw new AmyRuntimeError({
        cause: error,
        code: 'VALIDATION_FAILURE',
        details: { inputPath },
        message: `Cannot read Verification input at ${inputPath}`,
      });
    }
  }

  if (DECOMPOSITION_COMMANDS.includes(command)) {
    const capability = await runtime.resolveRequired('amy.decomposition');

    if (!checkIsDecompositionApi(capability.api)) {
      throw new AmyRuntimeError({
        code: 'INCOMPATIBLE_CAPABILITY',
        details: { capabilityId: capability.descriptor.id },
        message: 'Decomposition capability API is incompatible',
      });
    }

    try {
      const value: unknown = JSON.parse(await readFile(inputPath ?? '', 'utf8'));

      return capability.api.plan(value);
    } catch (error) {
      if (error instanceof AmyRuntimeError) {
        throw error;
      }

      throw new AmyRuntimeError({
        cause: error,
        code: 'VALIDATION_FAILURE',
        details: { inputPath },
        message: `Cannot read Decomposition input at ${inputPath}`,
      });
    }
  }

  if (STRATEGY_ROUTING_COMMANDS.includes(command)) {
    const capability = await runtime.resolveRequired('amy.strategy-routing');

    if (!checkIsStrategyRoutingApi(capability.api)) {
      throw new AmyRuntimeError({
        code: 'INCOMPATIBLE_CAPABILITY',
        details: { capabilityId: capability.descriptor.id },
        message: 'Strategy Routing capability API is incompatible',
      });
    }

    try {
      const value: unknown = JSON.parse(await readFile(inputPath ?? '', 'utf8'));

      return capability.api.route(value);
    } catch (error) {
      if (error instanceof AmyRuntimeError) {
        throw error;
      }

      throw new AmyRuntimeError({
        cause: error,
        code: 'VALIDATION_FAILURE',
        details: { inputPath },
        message: `Cannot read Strategy Routing input at ${inputPath}`,
      });
    }
  }

  if (COMPUTE_ROUTING_COMMANDS.includes(command)) {
    const capability = await runtime.resolveRequired('amy.compute-routing');

    if (!checkIsComputeRoutingApi(capability.api)) {
      throw new AmyRuntimeError({
        code: 'INCOMPATIBLE_CAPABILITY',
        details: { capabilityId: capability.descriptor.id },
        message: 'Compute Routing capability API is incompatible',
      });
    }

    try {
      const value: unknown = JSON.parse(await readFile(inputPath ?? '', 'utf8'));

      return capability.api.route(value);
    } catch (error) {
      if (error instanceof AmyRuntimeError) {
        throw error;
      }

      throw new AmyRuntimeError({
        cause: error,
        code: 'VALIDATION_FAILURE',
        details: { inputPath },
        message: `Cannot read Compute Routing input at ${inputPath}`,
      });
    }
  }

  if (CONTEXT_INTELLIGENCE_COMMANDS.includes(command)) {
    const capability = await runtime.resolveRequired('amy.context-intelligence');

    if (!checkIsContextIntelligenceApi(capability.api)) {
      throw new AmyRuntimeError({
        code: 'INCOMPATIBLE_CAPABILITY',
        details: { capabilityId: capability.descriptor.id },
        message: 'Context Intelligence capability API is incompatible',
      });
    }

    try {
      const value: unknown = JSON.parse(await readFile(inputPath ?? '', 'utf8'));

      return capability.api.resolve(value);
    } catch (error) {
      if (error instanceof AmyRuntimeError) {
        throw error;
      }

      throw new AmyRuntimeError({
        cause: error,
        code: 'VALIDATION_FAILURE',
        details: { inputPath },
        message: `Cannot read Context Intelligence input at ${inputPath}`,
      });
    }
  }

  if (TASK_INTELLIGENCE_COMMANDS.includes(command)) {
    const capability = await runtime.resolveRequired('amy.task-intelligence');

    if (!checkIsTaskIntelligenceApi(capability.api)) {
      throw new AmyRuntimeError({
        code: 'INCOMPATIBLE_CAPABILITY',
        details: { capabilityId: capability.descriptor.id },
        message: 'Task Intelligence capability API is incompatible',
      });
    }

    try {
      const value: unknown = JSON.parse(await readFile(inputPath ?? '', 'utf8'));

      return command === 'task-contract-validate'
        ? capability.api.validateContract(value)
        : capability.api.classify(value);
    } catch (error) {
      if (error instanceof AmyRuntimeError) {
        throw error;
      }

      throw new AmyRuntimeError({
        cause: error,
        code: 'VALIDATION_FAILURE',
        details: { inputPath },
        message: `Cannot read Task Intelligence input at ${inputPath}`,
      });
    }
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

const createCliCapabilities = (
  command: TCliCommand,
  projectRoot: string,
) => {
  if (CONTEXT_INTELLIGENCE_COMMANDS.includes(command)) {
    const projectIntelligence = createProjectIntelligenceCapability(projectRoot);

    return [
      projectIntelligence,
      createContextIntelligenceCapability({
        projectIntelligence: projectIntelligence.api,
      }),
    ];
  }

  if (PROJECT_INTELLIGENCE_COMMANDS.includes(command)) {
    return [createProjectIntelligenceCapability(projectRoot)];
  }

  if (TASK_INTELLIGENCE_COMMANDS.includes(command)) {
    return [createTaskIntelligenceCapability()];
  }

  return undefined;
};

export const Cli = async (args: readonly string[]) => {
  try {
    const cliArguments = parseCliArguments(args);

    if (cliArguments.command === 'doctor') {
      const report = await runAmyDoctor({
        ...(cliArguments.pluginRoot ? { pluginRoot: cliArguments.pluginRoot } : {}),
        projectRoot: cliArguments.projectRoot,
      });

      writeJson(report, process.stdout);

      return report.status === 'unhealthy' ? 1 : 0;
    }
    const cliCapabilities = createCliCapabilities(
      cliArguments.command,
      cliArguments.projectRoot,
    );
    const runtime = await createAmyRuntime({
      ...(cliCapabilities ? { capabilities: cliCapabilities } : {}),
      ...(cliArguments.pluginRoot
        ? { pluginRoot: cliArguments.pluginRoot }
        : {}),
      projectRoot: cliArguments.projectRoot,
    });

    if (OBSERVABILITY_COMMANDS.includes(cliArguments.command)) {
      runtime.capabilities.register(
        createObservabilityCapability({
          events: runtime.events,
          runtimeId: runtime.getStatus().runtimeId,
        }),
      );
    }

    if (ANALYTICS_COMMANDS.includes(cliArguments.command)) {
      runtime.capabilities.register(createAnalyticsCapability());
    }

    if (EVAL_COMMANDS.includes(cliArguments.command)) {
      runtime.capabilities.register(createEvalSystemCapability());
    }

    if (RECOVERY_COMMANDS.includes(cliArguments.command)) {
      runtime.capabilities.register(createRecoveryCapability());
    }

    if (COMPLETION_COMMANDS.includes(cliArguments.command)) {
      runtime.capabilities.register(createCompletionCapability());
    }

    if (VERIFICATION_COMMANDS.includes(cliArguments.command)) {
      runtime.capabilities.register(createVerificationCapability());
    }

    if (DECOMPOSITION_COMMANDS.includes(cliArguments.command)) {
      runtime.capabilities.register(createDecompositionCapability());
    }

    if (STRATEGY_ROUTING_COMMANDS.includes(cliArguments.command)) {
      runtime.capabilities.register(createStrategyRoutingCapability());
    }

    if (COMPUTE_ROUTING_COMMANDS.includes(cliArguments.command)) {
      runtime.capabilities.register(
        createComputeRoutingCapability({
          ...(runtime.config.compute ? { config: runtime.config.compute } : {}),
        }),
      );
    }

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

export { Cli as runCli };
