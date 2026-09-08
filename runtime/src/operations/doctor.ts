import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { discoverPluginInventory } from '../compatibility/discover-plugin-inventory.js';
import { loadRuntimeConfig } from '../config/load-config.js';
import { createDataStorageCapability } from '../data-storage/data-storage-capability.js';
import { DATA_STORAGE_VERSIONS } from '../data-storage/data-storage-contract.js';
import { createProjectIntelligenceCapability } from '../project-intelligence/project-intelligence-capability.js';
import { OPERATIONS_VERSIONS } from './operations-contract.js';

import type { IPluginInventory } from '../compatibility/plugin-inventory.js';
import type {
  IAmyDoctorReport,
  IDoctorCheck,
  TDoctorCheckStatus,
  TDoctorStatus,
} from './operations-contract.js';

export interface IRunAmyDoctorOptions {
  projectRoot: string;

  pluginRoot?: string;
}

type TPackageManifest = Readonly<{
  enginesNode?: string;
  name?: string;
  version?: string;
}>;

const checkIsRecord = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const checkIsMissingFileError = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const freezeCheck = (
  id: string,
  status: TDoctorCheckStatus,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): Readonly<IDoctorCheck> =>
  Object.freeze({
    ...(details ? { details: Object.freeze({ ...details }) } : {}),
    id,
    message,
    status,
  });

const getDoctorStatus = (
  checks: readonly Readonly<IDoctorCheck>[],
): TDoctorStatus => {
  if (checks.some(({ status }) => status === 'fail')) return 'unhealthy';
  if (checks.some(({ status }) => status === 'warn')) return 'degraded';

  return 'healthy';
};

const getDefaultPluginRoot = () =>
  resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const readPackageManifest = async (
  pluginRoot: string,
): Promise<Readonly<TPackageManifest>> => {
  const packagePath = join(pluginRoot, 'package.json');
  const value: unknown = JSON.parse(await readFile(packagePath, 'utf8'));

  if (!checkIsRecord(value)) {
    throw new TypeError(`Package manifest at ${packagePath} must be an object`);
  }

  const enginesNode =
    checkIsRecord(value.engines) && typeof value.engines.node === 'string'
      ? value.engines.node
      : undefined;

  return Object.freeze({
    ...(enginesNode ? { enginesNode } : {}),
    ...(typeof value.name === 'string' ? { name: value.name } : {}),
    ...(typeof value.version === 'string' ? { version: value.version } : {}),
  });
};

const checkNodeRuntime = (
  manifest: Readonly<TPackageManifest> | undefined,
): Readonly<IDoctorCheck> => {
  const runtimeVersion = process.versions.node;
  const runtimeMajor = Number(runtimeVersion.split('.')[0]);
  const minimumMatch = manifest?.enginesNode?.match(/^>=\s*(\d+)/);
  const minimumMajor = minimumMatch?.[1] ? Number(minimumMatch[1]) : undefined;

  if (minimumMajor === undefined) {
    return freezeCheck(
      'runtime.node',
      'warn',
      'Cannot determine the minimum Node.js major from package.json engines.node.',
      { runtimeVersion, enginesNode: manifest?.enginesNode ?? null },
    );
  }

  return runtimeMajor >= minimumMajor
    ? freezeCheck(
        'runtime.node',
        'pass',
        `Node.js ${runtimeVersion} satisfies ${manifest?.enginesNode}.`,
        { minimumMajor, runtimeVersion },
      )
    : freezeCheck(
        'runtime.node',
        'fail',
        `Node.js ${runtimeVersion} does not satisfy ${manifest?.enginesNode}.`,
        { minimumMajor, runtimeVersion },
      );
};

const checkGeneratedRuntime = async (
  pluginRoot: string,
): Promise<Readonly<IDoctorCheck>> => {
  const requiredFiles = [
    join(pluginRoot, 'runtime', 'dist', 'cli.js'),
    join(pluginRoot, 'runtime', 'dist', 'index.js'),
  ];

  try {
    await Promise.all(requiredFiles.map((path) => stat(path)));

    return freezeCheck(
      'runtime.generated',
      'pass',
      'Runtime generated entrypoints are present.',
      { requiredFiles },
    );
  } catch (error) {
    return freezeCheck(
      'runtime.generated',
      'fail',
      `Runtime generated entrypoints are incomplete: ${getErrorMessage(error)}`,
      { requiredFiles },
    );
  }
};

