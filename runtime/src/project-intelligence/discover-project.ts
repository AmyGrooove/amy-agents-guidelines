import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, parse, relative, resolve } from 'node:path';

import { AmyRuntimeError } from '../errors/amy-runtime-error.js';

import type {
  IModuleCandidate,
  IProjectDiscovery,
  TModuleCandidateSignal,
} from './project-intelligence-contract.js';

const ROOT_MARKERS = [
  'Cargo.toml',
  'go.mod',
  'package.json',
  'pom.xml',
  'pyproject.toml',
] as const;
const CONFIGURATION_NAMES = [
  '.editorconfig',
  'eslint.config.js',
  'eslint.config.mjs',
  'nest-cli.json',
  'next.config.js',
  'next.config.mjs',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'vite.config.js',
  'vite.config.ts',
] as const;
const DOCUMENTATION_NAMES = ['README.md', 'README.MD', 'readme.md'] as const;
const PUBLIC_ENTRYPOINT_PATTERN = /^index\.(?:cjs|js|jsx|mjs|ts|tsx)$/;
const FRAMEWORK_MODULE_PATTERN = /\.module\.(?:js|ts)$/;
const IGNORED_DISCOVERY_DIRECTORIES = new Set([
  '.amy',
  '.git',
  'build',
  'dist',
  'node_modules',
]);

const checkExists = async (path: string) => {
  try {
    await stat(path);

    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
};

const toProjectPath = (projectRoot: string, path: string) =>
  relative(projectRoot, path).replaceAll('\\', '/');

const toCandidateId = (sourceLocation: string) =>
  sourceLocation
    .toLowerCase()
    .replaceAll('/', '.')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '');

const getStartStat = async (absoluteStart: string) => {
  try {
    return await stat(absoluteStart);
  } catch (cause) {
    throw new AmyRuntimeError({
      cause,
      code: 'VALIDATION_FAILURE',
      details: { startPath: absoluteStart },
      message: `Cannot discover project from ${absoluteStart}`,
    });
  }
};

export const discoverProjectRoot = async (startPath: string) => {
  const absoluteStart = resolve(startPath);
  const startStat = await getStartStat(absoluteStart);
  const startDirectory = startStat.isDirectory()
    ? absoluteStart
    : dirname(absoluteStart);
  const filesystemRoot = parse(startDirectory).root;
  const getAncestors = (path: string): readonly string[] =>
    path === filesystemRoot ? [path] : [path, ...getAncestors(dirname(path))];
  const candidates = await Promise.all(
    getAncestors(startDirectory).map(async (path) => ({
      hasGit: await checkExists(join(path, '.git')),
      hasManifest: (
        await Promise.all(
          ROOT_MARKERS.map((marker) => checkExists(join(path, marker))),
        )
      ).some(Boolean),
      path,
    })),
  );
  const gitRoot = candidates.find(({ hasGit }) => hasGit);
  const manifestRoot = candidates.find(({ hasManifest }) => hasManifest);

  return gitRoot?.path ?? manifestRoot?.path ?? startDirectory;
};

const readDirectoryEntries = async (path: string) => {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
};

const discoverNamedFiles = async (
  projectRoot: string,
  names: readonly string[],
) => {
  const expectedNames = new Set(names.map((name) => name.toLowerCase()));
  const entries = await readDirectoryEntries(projectRoot);

  return entries
    .filter(
      (entry) => entry.isFile() && expectedNames.has(entry.name.toLowerCase()),
    )
    .map(({ name }) => name)
    .sort();
};

const readWorkspacePatterns = async (projectRoot: string) => {
  try {
    const content = await readFile(join(projectRoot, 'package.json'), 'utf8');
    const value: unknown = JSON.parse(content);

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return [];
    }

    const workspaces = 'workspaces' in value ? value.workspaces : undefined;

    if (Array.isArray(workspaces)) {
      return workspaces.filter((item): item is string => typeof item === 'string');
    }

    if (
      typeof workspaces === 'object' &&
      workspaces !== null &&
      'packages' in workspaces &&
      Array.isArray(workspaces.packages)
    ) {
      return workspaces.packages.filter(
        (item): item is string => typeof item === 'string',
      );
    }

    return [];
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && 'code' in error && error.code === 'ENOENT')
    ) {
      return [];
    }

    throw error;
  }
};

