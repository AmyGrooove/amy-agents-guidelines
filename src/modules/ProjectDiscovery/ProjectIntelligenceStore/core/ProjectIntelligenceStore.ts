import {
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { AmyRuntimeError } from '#entities/runtime';

import { discoverProjectRoot } from '../../core/ProjectDiscovery.js';
import { PROJECT_INTELLIGENCE_VERSIONS } from '#entities/project';
import {
  normalizeProjectRelativePath,
  validateProjectIntelligenceIndex,
  validateProjectIntelligenceKnowledge,
} from '#entities/project';

import type {
  IModuleKnowledge,
  IProjectIntelligenceIndex,
  IProjectIntelligenceKnowledge,
} from '#entities/project';

const ARTIFACT_DIRECTORY = join('.amy', 'project-intelligence');
const INDEX_PATH = 'index.json';

const checkIsMissingFileError = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

const readJson = async (path: string) => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch (cause) {
    throw new AmyRuntimeError({
      cause,
      code: 'VALIDATION_FAILURE',
      details: { path },
      message: `Cannot load Project Intelligence artifact at ${path}`,
    });
  }
};

const writeJson = async (path: string, value: unknown) => {
  await writeFile(path, `${JSON.stringify(value, undefined, 2)}\n`, 'utf8');
};

const createIndex = (
  modules: readonly Readonly<IModuleKnowledge>[],
): Readonly<IProjectIntelligenceIndex> =>
  Object.freeze({
    architecture: 'architecture.json',
    modules: Object.freeze(
      modules.map(({ id }) =>
        Object.freeze({ id, path: `modules/${id}.json` }),
      ),
    ),
    project: 'project.json',
    schemaVersion: PROJECT_INTELLIGENCE_VERSIONS.artifactSchema,
  });

export class ProjectIntelligenceStore {
  readonly #artifactRoot: string;
  readonly #projectRoot: string;

  private constructor(projectRoot: string) {
    this.#projectRoot = projectRoot;
    this.#artifactRoot = join(projectRoot, ARTIFACT_DIRECTORY);
  }

  static async create(startPath: string) {
    return new ProjectIntelligenceStore(await discoverProjectRoot(startPath));
  }

  get projectRoot() {
    return this.#projectRoot;
  }

  async load(): Promise<Readonly<IProjectIntelligenceKnowledge> | undefined> {
    const index = await this.#loadIndex();

    if (!index) {
      return undefined;
    }

    const [project, architecture, modules] = await Promise.all([
      readJson(join(this.#artifactRoot, index.project)),
      readJson(join(this.#artifactRoot, index.architecture)),
      Promise.all(
        index.modules.map(({ path }) => readJson(join(this.#artifactRoot, path))),
      ),
    ]);

    return validateProjectIntelligenceKnowledge({
      architecture,
      modules,
      project,
    });
  }

  async save(value: unknown): Promise<Readonly<IProjectIntelligenceKnowledge>> {
    const knowledge = validateProjectIntelligenceKnowledge(value);
    const previousIndex = await this.#loadIndex();
    const modulesRoot = join(this.#artifactRoot, 'modules');
    const index = createIndex(knowledge.modules);

    await mkdir(modulesRoot, { recursive: true });
    await Promise.all([
      writeJson(join(this.#artifactRoot, index.project), knowledge.project),
      writeJson(
        join(this.#artifactRoot, index.architecture),
        knowledge.architecture,
      ),
      ...knowledge.modules.map((module) =>
        writeJson(join(this.#artifactRoot, `modules`, `${module.id}.json`), module),
      ),
    ]);
    await writeJson(join(this.#artifactRoot, INDEX_PATH), index);

    const currentModulePaths = new Set(index.modules.map(({ path }) => path));
    const staleModulePaths =
      previousIndex?.modules
        .map(({ path }) => path)
        .filter((path) => !currentModulePaths.has(path)) ?? [];

    await Promise.all(
      staleModulePaths.map((path) =>
        rm(join(this.#artifactRoot, path), { force: true }),
      ),
    );

    return knowledge;
  }

  async listModules(): Promise<readonly Readonly<{ id: string }>[]> {
    const knowledge = await this.load();

    return Object.freeze(
      (knowledge?.modules ?? []).map(({ id }) => Object.freeze({ id })),
    );
  }

  async getModule(id: string): Promise<Readonly<IModuleKnowledge> | undefined> {
    const knowledge = await this.load();

    return knowledge?.modules.find((module) => module.id === id);
  }

  async resolveSourceLocations(id?: string): Promise<readonly string[]> {
    const knowledge = await this.load();

    if (!knowledge) {
      return [];
    }

    const module = id
      ? knowledge.modules.find((item) => item.id === id)
      : undefined;
    const locations = id
      ? module
        ? [...module.sourceLocations, ...(module.sourceOfTruth ?? [])]
        : []
      : [
          ...(knowledge.project.sourceOfTruth ?? []),
          ...(knowledge.project.entryPoints ?? []),
        ];
    const uniqueLocations = [...new Set(locations)].map((location) =>
      resolve(this.#projectRoot, normalizeProjectRelativePath(location)),
    );

    return Object.freeze(uniqueLocations);
  }

  async #loadIndex(): Promise<Readonly<IProjectIntelligenceIndex> | undefined> {
    const indexPath = join(this.#artifactRoot, INDEX_PATH);

    try {
      return validateProjectIntelligenceIndex(await readJson(indexPath));
    } catch (error) {
      if (
        error instanceof AmyRuntimeError &&
        checkIsMissingFileError(error.cause)
      ) {
        try {
          await stat(this.#artifactRoot);
        } catch (artifactError) {
          if (checkIsMissingFileError(artifactError)) {
            return undefined;
          }

          throw artifactError;
        }
      }

      throw error;
    }
  }
}
