import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { root } from './syncManifest.mjs';

function command(binary, args, directory, binaryOutput = false) {
  const result = spawnSync(binary, args, { cwd: directory, encoding: binaryOutput ? undefined : 'utf8', maxBuffer: 32 * 1024 * 1024, shell: false });
  if (result.error || result.status !== 0) throw new Error(`${binary} ${args.join(' ')} failed: ${result.error?.message || result.stderr || result.stdout}`);
  return result.stdout;
}

function cleanHead(directory) {
  if (command('git', ['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none'], directory).trim()) throw new Error('Release requires a clean Git working tree and index, including untracked files');
  return command('git', ['rev-parse', '--verify', 'HEAD'], directory).trim();
}

export function runChecks(directory = root) {
  const scripts = readdirSync(join(directory, 'scripts')).filter((name) => name.endsWith('.mjs')).map((name) => 'scripts/' + name);
  const tests = readdirSync(join(directory, 'scripts/__tests__')).filter((name) => name.endsWith('.test.mjs')).map((name) => 'scripts/__tests__/' + name);
  for (const script of [...scripts, ...tests].sort()) command(process.execPath, ['--check', script], directory);
  for (const args of [
    ['scripts/syncManifest.mjs', '--check'],
    ['scripts/verifyPlugin.mjs', '.'],
    ['scripts/evaluateRouting.mjs', 'check'],
    ['--test', '--test-reporter=dot', ...tests.sort()],
  ]) {
    const output = command(process.execPath, args, directory);
    console.log(output.trim());
  }
  command('git', ['diff', '--check'], directory);
}

export function createArchive(directory = root, tree = 'HEAD') {
  const manifest = JSON.parse(command('git', ['show', `${tree}:plugin.json`], directory));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name)) throw new Error('Invalid archive folder name');
  const supportFiles = new Set([
    'plugin.json', '.codex-plugin/plugin.json',
    'scripts/verifyPlugin.mjs', 'scripts/syncManifest.mjs',
    'scripts/evaluateRouting.mjs', 'scripts/routing-expectations.json',
  ]);
  const entries = command('git', ['ls-tree', '-r', '-z', tree], directory).split('\0').filter(Boolean);
  const files = [];
  for (const entry of entries) {
    const [metadata, path] = entry.split('\t');
    const included = supportFiles.has(path) || /^(?:skills|references)\/(?:[^./][^/]*\/)*[^./][^/]*\.(?:md|yaml)$/.test(path) || /^assets\/(?:[^./][^/]*\/)*[^./][^/]*\.(?:svg|png|jpg|jpeg|webp)$/.test(path);
    if (!included) continue;
    if (!/^100(?:644|755) blob /.test(metadata)) throw new Error('Archive entries must be regular files: ' + path);
    files.push(path);
  }
  for (const file of supportFiles) if (!files.includes(file)) throw new Error('Missing committed package file: ' + file);
  return command('git', ['-c', 'core.autocrlf=false', 'archive', '--format=zip', '-9', '--mtime=1980-01-01T00:00:00Z', `--prefix=${manifest.name}/`, tree, '--', ...files.sort()], directory, true);
}

export function buildPlugin() {
  const head = cleanHead(root);
  runChecks();
  const archive = createArchive(root, head);
  if (cleanHead(root) !== head) throw new Error('HEAD changed during build');
  const manifest = JSON.parse(command('git', ['show', `${head}:plugin.json`], root));
  const output = join(root, 'dist', `${manifest.name}-${manifest.version}.zip`);
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(output, archive, { flag: 'wx' });
  console.log('Built ' + output);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error('Usage: node scripts/buildPlugin.mjs');
    buildPlugin();
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