const checkSkills = async (
  pluginRoot: string,
  inventory: Readonly<IPluginInventory> | undefined,
): Promise<Readonly<IDoctorCheck>> => {
  const skills = inventory?.mechanisms.skills;

  if (!skills?.isPresent || skills.items.length === 0) {
    return freezeCheck(
      'plugin.skills',
      'fail',
      'No plugin skills were discovered.',
    );
  }

  const missingSkillFiles: string[] = [];

  for (const skill of skills.items) {
    const skillPath = join(pluginRoot, skills.path, skill, 'SKILL.md');

    try {
      const metadata = await stat(skillPath);

      if (!metadata.isFile()) missingSkillFiles.push(skillPath);
    } catch {
      missingSkillFiles.push(skillPath);
    }
  }

  if (missingSkillFiles.length > 0) {
    return freezeCheck(
      'plugin.skills',
      'fail',
      'One or more discovered skills do not contain SKILL.md.',
      { missingSkillFiles, skillCount: skills.items.length },
    );
  }

  return freezeCheck(
    'plugin.skills',
    'pass',
    `Discovered ${skills.items.length} skills with SKILL.md.`,
    { skillCount: skills.items.length },
  );
};

const checkProjectIntelligence = async (
  projectRoot: string,
): Promise<Readonly<IDoctorCheck>> => {
  try {
    const projectIntelligence = createProjectIntelligenceCapability(projectRoot);
    const knowledge = await projectIntelligence.api.loadKnowledge();

    if (!knowledge) {
      return freezeCheck(
        'project-intelligence',
        'skipped',
        'Project Intelligence artifacts are not present; the capability remains optional.',
      );
    }

    const freshness = await projectIntelligence.api.assessFreshness();

    const staleOwnerCount = freshness.owners.filter(({ state }) => state === 'stale').length;
    const trustedOwnerCount = freshness.owners.filter(({ state }) => state === 'trusted').length;
    const effectiveState = staleOwnerCount > 0 ? ('stale' as const) : freshness.state;

    if (effectiveState === 'trusted') {
      return freezeCheck(
        'project-intelligence',
        'pass',
        'Project Intelligence is present and trusted.',
        {
          freshness: effectiveState,
          ownerCount: freshness.owners.length,
          staleOwnerCount,
          trustedOwnerCount,
        },
      );
    }

    return freezeCheck(
      'project-intelligence',
      'warn',
      `Project Intelligence is ${effectiveState}.`,
      {
        freshness: effectiveState,
        ownerCount: freshness.owners.length,
        staleOwnerCount,
        trustedOwnerCount,
      },
    );
  } catch (error) {
    return freezeCheck(
      'project-intelligence',
      'fail',
      `Project Intelligence cannot be inspected: ${getErrorMessage(error)}`,
    );
  }
};

const inspectStorageMigrations = async (
  sqlitePath: string,
): Promise<Readonly<IDoctorCheck>> => {
  try {
    await stat(sqlitePath);
  } catch (error) {
    if (checkIsMissingFileError(error)) {
      return freezeCheck(
        'data-storage.migrations',
        'skipped',
        'SQLite storage is not present, so no migration state needs inspection.',
      );
    }

    return freezeCheck(
      'data-storage.migrations',
      'fail',
      `Cannot inspect SQLite storage: ${getErrorMessage(error)}`,
    );
  }

  let database: import('node:sqlite').DatabaseSync | undefined;

  try {
    const { DatabaseSync } = await import('node:sqlite');
    database = new DatabaseSync(sqlitePath, { readOnly: true });
    const migrationTable = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'amy_storage_migrations'",
      )
      .get() as { name?: string } | undefined;

    if (!migrationTable?.name) {
      return freezeCheck(
        'data-storage.migrations',
        'warn',
        'SQLite storage exists without Amy migration metadata.',
        { sqlitePath },
      );
    }

    const row = database
      .prepare('SELECT MAX(version) AS version FROM amy_storage_migrations')
      .get() as { version?: number | null } | undefined;
    const version = row?.version ?? 0;

    if (version > DATA_STORAGE_VERSIONS.sqliteSchema) {
      return freezeCheck(
        'data-storage.migrations',
        'fail',
        `SQLite schema ${version} is newer than supported ${DATA_STORAGE_VERSIONS.sqliteSchema}.`,
        { sqlitePath, supportedVersion: DATA_STORAGE_VERSIONS.sqliteSchema, version },
      );
    }

    if (version < DATA_STORAGE_VERSIONS.sqliteSchema) {
      return freezeCheck(
        'data-storage.migrations',
        'warn',
        `SQLite schema ${version} is behind supported ${DATA_STORAGE_VERSIONS.sqliteSchema}; canonical storage will migrate it on the next write.`,
        { sqlitePath, supportedVersion: DATA_STORAGE_VERSIONS.sqliteSchema, version },
      );
    }

    return freezeCheck(
      'data-storage.migrations',
      'pass',
      `SQLite schema ${version} matches the supported migration version.`,
      { sqlitePath, version },
    );
  } catch (error) {
    return freezeCheck(
      'data-storage.migrations',
      'fail',
      `SQLite migration state cannot be inspected: ${getErrorMessage(error)}`,
      { sqlitePath },
    );
  } finally {
    database?.close();
  }
};