const expandWorkspacePattern = async (
  projectRoot: string,
  pattern: string,
) => {
  const normalizedPattern = pattern.replaceAll('\\', '/');

  if (!normalizedPattern.endsWith('/*') || normalizedPattern.includes('..')) {
    return [];
  }

  const parentPath = normalizedPattern.slice(0, -2);
  const entries = await readDirectoryEntries(join(projectRoot, parentPath));

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${parentPath}/${entry.name}`)
    .sort();
};

const inspectCandidate = async (
  projectRoot: string,
  sourceLocation: string,
  initialSignals: readonly TModuleCandidateSignal[],
): Promise<Readonly<IModuleCandidate>> => {
  const entries = await readDirectoryEntries(join(projectRoot, sourceLocation));
  const signals = new Set<TModuleCandidateSignal>(initialSignals);

  if (entries.some((entry) => entry.isFile() && PUBLIC_ENTRYPOINT_PATTERN.test(entry.name))) {
    signals.add('public-entrypoint');
  }

  if (entries.some((entry) => entry.isFile() && FRAMEWORK_MODULE_PATTERN.test(entry.name))) {
    signals.add('framework-convention');
  }

  return Object.freeze({
    id: toCandidateId(sourceLocation),
    signals: Object.freeze([...signals].sort()),
    sourceLocations: Object.freeze([sourceLocation]),
  });
};

const discoverNestedSourceRoots = async (
  projectRoot: string,
  currentLocation = '',
  remainingDepth = 2,
): Promise<readonly string[]> => {
  const entries = await readDirectoryEntries(join(projectRoot, currentLocation));
  const directories = entries.filter(
    (entry) =>
      entry.isDirectory() &&
      !entry.name.startsWith('.') &&
      !IGNORED_DISCOVERY_DIRECTORIES.has(entry.name),
  );
  const directSourceRoots = directories
    .filter(({ name }) => name === 'src')
    .map(({ name }) =>
      currentLocation ? `${currentLocation}/${name}` : name,
    );

  if (remainingDepth === 0) {
    return directSourceRoots;
  }

  const nestedSourceRoots = await Promise.all(
    directories
      .filter(({ name }) => name !== 'src')
      .map(({ name }) =>
        discoverNestedSourceRoots(
          projectRoot,
          currentLocation ? `${currentLocation}/${name}` : name,
          remainingDepth - 1,
        ),
      ),
  );

  return [...directSourceRoots, ...nestedSourceRoots.flat()];
};

const discoverSourceRoots = async (
  projectRoot: string,
  workspaceLocations: readonly string[],
) => {
  const nestedSourceRoots = await discoverNestedSourceRoots(projectRoot);
  const roots = [
    ...new Set([
      ...nestedSourceRoots,
      ...workspaceLocations.map((path) => `${path}/src`),
    ]),
  ];
  const candidates = await Promise.all(
    roots.map(async (sourceRoot) => {
      const entries = await readDirectoryEntries(join(projectRoot, sourceRoot));

      return Promise.all(
        entries
          .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
          .map((entry) =>
            inspectCandidate(
              projectRoot,
              `${sourceRoot}/${entry.name}`,
              ['source-boundary'],
            ),
          ),
      );
    }),
  );

  return candidates.flat();
};

export const discoverProject = async (
  startPath: string,
): Promise<Readonly<IProjectDiscovery>> => {
  const projectRoot = await discoverProjectRoot(startPath);
  const workspacePatterns = await readWorkspacePatterns(projectRoot);
  const workspaceLocations = (
    await Promise.all(
      workspacePatterns.map((pattern) =>
        expandWorkspacePattern(projectRoot, pattern),
      ),
    )
  ).flat();
  const workspaceCandidates = await Promise.all(
    workspaceLocations.map((sourceLocation) =>
      inspectCandidate(projectRoot, sourceLocation, ['package-boundary']),
    ),
  );
  const sourceCandidates = await discoverSourceRoots(
    projectRoot,
    workspaceLocations,
  );
  const candidatesByLocation = new Map<string, Readonly<IModuleCandidate>>();

  [...workspaceCandidates, ...sourceCandidates].forEach((candidate) => {
    const key = candidate.sourceLocations[0];

    if (key) {
      candidatesByLocation.set(key, candidate);
    }
  });

  const rootManifests = await discoverNamedFiles(projectRoot, ROOT_MARKERS);
  const workspaceManifests = (
    await Promise.all(
      workspaceLocations.map(async (location) => {
        const packagePath = join(projectRoot, location, 'package.json');

        return (await checkExists(packagePath))
          ? toProjectPath(projectRoot, packagePath)
          : undefined;
      }),
    )
  ).filter((value) => value !== undefined);

  return Object.freeze({
    agentsInstructions: Object.freeze(
      (await discoverNamedFiles(projectRoot, ['AGENTS.md'])).sort(),
    ),
    configurations: Object.freeze(
      await discoverNamedFiles(projectRoot, CONFIGURATION_NAMES),
    ),
    documentation: Object.freeze(
      await discoverNamedFiles(projectRoot, DOCUMENTATION_NAMES),
    ),
    manifests: Object.freeze([...rootManifests, ...workspaceManifests].sort()),
    moduleCandidates: Object.freeze(
      [...candidatesByLocation.values()].sort(
        ({ id: leftId }, { id: rightId }) => leftId.localeCompare(rightId),
      ),
    ),
    projectRoot,
  });
};
