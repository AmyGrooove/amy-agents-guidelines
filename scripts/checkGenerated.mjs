import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedDirectory = join(pluginRoot, 'runtime', 'dist');
const checkDirectory = join(pluginRoot, 'runtime', '.generated-check');

const listRelativeFiles = async (root, current = root) => {
  const entries = await readdir(current, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = join(current, entry.name);

      return entry.isDirectory() ? listRelativeFiles(root, path) : [relative(root, path)];
    }),
  );

  return paths.flat().sort();
};

await rm(checkDirectory, { force: true, recursive: true });

const compilerResult = spawnSync(
  process.execPath,
  [
    join(pluginRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
    '-p',
    join(pluginRoot, 'tsconfig.json'),
    '--outDir',
    checkDirectory,
  ],
  { encoding: 'utf8' },
);

if (compilerResult.status !== 0) {
  process.stderr.write(compilerResult.stderr);
  process.stdout.write(compilerResult.stdout);
  process.exitCode = compilerResult.status ?? 1;
} else {
  const generatedFiles = await listRelativeFiles(generatedDirectory);
  const checkedFiles = await listRelativeFiles(checkDirectory);

  assert.deepEqual(generatedFiles, checkedFiles, 'Список файлов runtime/dist устарел');

  await Promise.all(
    generatedFiles.map(async (relativePath) => {
      const [generatedContent, checkedContent] = await Promise.all([
        readFile(join(generatedDirectory, relativePath)),
        readFile(join(checkDirectory, relativePath)),
      ]);

      assert.deepEqual(generatedContent, checkedContent, `${relativePath} устарел`);
    }),
  );

  await rm(checkDirectory, { force: true, recursive: true });
  process.stdout.write('runtime/dist соответствует исходникам TypeScript\n');
}
