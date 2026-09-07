import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import {
  createAmyRuntime,
  createPluginInventoryCapability,
  discoverPluginInventory,
} from '../dist/index.js';

const temporaryDirectories: string[] = [];

const createPluginFixture = async () => {
  const pluginRoot = await mkdtemp(join(tmpdir(), 'amy-plugin-inventory-'));

  temporaryDirectories.push(pluginRoot);
  await mkdir(join(pluginRoot, '.codex-plugin'));
  await mkdir(join(pluginRoot, 'skills', 'z-skill'), { recursive: true });
  await mkdir(join(pluginRoot, 'skills', 'a-skill'), { recursive: true });
  await mkdir(join(pluginRoot, 'scripts'));
  await writeFile(
    join(pluginRoot, '.codex-plugin', 'plugin.json'),
    JSON.stringify({
      description: 'Fixture',
      interface: { capabilities: ['Interactive', 'Write'] },
      name: 'fixture-plugin',
      skills: './skills/',
      version: '1.2.3',
    }),
    'utf8',
  );

  return pluginRoot;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe('PluginInventory', () => {
  it('обнаруживает canonical mechanisms и сортирует их элементы', async () => {
    const pluginRoot = await createPluginFixture();
    const inventory = await discoverPluginInventory(pluginRoot);

    assert.deepEqual(inventory.plugin, {
      description: 'Fixture',
      name: 'fixture-plugin',
      version: '1.2.3',
    });
    assert.deepEqual(inventory.declaredPermissions, ['Interactive', 'Write']);
    assert.deepEqual(inventory.mechanisms.skills.items, ['a-skill', 'z-skill']);
    assert.equal(inventory.mechanisms.scripts.isPresent, true);
    assert.equal(inventory.mechanisms.agents.isPresent, false);
    assert.equal(inventory.mechanisms.validators.isPresent, false);
    assert.equal(inventory.mechanisms.permissions.isPresent, false);
  });

  it('предоставляет inventory через одну capability', async () => {
    const pluginRoot = await createPluginFixture();
    const capability = createPluginInventoryCapability(pluginRoot);
    const inventory = await capability.api.load();

    assert.equal(capability.descriptor.id, 'amy.plugin-inventory');
    assert.equal(inventory.plugin.name, 'fixture-plugin');
  });

  it('не превращает найденные skills в Runtime capabilities', async () => {
    const pluginRoot = await createPluginFixture();
    const homeDirectory = await mkdtemp(join(tmpdir(), 'amy-home-'));

    temporaryDirectories.push(homeDirectory);

    const runtime = await createAmyRuntime({
      homeDirectory,
      pluginRoot,
      projectRoot: pluginRoot,
    });

    assert.deepEqual(
      runtime.capabilities.list().map(({ id }) => id),
      ['amy.plugin-inventory'],
    );
  });
});
