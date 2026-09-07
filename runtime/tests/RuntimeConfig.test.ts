import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import {
  AmyRuntimeError,
  loadRuntimeConfig,
} from '../dist/index.js';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'amy-runtime-config-'));

  temporaryDirectories.push(directory);

  return directory;
};

const writeJson = async (path: string, value: unknown) => {
  await mkdir(join(path, '.amy'), { recursive: true });
  await writeFile(
    join(path, '.amy', 'config.json'),
    JSON.stringify(value),
    'utf8',
  );
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe('RuntimeConfig', () => {
  it('создаёт минимальную конфигурацию только из defaults', async () => {
    const projectRoot = await createTemporaryDirectory();
    const homeDirectory = await createTemporaryDirectory();
    const result = await loadRuntimeConfig({ homeDirectory, projectRoot });

    assert.deepEqual(result.config, {
      capabilities: {},
      schemaVersion: 1,
    });
    assert.deepEqual(result.sources, ['defaults']);
  });

  it('объединяет уровни по capability и сохраняет пропущенные значения', async () => {
    const projectRoot = await createTemporaryDirectory();
    const homeDirectory = await createTemporaryDirectory();

    await writeJson(homeDirectory, {
      capabilities: {
        analytics: { enabled: false, required: false },
      },
      schemaVersion: 1,
    });
    await writeJson(projectRoot, {
      capabilities: {
        analytics: { enabled: true },
        quality: { required: true },
      },
      schemaVersion: 1,
    });

    const result = await loadRuntimeConfig({
      homeDirectory,
      overrides: {
        capabilities: {
          analytics: { required: true },
        },
      },
      projectRoot,
    });

    assert.deepEqual(result.config.capabilities, {
      analytics: { enabled: true, required: true },
      quality: { required: true },
    });
    assert.equal(Object.isFrozen(result.config.capabilities), true);
    assert.equal(Object.isFrozen(result.config.capabilities.analytics), true);
    assert.deepEqual(result.sources, [
      'defaults',
      'global',
      'project',
      'override',
    ]);
  });

  it('отклоняет неизвестные поля', async () => {
    const projectRoot = await createTemporaryDirectory();
    const homeDirectory = await createTemporaryDirectory();

    await writeJson(projectRoot, {
      capabilities: {},
      schemaVersion: 1,
      storage: {},
    });

    await assert.rejects(
      loadRuntimeConfig({ homeDirectory, projectRoot }),
      (error: unknown) =>
        error instanceof AmyRuntimeError &&
        error.code === 'INVALID_CONFIGURATION',
    );
  });

  it('отклоняет повреждённый JSON и неподдерживаемую схему', async () => {
    const projectRoot = await createTemporaryDirectory();
    const homeDirectory = await createTemporaryDirectory();

    await mkdir(join(projectRoot, '.amy'), { recursive: true });
    await writeFile(join(projectRoot, '.amy', 'config.json'), '{', 'utf8');

    await assert.rejects(
      loadRuntimeConfig({ homeDirectory, projectRoot }),
      (error: unknown) =>
        error instanceof AmyRuntimeError &&
        error.code === 'INVALID_CONFIGURATION',
    );

    await writeJson(projectRoot, { capabilities: {}, schemaVersion: 2 });

    await assert.rejects(
      loadRuntimeConfig({ homeDirectory, projectRoot }),
      (error: unknown) =>
        error instanceof AmyRuntimeError &&
        error.code === 'INVALID_CONFIGURATION',
    );
  });
});