const checkDataStorage = async (
  projectRoot: string,
): Promise<readonly Readonly<IDoctorCheck>[]> => {
  const storage = createDataStorageCapability({
    rootDirectory: join(projectRoot, '.amy', 'data'),
  }).api.getStatus();

  try {
    const metadata = await stat(storage.rootDirectory);

    if (!metadata.isDirectory()) {
      return Object.freeze([
        freezeCheck(
          'data-storage',
          'fail',
          'Amy data storage root exists but is not a directory.',
          { rootDirectory: storage.rootDirectory },
        ),
        freezeCheck(
          'data-storage.migrations',
          'skipped',
          'Migration inspection was skipped because the storage root is invalid.',
        ),
      ]);
    }
  } catch (error) {
    if (checkIsMissingFileError(error)) {
      return Object.freeze([
        freezeCheck(
          'data-storage',
          'skipped',
          'Persistent data storage is not present; storage remains optional.',
          { rootDirectory: storage.rootDirectory },
        ),
        freezeCheck(
          'data-storage.migrations',
          'skipped',
          'No storage means no migration state to inspect.',
        ),
      ]);
    }

    return Object.freeze([
      freezeCheck(
        'data-storage',
        'fail',
        `Persistent data storage cannot be inspected: ${getErrorMessage(error)}`,
        { rootDirectory: storage.rootDirectory },
      ),
      freezeCheck(
        'data-storage.migrations',
        'skipped',
        'Migration inspection was skipped because storage inspection failed.',
      ),
    ]);
  }

  return Object.freeze([
    freezeCheck(
      'data-storage',
      'pass',
      'Persistent data storage root is accessible.',
      { rootDirectory: storage.rootDirectory },
    ),
    await inspectStorageMigrations(storage.sqlitePath),
  ]);
};

export const runAmyDoctor = async (
  options: Readonly<IRunAmyDoctorOptions>,
): Promise<Readonly<IAmyDoctorReport>> => {
  const projectRoot = resolve(options.projectRoot);
  const pluginRoot = resolve(options.pluginRoot ?? getDefaultPluginRoot());
  const checks: Readonly<IDoctorCheck>[] = [];
  let packageManifest: Readonly<TPackageManifest> | undefined;
  let inventory: Readonly<IPluginInventory> | undefined;

  try {
    packageManifest = await readPackageManifest(pluginRoot);
    checks.push(
      freezeCheck(
        'plugin.package',
        'pass',
        'Package manifest is readable.',
        {
          name: packageManifest.name ?? null,
          version: packageManifest.version ?? null,
        },
      ),
    );
  } catch (error) {
    checks.push(
      freezeCheck(
        'plugin.package',
        'fail',
        `Package manifest cannot be read: ${getErrorMessage(error)}`,
      ),
    );
  }

  checks.push(checkNodeRuntime(packageManifest));

  try {
    inventory = await discoverPluginInventory(pluginRoot);
    checks.push(
      freezeCheck(
        'plugin.manifest',
        'pass',
        'Codex plugin manifest is readable and structurally valid.',
        { name: inventory.plugin.name, version: inventory.plugin.version },
      ),
    );
  } catch (error) {
    checks.push(
      freezeCheck(
        'plugin.manifest',
        'fail',
        `Codex plugin manifest cannot be read: ${getErrorMessage(error)}`,
      ),
    );
  }

  if (packageManifest?.version && inventory?.plugin.version) {
    checks.push(
      packageManifest.version === inventory.plugin.version
        ? freezeCheck(
            'plugin.version',
            'pass',
            `Package and plugin versions both equal ${packageManifest.version}.`,
          )
        : freezeCheck(
            'plugin.version',
            'fail',
            `Package version ${packageManifest.version} does not match plugin version ${inventory.plugin.version}.`,
          ),
    );
  } else {
    checks.push(
      freezeCheck(
        'plugin.version',
        'fail',
        'Package/plugin version parity cannot be verified.',
      ),
    );
  }

  checks.push(await checkSkills(pluginRoot, inventory));
  checks.push(await checkGeneratedRuntime(pluginRoot));

  try {
    const loadedConfig = await loadRuntimeConfig({ projectRoot });
    checks.push(
      freezeCheck(
        'runtime.config',
        'pass',
        'Runtime configuration is valid.',
        {
          configuredCapabilityCount: Object.keys(loadedConfig.config.capabilities).length,
          sources: loadedConfig.sources,
        },
      ),
    );
  } catch (error) {
    checks.push(
      freezeCheck(
        'runtime.config',
        'fail',
        `Runtime configuration is invalid: ${getErrorMessage(error)}`,
      ),
    );
  }

  checks.push(await checkProjectIntelligence(projectRoot));
  checks.push(...(await checkDataStorage(projectRoot)));

  const status = getDoctorStatus(checks);

  return Object.freeze({
    checks: Object.freeze(checks),
    kind: 'doctor-report' as const,
    ...(packageManifest?.version ? { packageVersion: packageManifest.version } : {}),
    ...(inventory ? { plugin: inventory.plugin } : {}),
    pluginRoot,
    projectRoot,
    schemaVersion: OPERATIONS_VERSIONS.doctorSchema,
    status,
  });
};
