import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedPath = join(pluginRoot, 'runtime', 'dist');
const checkPath = join(pluginRoot, 'runtime', '.generated-check');

const listFiles = async (root, current = root) => {
  const entries = await readdir(current, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = join(current, entry.name);

      return entry.isDirectory() ? listFiles(root, path) : [relative(root, path)];
    }),
  );

  return paths.flat().sort();
};

await rm(checkPath, { force: true, recursive: true });

const compiler = spawnSync(
  process.execPath,
  [
    join(pluginRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
    '-p',
    join(pluginRoot, 'tsconfig.json'),
    '--outDir',
    checkPath,
  ],
  { encoding: 'utf8' },
);

if (compiler.status !== 0) {
  process.stderr.write(compiler.stderr);
  process.stdout.write(compiler.stdout);
  process.exitCode = compiler.status ?? 1;
} else {
  const generatedFiles = await listFiles(generatedPath);
  const checkedFiles = await listFiles(checkPath);

  assert.deepEqual(generatedFiles, checkedFiles, 'runtime/dist file list is stale');

  await Promise.all(
    generatedFiles.map(async (path) => {
      const [generatedContent, checkedContent] = await Promise.all([
        readFile(join(generatedPath, path)),
        readFile(join(checkPath, path)),
      ]);

      assert.deepEqual(generatedContent, checkedContent, `${path} is stale`);
    }),
  );

  await rm(checkPath, { force: true, recursive: true });
  process.stdout.write('runtime/dist matches TypeScript sources\n');
}
