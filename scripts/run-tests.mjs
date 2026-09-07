import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testRoot = join(pluginRoot, 'runtime', '.test-dist');
const testFiles = (await readdir(testRoot))
  .filter((name) => name.endsWith('.test.js'))
  .map((name) => join(testRoot, name))
  .sort();
const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
});

process.exitCode = result.status ?? 1;
